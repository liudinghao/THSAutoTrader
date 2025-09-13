<template>
  <el-card class="trading-advice-card" shadow="never">
    <template #header>
      <div class="card-header">
        <span class="card-title">🎯 {{ tradingPlanTitle }}</span>
      </div>
    </template>

    <!-- 市场状态 -->
    <div class="market-status">
      <div class="status-item">
        <span class="label">📊 市场状态:</span>
        <el-tag :type="marketStatusType" size="small">{{ marketStatusText }}</el-tag>
      </div>
      <div class="status-item">
        <span class="label">🔴 风险等级:</span>
        <el-tag :type="riskLevelType" size="small">{{ riskLevelText }}</el-tag>
      </div>
    </div>

    <!-- 基础建议 -->
    <div class="basic-suggestions">
      <div class="section-title">💡 基础建议</div>
      <div class="suggestion-list">
        <div 
          v-for="(suggestion, index) in basicSuggestions" 
          :key="index"
          class="suggestion-item"
          :class="`suggestion-${suggestion.type}`"
        >
          <div class="suggestion-action">{{ suggestion.icon }} {{ suggestion.action }}</div>
          <div class="suggestion-reason">{{ suggestion.reason }}</div>
        </div>
      </div>
    </div>

    <!-- AI分析按钮 -->
    <div class="ai-analysis-section">
      <el-button 
        type="primary" 
        @click="handleAIAnalysis"
        :loading="analyzing"
        class="ai-analysis-btn"
      >
        <el-icon><TrendCharts /></el-icon>
        {{ analyzing ? 'AI分析中...' : 'AI智能分析' }}
      </el-button>
    </div>

    <!-- AI分析结果 -->
    <div v-if="aiAnalysisResult" class="ai-analysis-result">
      <div class="section-title">📋 AI分析结果</div>
      <div class="analysis-content markdown-content" v-html="formatMarkdown(aiAnalysisResult)">
      </div>
      <div class="analysis-time">
        <el-icon><Clock /></el-icon>
        分析时间: {{ formatTime(analysisTimestamp) }}
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { TrendCharts, Clock } from '@element-plus/icons-vue'
import { 
  generateBasicSuggestions,
  calculateMarketStatus,
  calculateRiskLevel,
  performAIMarketAnalysis
} from '../services/marketAnalysisService.js'
import { isTradingDay } from '../../../utils/quoteApi.js'

// Props
const props = defineProps({
  marketStats: {
    type: Object,
    default: () => ({})
  },
  positionData: {
    type: Array,
    default: () => []
  },
  monitorStocks: {
    type: Array,
    default: () => []
  },
  currentPrices: {
    type: Object,
    default: () => ({})
  }
})

// 响应式数据
const analyzing = ref(false)
const aiAnalysisResult = ref('')
const analysisTimestamp = ref(null)
const isCurrentlyTradingDay = ref(null) // null表示还未判断，true/false表示是否为交易日

// 本地存储键名
const STORAGE_KEY = 'trading_advice_analysis'
const STORAGE_EXPIRY = 4 * 60 * 60 * 1000 // 4小时过期

// 计算市场状态
const marketStatus = computed(() => calculateMarketStatus(props.marketStats))
const marketStatusText = computed(() => marketStatus.value.text)
const marketStatusType = computed(() => marketStatus.value.type)

// 计算风险等级
const riskLevel = computed(() => calculateRiskLevel(props.marketStats))
const riskLevelText = computed(() => riskLevel.value.text)
const riskLevelType = computed(() => riskLevel.value.type)

// 基础建议
const basicSuggestions = computed(() => generateBasicSuggestions(props.marketStats))

// 智能标题显示
const tradingPlanTitle = computed(() => {
  const now = new Date()
  const hour = now.getHours()
  
  // 如果无法确定交易日状态（API调用失败），显示通用标题
  if (isCurrentlyTradingDay.value === null) {
    return '交易建议（无法确定交易日状态）'
  }
  
  // 根据准确的交易日判断结果显示标题
  if (!isCurrentlyTradingDay.value) {
    return '非交易日'
  }
  
  // 交易日的时间判断
  if (hour < 9 || (hour === 9 && now.getMinutes() < 30)) {
    return '今日交易计划'
  } else if (hour >= 15) {
    return '明日交易计划'
  } else {
    return '当前交易建议'
  }
})


