<template>
  <div class="websocket-container">
    <el-card class="main-card">
      <template #header>
        <div class="card-header">
          <span>WebSocket 连接</span>
          <el-tag :type="connectionStatus === 'connected' ? 'success' : 'danger'">
            {{ connectionStatusText }}
          </el-tag>
        </div>
      </template>

      <div class="connection-controls">
        <el-button 
          @click="connect" 
          :disabled="connectionStatus === 'connected'"
          type="primary"
        >
          连接
        </el-button>
        <el-button 
          @click="disconnect" 
          :disabled="connectionStatus === 'disconnected'"
          type="danger"
        >
          断开连接
        </el-button>
        <el-button @click="clearMessages" type="info">清空消息</el-button>
      </div>

      <div class="message-section">
        <el-row :gutter="20">
          <el-col :span="12">
            <h3>发送消息</h3>
            <el-input
              v-model="messageToSend"
              type="textarea"
              :rows="4"
              placeholder="输入要发送的消息..."
            />
            <el-button 
              @click="sendMessage" 
              :disabled="connectionStatus !== 'connected'"
              type="success"
              style="margin-top: 10px;"
            >
              发送消息
            </el-button>
          </el-col>
          
          <el-col :span="12">
            <h3>接收消息</h3>
            <div class="message-display">
              <div 
                v-for="(msg, index) in messages" 
                :key="index"
                :class="['message-item', msg.type]"
              >
                <span class="message-time">{{ msg.timestamp }}</span>
                <span class="message-content">{{ msg.content }}</span>
              </div>
            </div>
          </el-col>
        </el-row>
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'WebSocketConnection',
  data() {
    return {
      ws: null,
      connectionStatus: 'disconnected',
      messageToSend: '',
      messages: [],
      wsUrl: 'ws://127.0.0.1:8765/'
    }
  },
  computed: {
    connectionStatusText() {
      return this.connectionStatus === 'connected' ? '已连接' : '未连接'
    }
  },
  methods: {
    connect() {
      try {
        this.ws = new WebSocket(this.wsUrl)
        
        this.ws.onopen = () => {
          this.connectionStatus = 'connected'
          this.addMessage('连接成功', 'success')
        }
        
        this.ws.onmessage = (event) => {
          this.addMessage(`收到: ${event.data}`, 'received')
        }
        
        this.ws.onclose = () => {
          this.connectionStatus = 'disconnected'
          this.addMessage('连接已关闭', 'warning')
        }
        
        this.ws.onerror = (error) => {
          this.addMessage(`连接错误: ${error}`, 'error')
        }
      } catch (error) {
        this.addMessage(`连接失败: ${error.message}`, 'error')
      }
    },
    
    disconnect() {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    },
    
    sendMessage() {
      if (this.ws && this.connectionStatus === 'connected' && this.messageToSend.trim()) {
        this.ws.send(this.messageToSend)
        this.addMessage(`发送: ${this.messageToSend}`, 'sent')
        this.messageToSend = ''
      }
    },
    
    addMessage(content, type) {
      const timestamp = new Date().toLocaleTimeString()
      this.messages.unshift({
        content,
        type,
        timestamp
      })
      
      // 限制消息数量
      if (this.messages.length > 100) {
        this.messages = this.messages.slice(0, 100)
      }
    },
    
    clearMessages() {
      this.messages = []
    }
  },
  
  beforeUnmount() {
    this.disconnect()
  }
}
</script>

<style scoped>
.websocket-container {
  padding: 20px;
}

.main-card {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-controls {
  margin-bottom: 20px;
}

.connection-controls .el-button {
  margin-right: 10px;
}

.message-section h3 {
  margin-bottom: 10px;
  color: #333;
}

.message-display {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  height: 300px;
  overflow-y: auto;
  padding: 10px;
  background-color: #fafafa;
}

.message-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
  padding: 5px;
  border-radius: 3px;
}

.message-item.sent {
  background-color: #e1f5fe;
  border-left: 3px solid #2196f3;
}

.message-item.received {
  background-color: #f3e5f5;
  border-left: 3px solid #9c27b0;
}

.message-item.success {
  background-color: #e8f5e8;
  border-left: 3px solid #4caf50;
}

.message-item.error {
  background-color: #ffebee;
  border-left: 3px solid #f44336;
}

.message-item.warning {
  background-color: #fff3e0;
  border-left: 3px solid #ff9800;
}

.message-time {
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
}

.message-content {
  font-size: 14px;
  word-break: break-word;
}
</style>