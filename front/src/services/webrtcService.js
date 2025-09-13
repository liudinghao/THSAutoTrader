import { ElMessage } from 'element-plus';

export class WebRTCService {
    constructor() {
        this.signalingSocket = null;
        this.peerConnections = new Map();
        this.dataChannels = new Map();
        this.roomId = '';
        this.userId = '';
        this.isConnected = false;
        this.onMessageCallback = null;
        this.onConnectionChange = null;
    }

    // 初始化连接
    async initialize(config) {
        const {
            signalingServer = 'ws://localhost:8000',
            roomId = 'default-room',
            userId = `user_${Math.random().toString(36).substr(2, 9)}`,
            onMessage,
            onConnectionChange
        } = config;

        this.roomId = roomId;
        this.userId = userId;
        this.onMessageCallback = onMessage;
        this.onConnectionChange = onConnectionChange;

        try {
            await this.connectToSignalingServer(signalingServer);
            return true;
        } catch (error) {
            console.error('WebRTC初始化失败:', error);
            throw error;
        }
    }

    // 连接到信令服务器
    connectToSignalingServer(serverUrl) {
        return new Promise((resolve, reject) => {
            this.signalingSocket = new WebSocket(serverUrl);

            this.signalingSocket.onopen = () => {
                this.isConnected = true;
                this.sendSignalingMessage({
                    type: 'join',
                    room: this.roomId,
                    user: this.userId
                });
                
                if (this.onConnectionChange) {
                    this.onConnectionChange(true);
                }
                
                resolve();
            };

            this.signalingSocket.onmessage = (event) => {
                this.handleSignalingMessage(JSON.parse(event.data));
            };

            this.signalingSocket.onerror = (error) => {
                reject(error);
            };

            this.signalingSocket.onclose = () => {
                this.isConnected = false;
                if (this.onConnectionChange) {
                    this.onConnectionChange(false);
                }
            };
        });
    }

    // 发送信令消息
    sendSignalingMessage(message) {
        if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
            this.signalingSocket.send(JSON.stringify(message));
        }
    }

    // 处理信令消息
    handleSignalingMessage(message) {
        switch (message.type) {
            case 'offer':
                this.handleOffer(message);
                break;
            case 'answer':
                this.handleAnswer(message);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(message);
                break;
            case 'user-joined':
                this.handleUserJoined(message);
                break;
            case 'user-left':
                this.handleUserLeft(message);
                break;
            default:
                console.warn('未知的信令消息类型:', message.type);
        }
    }

    // 创建PeerConnection
    createPeerConnection(targetUserId) {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(config);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    target: targetUserId
                });
            }
        };

        pc.ondatachannel = (event) => {
            this.setupDataChannel(event.channel, targetUserId);
        };

        this.peerConnections.set(targetUserId, pc);
        return pc;
    }

    // 设置数据通道
    setupDataChannel(channel, targetUserId) {
        channel.onopen = () => {
            this.dataChannels.set(targetUserId, channel);
            ElMessage.success(`与 ${targetUserId} 建立数据通道`);
        };

        channel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (this.onMessageCallback) {
                    this.onMessageCallback({
                        sender: targetUserId,
                        content: message.content,
                        timestamp: message.timestamp || Date.now(),
                        type: message.type || 'text'
                    });
                }
            } catch (error) {
                console.error('解析消息失败:', error);
            }
        };

        channel.onclose = () => {
            this.dataChannels.delete(targetUserId);
            this.peerConnections.delete(targetUserId);
            ElMessage.info(`${targetUserId} 断开连接`);
        };
    }

    // 处理Offer
    async handleOffer(message) {
        const { from: targetUserId, offer } = message;
        
        if (this.peerConnections.has(targetUserId)) {
            return; // 已经存在连接
        }

        const pc = this.createPeerConnection(targetUserId);
        
        try {
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            this.sendSignalingMessage({
                type: 'answer',
                answer: answer,
                target: targetUserId
            });

            // 创建数据通道
            const dataChannel = pc.createDataChannel('trading');
            this.setupDataChannel(dataChannel, targetUserId);

        } catch (error) {
            console.error('处理Offer失败:', error);
        }
    }

    // 处理Answer
    async handleAnswer(message) {
        const { from: targetUserId, answer } = message;
        const pc = this.peerConnections.get(targetUserId);
        
        if (pc) {
            try {
                await pc.setRemoteDescription(answer);
            } catch (error) {
                console.error('处理Answer失败:', error);
            }
        }
    }

    // 处理ICE候选
    async handleIceCandidate(message) {
        const { from: targetUserId, candidate } = message;
        const pc = this.peerConnections.get(targetUserId);
        
        if (pc && candidate) {
            try {
                await pc.addIceCandidate(candidate);
            } catch (error) {
                console.error('添加ICE候选失败:', error);
            }
        }
    }

    // 用户加入
    async handleUserJoined(message) {
        const { user: targetUserId } = message;
        
        if (targetUserId === this.userId || this.peerConnections.has(targetUserId)) {
            return;
        }

        const pc = this.createPeerConnection(targetUserId);
        
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            this.sendSignalingMessage({
                type: 'offer',
                offer: offer,
                target: targetUserId
            });

            // 创建数据通道
            const dataChannel = pc.createDataChannel('trading');
            this.setupDataChannel(dataChannel, targetUserId);

        } catch (error) {
            console.error('创建Offer失败:', error);
        }
    }

    // 用户离开
    handleUserLeft(message) {
        const { user: targetUserId } = message;
        
        const pc = this.peerConnections.get(targetUserId);
        if (pc) {
            pc.close();
        }
        
        this.peerConnections.delete(targetUserId);
        this.dataChannels.delete(targetUserId);
        
        ElMessage.info(`${targetUserId} 离开房间`);
    }

    // 发送消息
    sendMessage(content, type = 'text') {
        const message = {
            content,
            type,
            timestamp: Date.now()
        };

        this.dataChannels.forEach((channel, userId) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify(message));
            }
        });

        return message;
    }

    // 发送交易数据
    sendTradingData(data) {
        return this.sendMessage(data, 'trading');
    }

    // 获取连接状态
    getConnectionStats() {
        return {
            isConnected: this.isConnected,
            peerCount: this.dataChannels.size,
            userId: this.userId,
            roomId: this.roomId
        };
    }

    // 断开连接
    disconnect() {
        if (this.signalingSocket) {
            this.signalingSocket.close();
        }

        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.dataChannels.clear();

        this.isConnected = false;
        if (this.onConnectionChange) {
            this.onConnectionChange(false);
        }
    }

    // 销毁实例
    destroy() {
        this.disconnect();
        this.onMessageCallback = null;
        this.onConnectionChange = null;
    }
}