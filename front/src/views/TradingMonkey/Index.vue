<template>
  <div class="trading-monkey-container">
    <!-- 连接状态栏 -->
    <div class="status-bar">
      <span class="page-title">🦍 交易猿</span>
      <el-tag :type="connectionStatus ? 'success' : 'danger'" size="small">
        {{ connectionStatus ? '已连接' : '未连接' }}
      </el-tag>
    </div>

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
          :stocks="stockMonitor.stocks.value"
          :loading="stockMonitor.loading.value.fetch"
          :analysis-results="analysisResults"
          :selected-strategy="currentStrategy"
          :strategy-status="strategyStatus"
          @refresh="handleRefreshStocks"
          @add-stock="handleAddStock"
          @remove-stock="handleRemoveStock"
          @analyze-stock="analyzeStock"
          @show-analysis="showAnalysisResult"
          @jump-to-quote="jumpToStockQuote"
          @strategy-change="handleStrategyChange"
        />

        <!-- 持仓管理 -->
        <PositionManager
          :position-data="positionData"
          :available-balance="availableBalance"
          :loading="loading.position"
          :analysis-results="analysisResults"
          :current-prices="currentPrices"
          @refresh="refreshPositionData"
          @analyze-stock="analyzeStock"
          @show-analysis="showAnalysisResult"
          @jump-to-quote="jumpToStockQuote"
        />
      </el-col>

      <!-- 右侧列 -->
      <el-col :span="8">
        <!-- 股票智能排序 -->
        <StockRanking
          :stocks="stockMonitor.stocks.value"
          :concept-ranking="conceptRanking"
          @jump-to-quote="jumpToStockQuote"
          @analyze-stock="analyzeStock"
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

// 导入组件
import MarketOverview from './components/MarketOverview.vue'
import StockRanking from './components/StockRanking.vue'
import StockMonitor from './components/StockMonitor.vue'
import PositionManager from './components/PositionManager.vue'
import AnalysisResultDialog from '../../components/AnalysisResultDialog.vue'

// 导入服务
import { TradingService } from './services/tradingService.js'
import { getPositionData, getAssetInfo } from '../../api/asset'
import { fetchRealTimeQuote, isInTradingTime, jumpToQuote } from '../../utils/quoteApi.js'
import { performStockAnalysis } from './services/stockAnalysisService'
import { saveAnalysisResult, getAnalysisResult, getAllAnalysisResults } from '../../utils/indexedDB'
import { getConceptRanking } from '../../api/concept.js'
import { useStockMonitor } from './composables/useStockMonitor.js'
import { strategyManager } from './services/strategyManager.js'
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

// 股票监控状态管理
const stockMonitor = useStockMonitor()

// 核心数据
const positionData = ref([])
const analysisResults = ref({})
const availableBalance = ref('--')
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

