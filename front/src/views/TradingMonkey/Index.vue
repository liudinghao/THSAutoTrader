<template>
  <div class="trading-monkey-container">
    <!-- 连接状态栏 -->
    <el-card class="status-card" shadow="never">
      <div class="status-bar">
        <div class="status-left">
          <span class="page-title">🐒 交易猿 - 智能自动化交易系统</span>
          <el-tag :type="connectionStatus ? 'success' : 'danger'" size="small">
            {{ connectionStatus ? '已连接' : '未连接' }}
          </el-tag>
        </div>
        <div class="status-right">
          <el-button 
            size="small" 
            circle
            @click="checkHealth"
            title="刷新连接状态"
            :loading="loading.health"
          >
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 主要功能区 -->
    <el-row :gutter="20">
      <!-- 左侧列 -->
      <el-col :span="16">
        <!-- 市场概况 -->
        <MarketOverview
          :market-stats="marketStats"
          :concept-ranking="conceptRanking"
          :loading="loading.marketStats"
          @refresh="refreshMarketData"
        />


        <!-- 股票监控 -->
        <StockMonitor
          v-model:stocks="monitorStocks"
          :loading="loading.stockPool"
          :analysis-results="analysisResults"
          @refresh="fetchStockPool"
          @analyze-stock="analyzeStock"
          @show-analysis="showAnalysisResult"
          @jump-to-quote="jumpToStockQuote"
        />

        <!-- 持仓管理 -->
        <PositionManager
          :position-data="positionData"
          :available-balance="availableBalance"
          :loading="loading.position"
          :analysis-results="analysisResults"
          @refresh="refreshPositionData"
          @analyze-stock="analyzeStock"
          @show-analysis="showAnalysisResult"
          @jump-to-quote="jumpToStockQuote"
        />
      </el-col>

      <!-- 右侧列 -->
      <el-col :span="8">
        <!-- 交易建议 -->
        <TradingAdvice
          :market-stats="marketStats"
          :position-data="positionData"
          :monitor-stocks="monitorStocks"
          :current-prices="currentPrices"
        />
      </el-col>
    </el-row>

    <!-- 分析结果对话框 -->
    <AnalysisResultDialog
      v-model="analysisDialogVisible"
      :analysis-data="currentAnalysisData"
      :title="`${currentAnalysisData.stockName || '股票'} 分析报告`"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

// 导入组件
import MarketOverview from './components/MarketOverview.vue'
import StockMonitor from './components/StockMonitor.vue'
import PositionManager from './components/PositionManager.vue'
import AnalysisResultDialog from '../../components/AnalysisResultDialog.vue'
import TradingAdvice from './components/TradingAdvice.vue'

// 导入服务
import { TradingService } from './services/tradingService.js'
import { getPositionData } from '../../api/asset'
import { fetchRealTimeQuote, isTradeTime, jumpToQuote } from '../../utils/quoteApi.js'
import { performStockAnalysis } from './services/stockAnalysisService'
import { saveAnalysisResult, getAnalysisResult, getAllAnalysisResults } from '../../utils/indexedDB'
import { getConceptRanking } from '../../api/concept.js'
import { dataSourceService } from './services/dataSourceService.js'
import axios from 'axios'

// 响应式数据
const connectionStatus = ref(false)
const loading = ref({
  health: false,
  position: false,
  stockPool: false,
  analysis: false,
  balance: false,
  marketStats: false
})

// 核心数据
const monitorStocks = ref([])
const positionData = ref([])
const analysisResults = ref({})
const availableBalance = ref('0.00')
const currentPrices = ref({})

// 市场数据
const marketStats = ref({
  limit_up: 0,
  limit_down: 0,
  rising: 0,
  falling: 0,
  sh_index: { price: 0, change: 0, change_percent: 0 },
  sz_index: { price: 0, change: 0, change_percent: 0 },
  gem_index: { price: 0, change: 0, change_percent: 0 },
  microcap_index: { price: 0, change: 0, change_percent: 0 }
})

const conceptRanking = ref({
  topRisers: [],
  topFallers: [],
  timestamp: null
})

// 分析对话框
const analysisDialogVisible = ref(false)
const currentAnalysisData = ref({})

// 交易服务实例
const tradingService = new TradingService()

// 定时器
let healthCheckInterval = null
let stockQuoteInterval = null
let marketStatsInterval = null
let conceptRankingInterval = null


// 核心方法

/**
 * 检查健康状态
 */
const checkHealth = async () => {
  loading.value.health = true
  try {
    const response = await axios.get('http://localhost:5000/health')
    connectionStatus.value = response.data.status === 'success'
  } catch (error) {
    console.error('健康检查失败:', error)
    connectionStatus.value = false
  } finally {
    loading.value.health = false
  }
}

/**
 * 获取可用金额
 */
