#!/usr/bin/env python3
"""
WebRTC信令服务器
运行: python signaling_server.py
默认端口: 8000
"""

import asyncio
import websockets
import json
import logging
from typing import Dict, Set
from dataclasses import dataclass
from datetime import datetime

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class User:
    """用户信息"""
    websocket: websockets.WebSocketServerProtocol
    user_id: str
    room_id: str
    joined_at: datetime

class SignalingServer:
    """WebRTC信令服务器"""
    
    def __init__(self):
        self.rooms: Dict[str, Set[str]] = {}  # room_id -> set of user_ids
        self.users: Dict[str, User] = {}      # user_id -> User object
        self.connections: Dict[str, websockets.WebSocketServerProtocol] = {}  # user_id -> websocket
    
    async def handle_connection(self, websocket, path):
        """处理WebSocket连接"""
        user_id = None
        
        try:
            async for message in websocket:
                data = json.loads(message)
                
                if data['type'] == 'join':
                    user_id = await self.handle_join(websocket, data)
                elif user_id:
                    await self.handle_message(user_id, data)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"连接关闭: {user_id}")
        except Exception as e:
            logger.error(f"处理消息错误: {e}")
        finally:
            if user_id:
                await self.handle_disconnect(user_id)
    
    async def handle_join(self, websocket, data):
        """处理用户加入房间"""
        room_id = data['room']
        user_id = data['user']
        
        # 创建或获取房间
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        
        # 检查用户是否已存在
        if user_id in self.users:
            await self.send_error(websocket, "用户ID已存在")
            return None
        
        # 注册用户
        user = User(
            websocket=websocket,
            user_id=user_id,
            room_id=room_id,
            joined_at=datetime.now()
        )
        
        self.users[user_id] = user
        self.connections[user_id] = websocket
        self.rooms[room_id].add(user_id)
        
        logger.info(f"用户 {user_id} 加入房间 {room_id}")
        
        # 通知房间内其他用户
        room_users = list(self.rooms[room_id] - {user_id})
        logger.info(f"通知房间 {room_id} 的其他用户 {room_users}：新用户 {user_id} 加入")
        await self.broadcast_to_room(room_id, {
            'type': 'user-joined',
            'user': user_id,
            'timestamp': datetime.now().isoformat()
        }, exclude_user=user_id)
        
        # 发送当前房间用户列表给新用户
        room_users = list(self.rooms[room_id] - {user_id})
        await self.send_to_user(user_id, {
            'type': 'room-users',
            'users': room_users,
            'timestamp': datetime.now().isoformat()
        })
        
        return user_id
    
    async def handle_message(self, user_id, data):
        """处理用户消息"""
        message_type = data['type']
        
        # 添加详细调试信息
        logger.info(f"处理消息: {message_type} 来自: {user_id} 目标: {data.get('target')}")
        
        if message_type in ['offer', 'answer', 'ice-candidate']:
            # 转发给目标用户
            target_user = data.get('target')
            if target_user and target_user in self.connections:
                logger.info(f"转发消息: {message_type} 从 {user_id} 到 {target_user}")
                await self.send_to_user(target_user, {
                    **data,
                    'from': user_id
                })
            else:
                logger.warning(f"无法转发消息: 目标用户 {target_user} 不存在或未连接")
        else:
            logger.warning(f"未知消息类型: {message_type}")
    
    async def handle_disconnect(self, user_id):
        """处理用户断开连接"""
        if user_id in self.users:
            user = self.users[user_id]
            room_id = user.room_id
            
            # 从房间移除
            if room_id in self.rooms:
                self.rooms[room_id].discard(user_id)
                
                # 如果房间为空，删除房间
                if not self.rooms[room_id]:
                    del self.rooms[room_id]
            
            # 通知其他用户
            await self.broadcast_to_room(room_id, {
                'type': 'user-left',
                'user': user_id,
                'timestamp': datetime.now().isoformat()
            })
            
            # 清理资源
            if user_id in self.connections:
                del self.connections[user_id]
            if user_id in self.users:
                del self.users[user_id]
            
            logger.info(f"用户 {user_id} 离开房间 {room_id}")
    
    async def send_to_user(self, user_id, message):
        """发送消息给指定用户"""
        if user_id in self.connections:
            try:
                await self.connections[user_id].send(json.dumps(message))
            except websockets.exceptions.ConnectionClosed:
                logger.warning(f"无法发送消息给已断开连接的用户: {user_id}")
    
    async def broadcast_to_room(self, room_id, message, exclude_user=None):
        """广播消息给房间内所有用户"""
        if room_id in self.rooms:
            for user_id in self.rooms[room_id]:
                if user_id != exclude_user and user_id in self.connections:
                    try:
                        await self.connections[user_id].send(json.dumps(message))
                    except websockets.exceptions.ConnectionClosed:
                        logger.warning(f"无法发送广播消息给已断开连接的用户: {user_id}")
    
    async def send_error(self, websocket, error_message):
        """发送错误消息"""
        try:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': error_message,
                'timestamp': datetime.now().isoformat()
            }))
        except websockets.exceptions.ConnectionClosed:
            pass
    
    def get_stats(self):
        """获取服务器统计信息"""
        return {
            'total_users': len(self.users),
            'total_rooms': len(self.rooms),
            'rooms': {
                room_id: len(users) 
                for room_id, users in self.rooms.items()
            }
        }

class WebRTCSignalingService:
    """WebRTC信令服务，用于集成到主应用程序"""
    
    def __init__(self, host="0.0.0.0", port=8000):
        self.host = host
        self.port = port
        self.server = SignalingServer()
        self.websocket_server = None
        self.running = False
    
    async def start_server(self):
        """启动WebSocket服务器"""
        try:
            self.websocket_server = await websockets.serve(
                self.server.handle_connection, 
                self.host, 
                self.port,
                ping_interval=20,
                ping_timeout=60
            )
            self.running = True
            logger.info(f"WebRTC信令服务器已启动在 {self.host}:{self.port}")
            logger.info(f"WebSocket端点: ws://{self.host}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"启动信令服务器失败: {e}")
            return False
    
    async def stop_server(self):
        """停止WebSocket服务器"""
        if self.websocket_server:
            self.websocket_server.close()
            await self.websocket_server.wait_closed()
            self.running = False
            logger.info("WebRTC信令服务器已停止")
    
    def get_stats(self):
        """获取服务器统计信息"""
        return self.server.get_stats()

async def main():
    """独立启动信令服务器"""
    service = WebRTCSignalingService()
    
    if await service.start_server():
        logger.info("信令服务器已启动，按 Ctrl+C 停止")
        
        # 保持服务器运行
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("服务器已停止")