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

    <!-- 网络搜索专用测试区域 -->
    <el-card class="search-test-section" shadow="hover">
      <template #header>
        <div class="card-header">
          <span class="title">🔍 网络搜索测试</span>
        </div>
      </template>
      
      <!-- API 状态区域 -->
      <div class="api-status">
        <el-tag type="success" size="large">
          <el-icon><Check /></el-icon>
          Moonshot API 已配置: {{ apiConfig.currentKey }}
        </el-tag>
        <el-button type="success" size="small" @click="handleTestConnection">
          测试连接
        </el-button>
      </div>

      <div class="search-form">
        <el-row :gutter="12">
          <el-col :span="8">
            <el-input
              v-model="searchParams.stockCode"
              placeholder="股票代码"
              class="search-input"
            >
              <template #prepend>代码</template>
            </el-input>
          </el-col>
          <el-col :span="8">
            <el-input
              v-model="searchParams.stockName"
              placeholder="股票名称"
              class="search-input"
            >
              <template #prepend>名称</template>
            </el-input>
          </el-col>
          <el-col :span="8">
            <el-select v-model="searchParams.monthsBack" class="search-input">
              <template #prefix>时间</template>
              <el-option label="最近一个月" :value="1" />
              <el-option label="最近三个月" :value="3" />
              <el-option label="最近半年" :value="6" />
            </el-select>
          </el-col>
        </el-row>
        
        <div class="search-actions">
          <el-button
            type="primary"
            :loading="searchLoading"
            @click="handleSearchTest"
          >
            <el-icon><Search /></el-icon>
            {{ searchLoading ? '搜索中...' : '执行负面消息搜索' }}
          </el-button>
          <el-button
            type="success"
            @click="handleDirectApiTest"
          >
            <el-icon><Connection /></el-icon>
            直接测试API接口
          </el-button>
          <el-button
            type="info"
            @click="handleClearSearchCache"
          >
            <el-icon><RefreshLeft /></el-icon>
            清除搜索缓存
          </el-button>
        </div>
      </div>
      
      <!-- 搜索结果显示 -->
      <div v-if="searchResult" class="search-result-display">
        <el-divider content-position="left">
          <el-icon><TrendCharts /></el-icon>
          搜索结果分析
        </el-divider>
        
        <el-row :gutter="12">
          <el-col :span="8">
            <el-statistic title="搜索总数" :value="searchResult.totalResults" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="负面消息" :value="searchResult.negativeNews?.length || 0" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="搜索用时" :value="searchDuration" suffix="ms" />
          </el-col>
        </el-row>
        
        <div class="search-summary">
          <el-tag type="info" size="large">{{ searchResult.summary }}</el-tag>
        </div>
        
        <!-- 负面消息列表 -->
        <div v-if="searchResult.negativeNews && searchResult.negativeNews.length > 0" class="news-list">
          <el-card
            v-for="(news, index) in searchResult.negativeNews"
            :key="index"
            class="news-item"
            shadow="hover"
          >
            <div class="news-header">
              <strong>{{ news.title }}</strong>
              <el-tag size="small" type="warning">相关度: {{ news.relevance }}</el-tag>
            </div>
            <p class="news-summary">{{ news.summary }}</p>
            <div class="news-meta">
              <el-tag size="small">{{ news.source }}</el-tag>
              <span class="news-time">{{ formatTime(news.publishTime) }}</span>
              <el-link :href="news.url" target="_blank" type="primary">查看原文</el-link>
            </div>
            <div class="news-keywords">
              <el-tag
                v-for="keyword in news.negativeKeywords"
                :key="keyword"
                size="small"
                type="danger"
                effect="plain"
              >
                {{ keyword }}
              </el-tag>
            </div>
          </el-card>
        </div>
      </div>
    </el-card>

    <!-- 返回结果区域 -->
    <div class="result-section">
      <div class="section-header">
        <el-icon><Document /></el-icon>
        <span>API 调用结果</span>
      </div>
      <el-input
        v-model="localResult"
        type="textarea"
        :rows="8"
        readonly
        placeholder="API调用结果将显示在这里..."
        class="result-textarea"
      />
    </div>
  </el-card>
</template>

<script>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Link, Position, Loading, Document, Search, Connection, RefreshLeft, TrendCharts, Check } from '@element-plus/icons-vue'
import { webSearchService } from '../utils/webSearchService.js'

