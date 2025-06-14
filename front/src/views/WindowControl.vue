<template>
  <el-card class="window-control-card">
    <template #header>
      <div class="card-header">
        <span class="title">Window 控制调试</span>
      </div>
    </template>

    <div class="api-list">
      <el-card
        v-for="api in apis"
        :key="api.url"
        class="api-item"
        shadow="hover"
      >
        <div class="api-content">
          <span class="api-label">{{ api.label }}</span>
          <el-input
            v-model="api.url"
            class="api-url"
            readonly
          >
            <template #prepend>
              <el-icon><Link /></el-icon>
            </template>
          </el-input>
          <el-button
            type="primary"
            :icon="loadingStates[api.url] ? Loading : Position"
            :loading="loadingStates[api.url]"
            @click="handleApiCall(api.url)"
          >
            {{ loadingStates[api.url] ? '请求中...' : '执行' }}
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 返回结果区域 -->
    <div class="result-section">
      <div class="section-header">
        <el-icon><Document /></el-icon>
        <span>返回结果</span>
      </div>
      <el-input
        v-model="localResult"
        type="textarea"
        :rows="6"
        readonly
        placeholder="API调用结果将显示在这里..."
        class="result-textarea"
      />
    </div>
  </el-card>
</template>

<script>
import { ref, reactive, watch } from 'vue'
import { Link, Position, Loading, Document } from '@element-plus/icons-vue'

export default {
  name: 'WindowControl',
  components: {
    Link,
    Position,
    Loading,
    Document
  },
  props: {
    result: {
      type: String,
      default: ''
    }
  },
  emits: ['api-call'],
  setup(props, { emit }) {
    const localResult = ref(props.result)

    watch(() => props.result, (newValue) => {
      localResult.value = newValue
    })

    const apis = ref([
      {
        label: '获取持仓',
        url: 'http://localhost:5000/position'
      },
      {
        label: '获取资金',
        url: 'http://localhost:5000/balance'
      },
      {
        label: '下单接口',
        url: 'http://localhost:5000/xiadan?code=600000&status=1'
      },
      {
        label: '撤单接口',
        url: 'http://localhost:5000/cancel_all_orders'
      }
    ])

    const loadingStates = reactive({})
    
    apis.value.forEach(api => {
      loadingStates[api.url] = false
    })

    const handleApiCall = async (url) => {
      loadingStates[url] = true
      try {
        await emit('api-call', url)
      } finally {
        loadingStates[url] = false
      }
    }

    return {
      apis,
      loadingStates,
      handleApiCall,
      localResult
    }
  }
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.api-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-item {
  transition: all 0.3s ease;
}

.api-item:hover {
  transform: translateY(-2px);
}

.api-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.api-label {
  min-width: 80px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.api-url {
  flex: 1;
}

.result-section {
  margin-top: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.result-textarea {
  font-family: monospace;
  background-color: var(--el-bg-color-page);
}

:deep(.el-card__body) {
  padding: 10px;
}

@media (max-width: 768px) {
  .api-content {
    flex-direction: column;
    align-items: stretch;
  }

  .api-label {
    min-width: auto;
  }
}
</style> 