// 策略管理器状态
const currentStrategy = ref('auction_preselect')
const strategyStatus = strategyManager.strategyStatus


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
const fetchBalanceData = async (forceRefresh = false) => {
  if (loading.value.balance) return
  
  loading.value.balance = true
  try {
    const assetData = await getAssetInfo(forceRefresh)
    
    if (assetData && assetData['可用金额'] !== undefined) {
      const balance = parseFloat(assetData['可用金额']).toFixed(2)
      availableBalance.value = balance
    } else {
      availableBalance.value = '--'
    }
  } catch (error) {
    console.error('获取可用金额失败:', error)
    availableBalance.value = '--'
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

    // 持仓数据更新后，获取持仓股票的实时价格
    await fetchPositionRealTimeData()
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
  await fetchBalanceData(true)
}

/**
 * 刷新股票监控数据
 */
const handleRefreshStocks = async () => {
  const success = await stockMonitor.fetchStocks()
  if (success && stockMonitor.hasStocks.value) {
    // 先获取一次实时数据（不管是否交易时间）
    await stockMonitor.updateRealTimeData()
    // 然后启动交易时间轮询
    startRealTimeQuotePolling()
  } else if (!stockMonitor.hasStocks.value) {
    // 如果没有股票，停止轮询
    stopRealTimeQuotePolling()
  }
}

/**
 * 获取持仓股票的实时价格数据（用于持仓管理显示）
 */
const fetchPositionRealTimeData = async () => {
  // 获取持仓股票代码列表
  const positionStockCodes = positionData.value.map(position => position.证券代码).filter(code => code)

  // 如果没有持仓股票，直接返回
  if (positionStockCodes.length === 0) return

  try {
    // 获取持仓股票的实时价格
    const realTimeData = await fetchRealTimeQuote(positionStockCodes)
    if (realTimeData) {
      currentPrices.value = realTimeData
    }
  } catch (error) {
    console.error('获取持仓股票实时价格失败:', error)
  }
}

/**
 * 启动实时行情轮询
 */
const startRealTimeQuotePolling = async () => {
  // 先停止旧的轮询
  stopRealTimeQuotePolling()

  try {
    // 立即获取一次数据（不管是否交易时间）
    await Promise.all([
      stockMonitor.updateRealTimeData(),  // 更新监控股票
      fetchPositionRealTimeData()         // 更新持仓股票
    ])

    // 启动定时轮询
    stockQuoteInterval = setInterval(async () => {
      const isTrading = await isInTradingTime()
      if (isTrading) {
        // 分别更新监控股票和持仓股票的实时数据
        await Promise.all([
          stockMonitor.updateRealTimeData(),  // 更新监控股票
          fetchPositionRealTimeData()         // 更新持仓股票
        ])
      }
    }, 5000) // 每5秒轮询一次

    console.log('实时行情轮询已启动')
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
    console.log('实时行情轮询已停止')
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
    }, positionData.value, conceptRanking.value)

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
 * 处理添加监控股票
 */
const handleAddStock = (stockInfo) => {
  stockMonitor.addStock(stockInfo)
}

/**
 * 处理删除监控股票
 */
const handleRemoveStock = ({ index, stockCode }) => {
  // 支持按索引或股票代码删除
  if (typeof index === 'number') {
    stockMonitor.removeStockByIndex(index)
  } else if (stockCode) {
    stockMonitor.removeStock(stockCode)
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
    const stockCodeList = stockMonitor.stocks.value.map(stock => stock.code).filter(code => code && code !== stockCode)
    const trackingList = [stockCode, ...stockCodeList]

    jumpToQuote(stockCode, trackingList)
    ElMessage.success(`正在跳转到 ${stockCode} 分时图`)
  } catch (error) {
    console.error('跳转分时图失败:', error)
    ElMessage.error('跳转分时图失败')
  }
}

/**
 * 处理策略切换
 */
const handleStrategyChange = (strategyId) => {
  console.log('切换策略:', strategyId)
  currentStrategy.value = strategyId

  // 切换策略
  strategyManager.switchStrategy(strategyId)

  ElMessage.info(`已切换到: ${strategyId}`)
}

/**
 * 策略执行回调 - 当策略自动执行时更新股票列表
 */
const onStrategyExecute = async (result) => {
  console.log('策略执行完成，结果:', result)

  if (result && result.stocks && Array.isArray(result.stocks)) {
    // 更新股票监控列表
    stockMonitor.stocks.value = result.stocks.map(stock => ({
      code: stock.code,
      name: stock.name,
      price: '--',
      changePercent: '--',
      limitUpReason: stock.reason_type || '--',
      source: 'strategy-auto',
      auction_change: stock.auction_change,
      close_change: stock.close_change
    }))

    ElMessage.success(`策略自动执行成功，筛选出 ${result.stocks.length} 只股票`)

    // 获取实时行情
    if (result.stocks.length > 0) {
      await stockMonitor.updateRealTimeData()
    }
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
  const position = positionData.value.find(p => p.证券代码 === stockCode)
  return parseInt(position?.实际数量 || 0)
}


/**
 * 加载本地数据
 */
const loadLocalData = async () => {
  // 加载可用金额（从缓存或API）
  await fetchBalanceData()
  
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
    const isTrading = await isInTradingTime()
    if (isTrading) {
      fetchMarketStats()
    }
  }, 30000)

  // 概念排行（1分钟）
  fetchConceptRanking()
  conceptRankingInterval = setInterval(async () => {
    const isTrading = await isInTradingTime()
    if (isTrading) {
      fetchConceptRanking()
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

  // 停止策略管理器
  strategyManager.stop()
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
  await handleRefreshStocks()

  // 获取持仓数据
  try {
    await fetchPositionData()
  } catch (error) {
    console.error('持仓数据加载失败:', error)
  }

  // 启动策略管理器
  console.log('启动策略管理器...')
  strategyManager.start(currentStrategy.value, onStrategyExecute)

  console.log('TradingMonkey 初始化完成')
})

onUnmounted(() => {
  cleanup()
  console.log('TradingMonkey 已清理')
})
</script>

<style scoped>
.trading-monkey-container {
  padding: 8px;
  min-height: 100vh;
  background: #f5f5f5;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.page-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}


@media (max-width: 1200px) {
  .trading-monkey-container {
    padding: 6px;
  }
  
  .page-title {
    font-size: 13px;
  }
}

@media (max-width: 768px) {
  .status-bar {
    padding: 6px 10px;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
  
  .page-title {
    font-size: 13px;
  }
}
</style>