const fetchBalanceData = async () => {
  if (loading.value.balance) return
  
  loading.value.balance = true
  try {
    const response = await axios.get('http://localhost:5000/balance')
    
    if (response.data.data && response.data.data['可用金额'] !== undefined) {
      const balance = parseFloat(response.data.data['可用金额']).toFixed(2)
      availableBalance.value = balance
      localStorage.setItem('available_balance', JSON.stringify(response.data.data))
      localStorage.setItem('balance_timestamp', new Date().toISOString())
    } else {
      availableBalance.value = '0.00'
    }
  } catch (error) {
    console.error('获取可用金额失败:', error)
    availableBalance.value = '0.00'
  } finally {
    loading.value.balance = false
  }
}

/**
 * 获取持仓数据
 */
const fetchPositionData = async (forceRefresh = false) => {
  if (loading.value.position) return
  
  loading.value.position = true
  try {
    const data = await getPositionData(forceRefresh)
    positionData.value = data
  } catch (error) {
    console.error('获取持仓信息失败:', error)
    ElMessage.error(`获取持仓信息失败: ${error.message}`)
  } finally {
    loading.value.position = false
  }
}

/**
 * 刷新持仓数据
 */
const refreshPositionData = async () => {
  await fetchPositionData(true)
  await fetchBalanceData()
}

/**
 * 获取股票池数据
 */
const fetchStockPool = async () => {
  if (loading.value.stockPool) return
  
  loading.value.stockPool = true
  try {
    // 使用数据源服务获取数据
    const stockData = await dataSourceService.getStockData()
    
    if (Array.isArray(stockData)) {
      monitorStocks.value = stockData.map(stock => ({
        code: stock.code,
        name: stock.name,
        price: stock.price || '--',
        changePercent: stock.changePercent || '--',
        limitUpReason: stock.limitUpReason || '--',
        source: stock.source || 'auction-strategy'
      }))
      
      // 启动实时数据获取
      await fetchRealTimeStockData()
      startRealTimeQuotePolling()
    } else {
      ElMessage.warning('获取股票池数据格式异常')
    }
  } catch (error) {
    console.error('获取股票池数据失败:', error)
    ElMessage.error(`获取股票池数据失败: ${error.message}`)
  } finally {
    loading.value.stockPool = false
  }
}

/**
 * 获取实时股票数据
 */
const fetchRealTimeStockData = async () => {
  try {
    const stockCodes = monitorStocks.value.map(stock => stock.code)
    if (stockCodes.length === 0) return
    
    const realTimeData = await fetchRealTimeQuote(stockCodes)
    currentPrices.value = realTimeData
    
    // 更新股票数据
    monitorStocks.value = monitorStocks.value.map(stock => {
      const quoteData = realTimeData[stock.code]
      if (quoteData) {
        return {
          ...stock,
          price: parseFloat(quoteData.NEW || 0).toFixed(2),
          changePercent: parseFloat(quoteData.ZHANGDIEFU || 0).toFixed(2),
          // 保持原有的涨停原因
          limitUpReason: stock.limitUpReason
        }
      }
      return stock
    })
  } catch (error) {
    console.error('获取实时股票数据失败:', error)
  }
}

/**
 * 启动实时行情轮询
 */
const startRealTimeQuotePolling = async () => {
  stopRealTimeQuotePolling()
  
  if (monitorStocks.value.length === 0) return
  
  try {
    const isTrading = await isTradeTime('300033')
    if (!isTrading) {
      console.log('当前不在交易时间，跳过实时数据获取')
      return
    }
    
    await fetchRealTimeStockData()
    
    stockQuoteInterval = setInterval(async () => {
      const isStillTrading = await isTradeTime('300033')
      if (isStillTrading) {
        await fetchRealTimeStockData()
      } else {
        console.log('交易时间结束，停止实时数据获取')
        stopRealTimeQuotePolling()
      }
    }, 1000)
  } catch (error) {
    console.error('启动实时行情轮询失败:', error)
  }
}

/**
 * 停止实时行情轮询
 */
const stopRealTimeQuotePolling = () => {
  if (stockQuoteInterval) {
    clearInterval(stockQuoteInterval)
    stockQuoteInterval = null
  }
}

/**
 * 获取市场统计数据
 */