export default {
  name: 'WindowControl',
  components: {
    Link,
    Position,
    Loading,
    Document,
    Search,
    Connection,
    RefreshLeft,
    TrendCharts,
    Check
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

    // 搜索参数
    const searchParams = reactive({
      stockCode: '000001',
      stockName: '平安银行',
      monthsBack: 1
    })

    // 搜索状态
    const searchLoading = ref(false)
    const searchResult = ref(null)
    const searchDuration = ref(0)

    // API 配置
    const apiConfig = reactive({
      currentKey: ''
    })

    // 初始化 API 配置
    const initApiConfig = () => {
      apiConfig.currentKey = webSearchService.getMoonshotApiKey(true)
    }

    const apis = ref([
      {
        label: '健康检查',
        url: 'http://localhost:5000/health',
        method: 'GET'
      },
      {
        label: '获取持仓',
        url: 'http://localhost:5000/position',
        method: 'GET'
      },
      {
        label: '获取资金',
        url: 'http://localhost:5000/balance',
        method: 'GET'
      },
      {
        label: '下单接口',
        url: 'http://localhost:5000/xiadan?code=600000&status=1',
        method: 'GET'
      },
      {
        label: '撤单接口',
        url: 'http://localhost:5000/cancel_all_orders',
        method: 'GET'
      }
    ])

    const loadingStates = reactive({})
    
    apis.value.forEach(api => {
      loadingStates[api.url] = false
    })

    // API调用处理
    const handleApiCall = async (url) => {
      loadingStates[url] = true
      try {
        await emit('api-call', url)
      } finally {
        loadingStates[url] = false
      }
    }

    // 网络搜索测试（使用前端搜索服务）
    const handleSearchTest = async () => {
      searchLoading.value = true
      const startTime = Date.now()
      
      try {
        ElMessage.info('开始执行负面消息搜索...')
        
        const result = await webSearchService.searchNegativeNews(
          searchParams.stockCode,
          searchParams.stockName,
          searchParams.monthsBack
        )
        
        searchDuration.value = Date.now() - startTime
        searchResult.value = result
        
        localResult.value = JSON.stringify(result, null, 2)
        ElMessage.success('搜索完成！')
        
      } catch (error) {
        console.error('搜索测试失败:', error)
        ElMessage.error(`搜索失败: ${error.message}`)
        localResult.value = `搜索失败: ${error.message}`
      } finally {
        searchLoading.value = false
      }
    }

    // 直接API测试
    const handleDirectApiTest = async () => {
      try {
        ElMessage.info('测试API接口...')
        
        const response = await fetch('http://localhost:5000/api/web-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `${searchParams.stockName} 负面消息 问题 风险 最近一个月`,
            limit: 3,
            type: 'news'
          })
        })
        
        const data = await response.json()
        localResult.value = JSON.stringify(data, null, 2)
        
        if (data.status === 'success') {
          ElMessage.success('API测试成功！')
        } else {
          ElMessage.error('API返回错误')
        }
        
      } catch (error) {
        console.error('API测试失败:', error)
        ElMessage.error(`API测试失败: ${error.message}`)
        localResult.value = `API测试失败: ${error.message}`
      }
    }

    // 清除搜索缓存
    const handleClearSearchCache = () => {
      try {
        webSearchService.clearCache()
        ElMessage.success('搜索缓存已清除')
        localResult.value = '搜索缓存已清除'
      } catch (error) {
        console.error('清除缓存失败:', error)
        ElMessage.error(`清除缓存失败: ${error.message}`)
      }
    }

    // 格式化时间
    const formatTime = (timeStr) => {
      try {
        const date = new Date(timeStr)
        return date.toLocaleString('zh-CN')
      } catch {
        return timeStr
      }
    }


    // 测试 API 连接
    const handleTestConnection = async () => {
      try {
        ElMessage.info('正在测试 API 连接...')
        
        const result = await webSearchService.testMoonshotConnection()
        
        if (result.success) {
          ElMessage.success(result.message)
          localResult.value = 'Moonshot API 连接测试成功'
        } else {
          ElMessage.error(result.message)
          localResult.value = `Moonshot API 连接测试失败: ${result.message}`
        }
        
      } catch (error) {
        console.error('API 连接测试异常:', error)
        ElMessage.error('API 连接测试异常')
        localResult.value = `API 连接测试异常: ${error.message}`
      }
    }

    // 组件挂载时初始化配置
    initApiConfig()

    return {
      apis,
      loadingStates,
      handleApiCall,
      localResult,
      // 搜索相关
      searchParams,
      searchLoading,
      searchResult,
      searchDuration,
      handleSearchTest,
      handleDirectApiTest,
      handleClearSearchCache,
      formatTime,
      // API 配置相关
      apiConfig,
      handleTestConnection
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

/* 搜索测试区域样式 */
.search-test-section {
  margin-top: 20px;
}

/* API 状态样式 */
.api-status {
  margin: 16px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f0f9ff;
  border: 1px solid #e0f2fe;
  border-radius: 8px;
}

.search-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-input {
  width: 100%;
}

.search-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.search-result-display {
  margin-top: 20px;
}

.search-summary {
  margin: 16px 0;
  text-align: center;
}

.news-list {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.news-item {
  transition: all 0.3s ease;
}

.news-item:hover {
  transform: translateY(-2px);
}

.news-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.news-summary {
  color: var(--el-text-color-regular);
  margin: 8px 0;
  line-height: 1.6;
}

.news-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}

.news-time {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.news-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

@media (max-width: 768px) {
  .api-content {
    flex-direction: column;
    align-items: stretch;
  }

  .api-label {
    min-width: auto;
  }
  
  .search-actions {
    flex-direction: column;
  }
  
  .news-header {
    flex-direction: column;
    gap: 8px;
  }
  
  .news-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style> 