// 保存分析结果到本地存储
const saveAnalysisToLocal = (analysis, timestamp) => {
  try {
    const data = {
      analysis,
      timestamp,
      expiry: Date.now() + STORAGE_EXPIRY
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.warn('保存分析结果到本地存储失败:', error)
  }
}

// 从本地存储加载分析结果
const loadAnalysisFromLocal = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return false
    
    const data = JSON.parse(stored)
    
    // 检查是否过期
    if (Date.now() > data.expiry) {
      localStorage.removeItem(STORAGE_KEY)
      return false
    }
    
    aiAnalysisResult.value = data.analysis
    analysisTimestamp.value = new Date(data.timestamp)
    return true
  } catch (error) {
    console.warn('从本地存储加载分析结果失败:', error)
    localStorage.removeItem(STORAGE_KEY)
    return false
  }
}

// AI分析处理
const handleAIAnalysis = async () => {
  analyzing.value = true
  ElMessage.info('正在进行AI市场分析...')
  
  try {
    const result = await performAIMarketAnalysis(
      props.marketStats,
      props.positionData,
      props.monitorStocks,
      props.currentPrices
    )
    
    if (result.success) {
      aiAnalysisResult.value = result.analysis
      analysisTimestamp.value = new Date(result.timestamp)
      
      // 保存到本地存储
      saveAnalysisToLocal(result.analysis, result.timestamp)
      
      ElMessage.success('AI分析完成！')
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('AI分析失败:', error)
    ElMessage.error(`AI分析失败: ${error.message}`)
  } finally {
    analyzing.value = false
  }
}

// 简单的markdown转HTML（基础版本）
const formatMarkdown = (text) => {
  if (!text) return ''
  
  return text
    // 标题
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // 粗体
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 列表
    .replace(/^\d+\.\s+(.*$)/gim, '<li>$1</li>')
    .replace(/^[\-\*]\s+(.*$)/gim, '<li>$1</li>')
    // 换行
    .replace(/\n/g, '<br>')
    // 包装列表项
    .replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>')
}

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 异步判断当前是否为交易日
const checkTradingDay = async () => {
  try {
    const result = await isTradingDay()
    isCurrentlyTradingDay.value = result
  } catch (error) {
    console.error('判断交易日失败:', error)
    // API调用失败时，设置为null表示无法确定
    isCurrentlyTradingDay.value = null
  }
}

// 组件初始化时加载本地存储的分析结果并判断交易日
onMounted(async () => {
  loadAnalysisFromLocal()
  await checkTradingDay()
})

// 监听市场数据变化，自动更新基础建议
watch(() => props.marketStats, () => {
  // 市场数据更新时，基础建议会自动重新计算
}, { deep: true })
</script>

<style scoped>
.trading-advice-card {
  margin-bottom: 20px;
  border: 1px solid #e4e7ed;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.market-status {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.status-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.status-item:last-child {
  margin-bottom: 0;
}

.label {
  margin-right: 10px;
  font-size: 14px;
  color: #606266;
  min-width: 90px;
}

.basic-suggestions {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
  padding-bottom: 5px;
  border-bottom: 2px solid #e4e7ed;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suggestion-item {
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid transparent;
}

.suggestion-success {
  background: #f0f9ff;
  border-left-color: #67c23a;
}

.suggestion-warning {
  background: #fdf6ec;
  border-left-color: #e6a23c;
}

.suggestion-info {
  background: #f4f4f5;
  border-left-color: #909399;
}

.suggestion-action {
  font-weight: 600;
  margin-bottom: 4px;
  color: #303133;
}

.suggestion-reason {
  font-size: 12px;
  color: #606266;
}

.ai-analysis-section {
  text-align: center;
  margin: 20px 0;
}

.ai-analysis-btn {
  width: 100%;
}

.ai-analysis-result {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.analysis-content {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  margin: 10px 0;
  max-height: 500px;
  overflow-y: auto;
}

/* Markdown 内容样式 */
.markdown-content {
  white-space: normal;
  word-wrap: break-word;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
}

.markdown-content h1 {
  font-size: 18px;
  font-weight: 700;
  margin: 16px 0 8px 0;
  color: #1f2937;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 4px;
}

.markdown-content h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 14px 0 6px 0;
  color: #374151;
}

.markdown-content h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 12px 0 4px 0;
  color: #4b5563;
}

.markdown-content strong {
  font-weight: 600;
  color: #1f2937;
}

.markdown-content ul {
  margin: 8px 0;
  padding-left: 20px;
}

.markdown-content li {
  margin: 4px 0;
  list-style-type: disc;
}

.markdown-content br {
  margin: 2px 0;
}

.analysis-time {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #909399;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .status-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .label {
    margin-bottom: 5px;
    min-width: auto;
  }
}
</style>