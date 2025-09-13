<template>
  <div class="webrtc-container">
    <el-card class="connection-card">
      <template #header>
        <div class="card-header">
          <h3>WebRTC 实时通信</h3>
          <el-button 
            type="primary" 
            :icon="Link"
            @click="toggleConnection"
            :loading="connecting"
          >
            {{ isConnected ? '断开连接' : '建立连接' }}
          </el-button>
        </div>
      </template>

      <div class="connection-info">
        <el-form :model="connectionForm" label-width="120px">
          <el-form-item label="信令服务器地址">
            <el-input 
              v-model="connectionForm.signalingServer" 
              placeholder="ws://localhost:8000"
            />
          </el-form-item>
          <el-form-item label="房间ID">
            <el-input 
              v-model="connectionForm.roomId" 
              placeholder="输入房间ID"
            />
          </el-form-item>
          <el-form-item label="用户ID">
            <el-input 
              v-model="connectionForm.userId" 
              placeholder="输入用户ID"
            />
          </el-form-item>
        </el-form>
      </div>

      <div class="status-panel">
        <el-tag :type="connectionStatus.type">
          {{ connectionStatus.text }}
        </el-tag>
        <span class="peer-count">
          已连接: {{ peerCount }} 个节点
        </span>
      </div>
    </el-card>

    <el-row :gutter="20" class="content-row">
      <el-col :span="12">
        <el-card class="message-card">
          <template #header>
            <h4>发送消息</h4>
          </template>
          <el-input
            v-model="messageInput"
            type="textarea"
            :rows="4"
            placeholder="输入要发送的消息"
          />
          <div class="message-actions">
            <el-button 
              type="primary" 
              @click="sendMessage"
              :disabled="!isConnected"
            >
              发送消息
            </el-button>
            <el-button 
              @click="sendTestData"
              :disabled="!isConnected"
            >
              发送测试数据
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="message-card">
          <template #header>
            <h4>接收消息</h4>
          </template>
          <div class="message-list">
            <div 
              v-for="(msg, index) in receivedMessages" 
              :key="index"
              class="message-item"
            >
              <div class="message-meta">
                <span class="sender">{{ msg.sender }}</span>
                <span class="time">{{ formatTime(msg.timestamp) }}</span>
              </div>
              <div class="message-content">{{ msg.content }}</div>
            </div>
            <div v-if="receivedMessages.length === 0" class="empty-message">
              暂无消息
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Link } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// 状态管理
const connectionForm = ref({
  signalingServer: 'ws://localhost:8000',
  roomId: 'default-room',
  userId: `user_${Math.random().toString(36).substr(2, 9)}`
});

const messageInput = ref('');
const receivedMessages = ref([]);
const connecting = ref(false);
const isConnected = ref(false);
const peerCount = ref(0);

// WebRTC相关变量
let signalingSocket = null;
let peerConnections = new Map();
let dataChannels = new Map();

// 计算属性
const connectionStatus = computed(() => {
  if (isConnected.value) {
    return { type: 'success', text: '已连接' };
  } else if (connecting.value) {
    return { type: 'warning', text: '连接中...' };
  } else {
    return { type: 'info', text: '未连接' };
  }
});

// 连接管理
const toggleConnection = async () => {
  if (isConnected.value) {
    disconnect();
  } else {
    await connect();
  }
};

const connect = async () => {
  connecting.value = true;
  try {
    await connectToSignalingServer();
    ElMessage.success('连接信令服务器成功');
  } catch (error) {
    ElMessage.error(`连接失败: ${error.message}`);
    connecting.value = false;
  }
};

const disconnect = () => {
  if (signalingSocket) {
    signalingSocket.close();
  }
  peerConnections.forEach(peer => peer.close());
  peerConnections.clear();
  dataChannels.clear();
  
  isConnected.value = false;
  connecting.value = false;
  peerCount.value = 0;
  
  ElMessage.info('连接已断开');
};

// 信令服务器连接
const connectToSignalingServer = () => {
  return new Promise((resolve, reject) => {
    signalingSocket = new WebSocket(connectionForm.value.signalingServer);
    
    signalingSocket.onopen = () => {
      isConnected.value = true;
      connecting.value = false;
      
      // 发送加入房间消息
      signalingSocket.send(JSON.stringify({
        type: 'join',
        room: connectionForm.value.roomId,
        user: connectionForm.value.userId
      }));
      
      resolve();
    };
    
    signalingSocket.onmessage = (event) => {
      handleSignalingMessage(JSON.parse(event.data));
    };
    
    signalingSocket.onerror = (error) => {
      reject(error);
    };
    
    signalingSocket.onclose = () => {
      isConnected.value = false;
      connecting.value = false;
    };
  });
};

// 处理信令消息
const handleSignalingMessage = (message) => {
  switch (message.type) {
    case 'offer':
      handleOffer(message);
      break;
    case 'answer':
      handleAnswer(message);
      break;
    case 'ice-candidate':
      handleIceCandidate(message);
      break;
    case 'user-joined':
      handleUserJoined(message);
      break;
    case 'user-left':
      handleUserLeft(message);
      break;
    case 'room-users':
      break;
    default:
      break;
  }
};

