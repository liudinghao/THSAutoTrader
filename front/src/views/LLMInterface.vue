<template>
  <div class="llm-interface">
    <el-card class="chat-card">
      <template #header>
        <div class="card-header">
          <span>对话</span>
          <div class="header-actions">
            <el-button type="danger" link @click="clearHistory">
              <el-icon><Delete /></el-icon>
              清空历史
            </el-button>
            <el-button type="primary" link @click="showConfig = true">
              <el-icon><Setting /></el-icon>
              设置
            </el-button>
          </div>
        </div>
      </template>
      <div class="chat-container">
        <div class="messages" ref="messagesContainer">
          <div v-for="(message, index) in messages" :key="index" 
               :class="['message', message.role]">
            <div class="message-content">{{ message.content }}</div>
          </div>
        </div>
        <div class="input-area">
          <el-input
            v-model="userInput"
            type="textarea"
            :rows="3"
            placeholder="请输入您的问题... (按Enter发送，Shift+Enter换行)"
            @keydown.enter.prevent="handleEnter"
          />
          <el-button type="primary" @click="sendMessage" :loading="loading">
            发送
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 配置弹窗 -->
    <el-dialog
      v-model="showConfig"
      title="接口配置"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="config" label-width="120px">
        <el-form-item label="模型选择">
          <el-select v-model="config.model" placeholder="请选择模型">
            <el-option
              v-for="model in Object.values(modelConfig)"
              :key="model.value"
              :label="model.label"
              :value="model.value"
            >
              <span>{{ model.label }}</span>
              <span class="model-description">{{ model.description }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="温度">
          <el-slider v-model="config.temperature" :min="0" :max="1" :step="0.1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showConfig = false">取消</el-button>
          <el-button type="primary" @click="showConfig = false">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { Setting, Delete } from '@element-plus/icons-vue'
import { sendMessage } from '../services/llmService'

// 模型配置
const MODEL_CONFIG = {
  'deepseek-chat': {
    label: 'DeepSeek-Chat',
    value: 'deepseek-chat',
    description: '用于一般对话'
  },
  'deepseek-reasoner': {
    label: 'DeepSeek-Reasoner',
    value: 'deepseek-reasoner',
    description: '用于推理和复杂问题'
  },
  'kimi': {
    label: 'Kimi',
    value: 'kimi',
    description: '月之暗面Kimi大模型，支持联网搜索'
  },
}

export default {
  name: 'LLMInterface',
  components: {
    Setting,
    Delete
  },
  data() {
    return {
      config: {
        model: 'kimi',
        temperature: 0.7
      },
      messages: [],
      userInput: '',
      loading: false,
      showConfig: false,
      modelConfig: MODEL_CONFIG
    }
  },
  created() {
    // 加载保存的模型选择
    const savedModel = localStorage.getItem('selected_model')
    if (savedModel) {
      this.config.model = savedModel
    }
    this.loadHistory()
  },
  watch: {
    'config.model': {
      handler(newModel) {
        // 保存模型选择
        localStorage.setItem('selected_model', newModel)
      }
    },
    messages: {
      handler(newMessages) {
        // 当消息更新时保存到本地存储
        this.saveHistory()
      },
      deep: true
    }
  },
  methods: {
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    },
    handleEnter(e) {
      if (e.shiftKey) {
        // Shift + Enter 换行
        this.userInput += '\n'
      } else {
        // 普通 Enter 发送消息
        this.sendMessage()
      }
    },
    validateInput() {
      const content = this.userInput.trim()
      if (!content) {
        this.$message.warning('请输入内容')
        return false
      }
      return true
    },
    async sendMessage() {
      if (!this.validateInput()) return

      // 添加用户消息
      this.messages.push({
        role: 'user',
        content: this.userInput.trim()
      })

      const userMessage = this.userInput
      this.userInput = ''
      this.loading = true
      this.scrollToBottom()

      try {
        const response = await sendMessage(
          this.messages,
          {
            provider: this.config.model === 'kimi' ? 'kimi' : 'deepseek',
            model: this.config.model,
            temperature: this.config.temperature
          }
        )

        this.messages.push({
          role: 'assistant',
          content: response.content
        })
        this.scrollToBottom()
      } catch (error) {
        this.$message.error('请求失败：' + error.message)
      } finally {
        this.loading = false
      }
    },
    saveHistory() {
      const key = `chat_history_${this.config.model}`
      localStorage.setItem(key, JSON.stringify(this.messages))
    },
    loadHistory() {
      const key = `chat_history_${this.config.model}`
      const savedHistory = localStorage.getItem(key)
      if (savedHistory) {
        try {
          this.messages = JSON.parse(savedHistory)
        } catch (e) {
          console.error('加载历史记录失败:', e)
          this.messages = []
        }
      }
    },
    clearHistory() {
      this.$confirm('确定要清空所有历史对话吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.messages = []
        this.saveHistory()
        this.$message.success('历史对话已清空')
      }).catch(() => {})
    }
  }
}
</script>

<style lang="less" scoped>
.llm-interface {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scroll-behavior: smooth;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #dcdfe6;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-track {
    background-color: transparent;
  }
}

.message {
  max-width: 80%;
  
  &.user {
    align-self: flex-end;
    .message-content {
      background-color: #409EFF;
      color: white;
    }
  }
  
  &.assistant {
    align-self: flex-start;
    .message-content {
      background-color: #f4f4f5;
    }
  }
}

.message-content {
  padding: 12px 16px;
  border-radius: 8px;
  word-break: break-word;
  white-space: pre-wrap;
}

.input-area {
  padding: 20px;
  border-top: 1px solid #dcdfe6;
  display: flex;
  gap: 10px;
  background-color: #fff;
  
  .el-button {
    align-self: flex-end;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.model-description {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}

:deep(.el-select-dropdown__item) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}
</style> 