const fetchMarketStats = async () => {
  if (loading.value.marketStats) return
  
  loading.value.marketStats = true
  try {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const marketResponse = await axios.get(`/api/market/overview/distribution/v3?date=${today}`)

    if (marketResponse.data && marketResponse.data.result) {
      const result = marketResponse.data.result
      
      let rising = 0
      let falling = 0
      
      if (result.distribution && Array.isArray(result.distribution)) {
        for (let i = 0; i < 31; i++) {
          if (result.distribution[i]) {
            rising += result.distribution[i]
          }
        }
        
        for (let i = 32; i < result.distribution.length; i++) {
          if (result.distribution[i]) {
            falling += result.distribution[i]
          }
        }
      }
      
      // 获取指数数据
      const indexCodes = ['16:1A0001', '32:399001', '32:399006', '48:883418']
      let indexData = {}
      try {
        indexData = await fetchRealTimeQuote(indexCodes)
      } catch (error) {
        console.warn('获取指数数据失败:', error)
      }

      marketStats.value = {
        limit_up: result.limit_up || 0,
        limit_down: result.limit_down || 0,
        rising: rising,
        falling: falling,
        sh_index: {
          price: indexData['16:1A0001']?.NEW || 0,
          change: indexData['16:1A0001']?.ZHANGDIEFU || 0,
          change_percent: indexData['16:1A0001']?.ZHANGDIEFU || 0
        },
        sz_index: {
          price: indexData['32:399001']?.NEW || 0,
          change: indexData['32:399001']?.ZHANGDIEFU || 0,
          change_percent: indexData['32:399001']?.ZHANGDIEFU || 0
        },
        gem_index: {
          price: indexData['32:399006']?.NEW || 0,
          change: indexData['32:399006']?.ZHANGDIEFU || 0,
          change_percent: indexData['32:399006']?.ZHANGDIEFU || 0
        },
        microcap_index: {
          price: indexData['48:883418']?.NEW || 0,
          change: indexData['48:883418']?.ZHANGDIEFU || 0,
          change_percent: indexData['48:883418']?.ZHANGDIEFU || 0
        }
      }
    }
  } catch (error) {
    console.error('获取市场统计数据失败:', error)
  } finally {
    loading.value.marketStats = false
  }
}

/**
 * 获取概念排行数据
 */
const fetchConceptRanking = async () => {
  try {
    const conceptResponse = await getConceptRanking()
    conceptRanking.value = conceptResponse
  } catch (error) {
    console.error('获取概念排行数据失败:', error)
  }
}

/**
 * 刷新市场数据
 */
const refreshMarketData = async () => {
  if (loading.value.marketStats) return
  
  loading.value.marketStats = true
  try {
    await Promise.all([
      fetchMarketStats(),
      fetchConceptRanking()
    ])
    ElMessage.success('市场数据刷新成功')
  } catch (error) {
    console.error('刷新市场数据失败:', error)
    ElMessage.error('刷新市场数据失败')
  } finally {
    loading.value.marketStats = false
  }
}

/**
 * 分析股票
 */
const analyzeStock = async (stock) => {
  const stockCode = stock.code || stock.证券代码
  const stockName = stock.name || stock.证券名称
  
  if (!stockCode) {
    ElMessage.warning('股票代码无效')
    return
  }

  loading.value.analysis = true
  ElMessage.info(`正在分析 ${stockName || stockCode}...`)
  
  try {
    const result = await performStockAnalysis(stockCode, stockName, {
      months: 6,
      recentDays: 30,
      recentMinutes: 30
    }, positionData.value, marketStats.value, conceptRanking.value)

    if (result.success) {
      await saveAnalysisResult(stockCode, {
        analysis: result.analysis,
        timestamp: new Date().toISOString(),
        stockName: stockName || stockCode
      })
      
      analysisResults.value[stockCode] = {
        analysis: result.analysis,
        timestamp: new Date().toISOString(),
        stockName: stockName || stockCode
      }
      
      // 立即展示结果
      currentAnalysisData.value = {
        analysis: result.analysis,
        timestamp: new Date().toISOString(),
        stockName: stockName || stockCode
      }
      analysisDialogVisible.value = true
      
      ElMessage.success('分析完成！已保存到本地')
    } else {
      throw new Error(result.error)
    }

  } catch (error) {
    console.error('股票分析失败:', error)
    ElMessage.error(`分析失败: ${error.message}`)
  } finally {
    loading.value.analysis = false
  }
}

/**
 * 显示分析结果
 */
const showAnalysisResult = async (stock) => {
  const stockCode = stock.code || stock.证券代码
  const stockName = stock.name || stock.证券名称
  
  try {
    let result = analysisResults.value[stockCode]
    
    if (!result) {
      result = await getAnalysisResult(stockCode)
      if (result) {
        analysisResults.value[stockCode] = result
      }
    }
    
    if (result && result.analysis) {
      currentAnalysisData.value = {
        ...result,
        stockName: stockName || stockCode
      }
      analysisDialogVisible.value = true
    } else {
      ElMessage.warning('暂无分析结果，请先进行分析')
    }
  } catch (error) {
    console.error('获取分析结果失败:', error)
    ElMessage.error('获取分析结果失败')
  }
}

/**
 * 跳转到股票分时图
 */