// WebRTC连接建立
const createPeerConnection = (targetUserId) => {
  const config = {
    iceServers: []
  };
  
  const pc = new RTCPeerConnection(config);
  
  // 保存PeerConnection到Map中
  peerConnections.set(targetUserId, pc);
  
  // 添加连接状态监控
  pc.oniceconnectionstatechange = () => {
    // ICE连接状态变化处理
  };
  
  pc.onsignalingstatechange = () => {
    // 信令状态变化处理
  };
  
  pc.onconnectionstatechange = () => {
    // 连接状态变化处理
  };
  
  // 监听数据通道事件（Answer方）
  pc.ondatachannel = (event) => {
    setupDataChannel(event.channel, targetUserId);
  };
  
  // 监听ICE候选
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      signalingSocket.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        target: targetUserId
      }));
    }
  };
  
  return pc;
};

const setupDataChannel = (channel, targetUserId) => {
  channel.onopen = () => {
    dataChannels.set(targetUserId, channel);
    peerCount.value = dataChannels.size;
    ElMessage.success(`与 ${targetUserId} 建立数据通道`);
  };
  
  channel.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      receivedMessages.value.push({
        sender: targetUserId,
        content: message.content,
        timestamp: message.timestamp || Date.now()
      });
    } catch (error) {
      // 消息解析失败
    }
  };
  
  channel.onclose = () => {
    dataChannels.delete(targetUserId);
    peerConnections.delete(targetUserId);
    peerCount.value = dataChannels.size;
    ElMessage.info(`${targetUserId} 断开连接`);
  };
  
  channel.onerror = (error) => {
    // 数据通道错误处理
  };
};

// 处理Offer
const handleOffer = async (message) => {
  const { from: targetUserId, offer } = message;
  
  if (peerConnections.has(targetUserId)) {
    return; // 已经存在连接
  }

  const pc = createPeerConnection(targetUserId);
  
  try {
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    signalingSocket.send(JSON.stringify({
      type: 'answer',
      answer: answer,
      target: targetUserId
    }));


  } catch (error) {
    // 处理Offer失败
  }
};

// 处理Answer
const handleAnswer = async (message) => {
  const { from: targetUserId, answer } = message;
  const pc = peerConnections.get(targetUserId);
  
  if (pc) {
    try {
      await pc.setRemoteDescription(answer);
    } catch (error) {
      // 处理Answer失败
    }
  }
};

// 处理ICE候选
const handleIceCandidate = async (message) => {
  const { from: targetUserId, candidate } = message;
  const pc = peerConnections.get(targetUserId);
  
  if (pc && candidate) {
    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      // 添加ICE候选失败
    }
  }
};

// 处理用户加入
const handleUserJoined = async (message) => {
  const { user: targetUserId } = message;
  
  if (targetUserId === connectionForm.value.userId || peerConnections.has(targetUserId)) {
    return;
  }

  const pc = createPeerConnection(targetUserId);
  
  try {
    // Offer方在创建Offer之前创建数据通道
    const dataChannel = pc.createDataChannel('trading');
    setupDataChannel(dataChannel, targetUserId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    signalingSocket.send(JSON.stringify({
      type: 'offer',
      offer: offer,
      target: targetUserId
    }));

  } catch (error) {
    // 创建Offer失败
  }
};

// 处理用户离开
const handleUserLeft = (message) => {
  const { user: targetUserId } = message;
  
  const pc = peerConnections.get(targetUserId);
  if (pc) {
    pc.close();
  }
  
  peerConnections.delete(targetUserId);
  dataChannels.delete(targetUserId);
  peerCount.value = dataChannels.size;
  
  ElMessage.info(`${targetUserId} 离开房间`);
};

// 消息处理
const sendMessage = () => {
  if (!messageInput.value.trim()) return;
  
  const message = {
    content: messageInput.value,
    timestamp: Date.now(),
    type: 'text'
  };
  
  dataChannels.forEach((channel, userId) => {
    if (channel.readyState === 'open') {
      channel.send(JSON.stringify(message));
    }
  });
  
  // 添加到自己的消息列表
  receivedMessages.value.push({
    sender: '我',
    content: messageInput.value,
    timestamp: Date.now()
  });
  
  messageInput.value = '';
};

const sendTestData = () => {
  const testData = {
    type: 'test',
    content: '这是一条测试消息',
    timestamp: Date.now(),
    random: Math.random()
  };
  
  dataChannels.forEach((channel, userId) => {
    if (channel.readyState === 'open') {
      channel.send(JSON.stringify(testData));
    }
  });
  
  ElMessage.success('测试数据已发送');
};

// 辅助函数
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString();
};


// 生命周期
onMounted(() => {
  // 页面加载时自动连接
  connect();
});

onUnmounted(() => {
  disconnect();
});
</script>

<style scoped>
.webrtc-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-info {
  margin-bottom: 20px;
}

.status-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
}

.content-row {
  margin-top: 20px;
}

.message-card {
  height: 300px;
}

.message-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

.message-list {
  height: 200px;
  overflow-y: auto;
}

.message-item {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.message-content {
  word-break: break-word;
}

.empty-message {
  text-align: center;
  color: #999;
  padding: 20px;
}

</style>