const jumpToStockQuote = async (stockCode) => {
  if (!stockCode) {
    ElMessage.warning('股票代码无效')
    return
  }
  
  try {
    const stockCodeList = monitorStocks.value.map(stock => stock.code).filter(code => code && code !== stockCode)
    const trackingList = [stockCode, ...stockCodeList]
    
    jumpToQuote(stockCode, trackingList)
    ElMessage.success(`正在跳转到 ${stockCode} 分时图`)
  } catch (error) {
    console.error('跳转分时图失败:', error)
    ElMessage.error('跳转分时图失败')
  }
}






// 辅助函数

/**
 * 计算订单数量
 */
const calculateOrderQuantity = (signal) => {
  // 这里应该根据风险管理规则计算合适的数量
  // 目前使用简单逻辑
  const availableFunds = parseFloat(availableBalance.value)
  const price = getCurrentPrice(signal.stockCode)
  const maxAmount = availableFunds * 0.1 // 最多使用10%资金
  return Math.floor(maxAmount / price / 100) * 100 // 向下取整到100股的倍数
}

/**
 * 获取当前价格
 */
const getCurrentPrice = (stockCode) => {
  const priceData = currentPrices.value[stockCode]
  return parseFloat(priceData?.NEW || 0) || 0
}

/**
 * 获取持仓数量
 */
const getPositionQuantity = (stockCode) => {
  const position = positionData.value.find(p => (p.证券代码 || p.stockCode) === stockCode)
  return parseInt(position?.实际数量 || position?.quantity || 0)
}


/**
 * 加载本地数据
 */
const loadLocalData = async () => {
  // 加载可用金额
  try {
    const storedData = localStorage.getItem('available_balance')
    if (storedData) {
      const data = JSON.parse(storedData)
      availableBalance.value = data['可用金额'] ? parseFloat(data['可用金额']).toFixed(2) : '0.00'
    }
  } catch (error) {
    console.error('加载本地存储的可用金额失败:', error)
  }
  
  // 加载分析结果
  try {
    const allResults = await getAllAnalysisResults()
    analysisResults.value = allResults
    console.log('已加载分析结果:', Object.keys(allResults).length, '条')
    await nextTick()
  } catch (error) {
    console.error('加载分析结果失败:', error)
  }
}

/**
 * 启动市场数据定时更新
 */
const startMarketDataIntervals = () => {
  // 市场统计数据（30秒）
  fetchMarketStats()
  marketStatsInterval = setInterval(async () => {
    const isTrading = await isTradeTime('000001')
    if (isTrading) {
      fetchMarketStats()
    } else {
      console.log('非交易时段，停止市场统计数据更新')
      clearInterval(marketStatsInterval)
      marketStatsInterval = null
    }
  }, 30000)
  
  // 概念排行（1分钟）
  fetchConceptRanking()
  conceptRankingInterval = setInterval(async () => {
    const isTrading = await isTradeTime('000001')
    if (isTrading) {
      fetchConceptRanking()
    } else {
      console.log('非交易时段，跳过概念排行数据更新')
    }
  }, 60000)
}

/**
 * 清理定时器
 */
const cleanup = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
  }
  
  if (marketStatsInterval) {
    clearInterval(marketStatsInterval)
    marketStatsInterval = null
  }
  
  if (conceptRankingInterval) {
    clearInterval(conceptRankingInterval)
    conceptRankingInterval = null
  }
  
  stopRealTimeQuotePolling()
}

// 生命周期
onMounted(async () => {
  console.log('TradingMonkey 初始化开始')
  
  // 检查连接状态
  await checkHealth()
  
  // 设置定时检查连接状态
  healthCheckInterval = setInterval(checkHealth, 30000)
  
  // 加载本地数据
  await loadLocalData()
  
  // 启动市场数据定时更新
  startMarketDataIntervals()
  
  // 初始化集合竞价策略数据源
  console.log('初始化数据源: 集合竞价策略')
  
  // 获取股票池数据
  await fetchStockPool()
  
  // 获取持仓数据
  try {
    await fetchPositionData()
    await loadLocalData() // 再次加载分析结果
    if (!localStorage.getItem('available_balance')) {
      await fetchBalanceData()
    }
  } catch (error) {
    console.error('持仓数据加载失败:', error)
  }
  
  console.log('TradingMonkey 初始化完成')
})

onUnmounted(() => {
  cleanup()
  console.log('TradingMonkey 已清理')
})
</script>

<style scoped>
.trading-monkey-container {
  padding: 10px;
  min-height: 100vh;
  background: #f5f5f5;
}

.status-card {
  margin-bottom: 10px;
  border: none;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 1200px) {
  .trading-monkey-container {
    padding: 5px;
  }
  
  .page-title {
    font-size: 14px;
  }
}

@media (max-width: 768px) {
  .status-bar {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  
  .status-left {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  
  .page-title {
    font-size: 14px;
  }
}
</style>