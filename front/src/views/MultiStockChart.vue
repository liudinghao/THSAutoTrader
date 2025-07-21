<template>
  <div class="multi-stock-chart">
    <!-- 页面头部 -->
    <div class="header">
      <h2>可视化操盘</h2>
      <div class="header-controls">
        <el-date-picker
          v-model="currentDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYYMMDD"
          style="width: 150px; margin-right: 10px"
          @change="onDateChange"
        />
        <el-button 
          type="primary" 
          size="small" 
          :loading="isLoading"
          @click="refreshData"
        >
          <el-icon><Refresh /></el-icon>
          刷新数据
        </el-button>
      </div>
    </div>

    <!-- 股票选择器 -->
    <div class="stock-selector">
      <el-select
        v-model="newMarketId"
        placeholder="选择市场"
        style="width: 120px; margin-right: 10px"
      >
        <el-option 
          v-for="(name, id) in marketMap" 
          :key="id"
          :label="name" 
          :value="id" 
        />
      </el-select>
      <el-input
        v-model="newStockCode"
        placeholder="请输入股票代码"
        style="width: 200px; margin-right: 10px"
        @keyup.enter="addStock"
      />
      <el-input
        v-model="newStockName"
        placeholder="请输入股票名称"
        style="width: 200px; margin-right: 10px"
        @keyup.enter="addStock"
      />
      <el-button type="primary" @click="addStock">添加</el-button>
    </div>

    <!-- 图表容器 -->
    <div class="chart-container">
      <IntradayChart 
        :stock-data="stockList"
        :loading="isLoading"
        height="500px"
        @chartUpdate="onChartUpdate"
        ref="intradayChartRef"
      />
      <div v-if="isLoading" class="loading-overlay">
        <el-loading-spinner />
        <span>正在加载分时数据...</span>
      </div>
    </div>

    <!-- 股票列表 -->
    <div class="stock-list">
      <h3>监控标的</h3>
      <el-table :data="stockList" style="width: 100%">
        <el-table-column prop="marketName" label="市场" width="100" />
        <el-table-column prop="code" label="股票代码" width="120" />
        <el-table-column prop="name" label="股票名称" width="150" />
        <el-table-column prop="price" label="当前价格" width="100" />
        <el-table-column prop="change" label="涨跌幅" width="100">
          <template #default="scope">
            <span :class="getChangeClass(scope.row.change)">
              {{ scope.row.change > 0 ? '+' : '' }}{{ scope.row.change }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button
              type="danger"
              size="small"
              @click="removeStock(scope.$index)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { fetchMinuteData, getLatestTradeDate, isTradeTime } from '../utils/quoteApi'
import IntradayChart from '../components/IntradayChart.vue'
import { analyzeSellPoints } from '../strategies/sellPointAnalysis'

// ==================== 响应式数据 ====================
const intradayChartRef = ref(null)
const stockList = ref([]) // 股票列表
const isLoading = ref(false) // 加载状态
const currentDate = ref('') // 当前选择的日期
const refreshTimer = ref(null) // 定时刷新定时器
const isTradingTime = ref(false) // 是否在交易时间内

// 新增股票的表单数据
const newMarketId = ref('17') // 默认选择沪市A股
const newStockCode = ref('') // 股票代码输入
const newStockName = ref('') // 股票名称输入

// ==================== 常量定义 ====================
const STORAGE_KEY = 'multiStockChart_stockList' // localStorage 存储键

// 市场ID映射表
const marketMap = {
  '17': '沪市A股',
  '33': '深市A股', 
  '48': '概念',
  '177': '港股',
  '20': '港股基金'
}

// ==================== 股票管理功能 ====================

/**
 * 添加股票到监控列表
 */
const addStock = async () => {
  // 验证输入
  if (!newStockCode.value || !newMarketId.value) {
    ElMessage.warning('请选择市场并输入股票代码')
    return
  }
  
  const marketId = newMarketId.value
  const code = newStockCode.value.toUpperCase()
  
  // 检查是否已存在
  if (stockList.value.find(stock => stock.marketId === marketId && stock.code === code)) {
    ElMessage.warning('该股票已添加')
    return
  }

  // 创建新股票对象
  const userStockName = newStockName.value.trim()
  const finalStockName = userStockName || code
  
  const newStock = {
    marketId,
    marketName: marketMap[marketId],
    code,
    name: finalStockName,
    price: '0.00',
    change: '0.00',
    preClose: null, // 昨收价，将从API数据中获取
    minuteData: [] // 分时数据
  }
  
  // 添加到列表并保存
  stockList.value.push(newStock)
  newStockCode.value = ''
  newStockName.value = ''
  saveToLocalStorage()
  
  // 如果有日期，立即获取分时数据
  if (currentDate.value) {
    await fetchMinuteDataFromApi()
  }
}

/**
 * 从监控列表中移除股票
 * @param {number} index 股票在列表中的索引
 */
const removeStock = (index) => {
  stockList.value.splice(index, 1)
  saveToLocalStorage()
}

// ==================== 数据持久化 ====================

/**
 * 保存股票列表到 localStorage
 */
const saveToLocalStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stockList.value))
  } catch (error) {
    console.error('保存到 localStorage 失败:', error)
    ElMessage.error('保存数据失败')
  }
}

/**
 * 从 localStorage 加载股票列表
 */
const loadFromLocalStorage = () => {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY)
    if (savedData) {
      stockList.value = JSON.parse(savedData)
    }
  } catch (error) {
    console.error('从 localStorage 加载数据失败:', error)
    ElMessage.error('加载保存的数据失败')
  }
}

// ==================== 交易时间管理 ====================

/**
 * 检查是否在交易时间内
 * @returns {Promise<boolean>} 是否在交易时间
 */
const checkTradingTime = async () => {
  if (stockList.value.length === 0) {
    return false
  }
  
  try {
    // 使用第一只股票的代码检查交易时间
    const firstStock = stockList.value[0]
    const stockCode = `${firstStock.marketId}:${firstStock.code}`
    const result = await isTradeTime(firstStock.code)
    
    // API 返回 0 为非交易时间，非 0 为交易时间
    return result !== 0
  } catch (error) {
    console.error('检查交易时间失败:', error)
    return false
  }
}

// ==================== 定时刷新功能 ====================

/**
 * 启动定时刷新
 */
const startAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
  }
  
  refreshTimer.value = setInterval(async () => {
    const tradingTime = await checkTradingTime()
    isTradingTime.value = tradingTime
    
    if (tradingTime && stockList.value.length > 0) {
      try {
        await refreshMinuteDataOnly()
        console.log('定时刷新完成')
      } catch (error) {
        console.error('定时刷新数据失败:', error)
      }
    }
  }, 1000) // 每秒检查一次
}

/**
 * 停止定时刷新
 */
const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

// ==================== 数据获取和处理 ====================

/**
 * 处理API返回的分时数据，转换为应用所需格式
 * @param {Object} apiData API返回的原始数据
 * @param {Array} currentStockList 当前股票列表
 * @returns {Object} 处理结果 { updatedStockList, hasUpdates }
 */
const processMinuteData = (apiData, currentStockList) => {
  const updatedStockList = [...currentStockList]
  let hasUpdates = false
  
  updatedStockList.forEach((stock, index) => {
    const stockKey = `${stock.marketId}:${stock.code}`
    const stockData = apiData[stockKey]
    
    if (stockData) {
      // 转换数据格式
      const chartData = Object.entries(stockData).map(([timeStr, values]) => {
        return [timeStr, values.changePercent]
      })
      
      // 保存原始数据
      const rawData = {}
      Object.entries(stockData).forEach(([timeStr, values]) => {
        rawData[timeStr] = {
          NEW: values.NEW,
          JUNJIA: values.JUNJIA,
          VOL: parseFloat(values.VOL || 0),
          money: values.money,
          changePercent: values.changePercent,
          preClose: values.preClose
        }
      })
      
      // 从第一个时间点的数据中获取昨收价
      const firstTimeData = Object.values(stockData)[0]
      const preClose = firstTimeData?.preClose || null
      
      // 更新股票对象
      updatedStockList[index] = {
        ...stock,
        minuteData: chartData,
        rawData: rawData,
        preClose: preClose
      }
      
      // 更新最新价格和涨跌幅
      if (chartData.length > 0) {
        const latestTimeData = Object.values(stockData).pop()
        const latestPrice = parseFloat(latestTimeData?.NEW || latestTimeData?.JUNJIA || 0)
        const latestChange = chartData[chartData.length - 1][1]
        
        updatedStockList[index].price = latestPrice.toFixed(3)
        updatedStockList[index].change = latestChange.toFixed(2)
      }
      
      hasUpdates = true
    }
  })
  
  return { updatedStockList, hasUpdates }
}

/**
 * 仅刷新分时数据（用于定时刷新）
 */
const refreshMinuteDataOnly = async () => {
  if (stockList.value.length === 0 || !currentDate.value) return
  
  try {
    console.log('开始定时刷新分时数据...')
    const stockCodes = stockList.value.map(stock => `${stock.marketId}:${stock.code}`)
    const data = await fetchMinuteData(stockCodes, currentDate.value)
    
    if (data) {
      const { updatedStockList, hasUpdates } = processMinuteData(data, stockList.value)
      
      // 只有在有更新时才触发响应式更新
      if (hasUpdates) {
        stockList.value.splice(0, stockList.value.length, ...updatedStockList)
      }
    }
  } catch (error) {
    console.error('刷新分时数据失败:', error)
  }
}

/**
 * 获取分时数据（完整流程）
 */
const fetchMinuteDataFromApi = async () => {
  if (stockList.value.length === 0 || !currentDate.value) return
  
  try {
    isLoading.value = true
    
    const stockCodes = stockList.value.map(stock => `${stock.marketId}:${stock.code}`)
    const data = await fetchMinuteData(stockCodes, currentDate.value)
    console.log('data:',data)
    if (data) {
      const mainStock = stockList.value[0];
      const mainStockData = data[`${mainStock.marketId}:${mainStock.code}`];
      // 获取卖点
      const sellPoints = analyzeSellPoints(mainStockData)
      console.log('sellPoints:',sellPoints)
      const { updatedStockList } = processMinuteData(data, stockList.value)
      
      // 将卖点数据添加到主股票中
      if (updatedStockList.length > 0 && sellPoints.length > 0) {
        updatedStockList[0].sellPoints = sellPoints
      }
      
      // 触发响应式更新
      stockList.value.splice(0, stockList.value.length, ...updatedStockList)
    }
  } catch (error) {
    console.error('获取分时数据失败:', error)
    ElMessage.error('获取分时数据失败')
  } finally {
    isLoading.value = false
  }
}

// ==================== 事件处理 ====================

/**
 * 日期变化处理
 * @param {string} newDate 新选择的日期
 */
const onDateChange = async (newDate) => {
  if (newDate && stockList.value.length > 0) {
    console.log('日期已更改为:', newDate)
    await fetchMinuteDataFromApi()
  }
}

/**
 * 手动刷新数据
 */
const refreshData = async () => {
  if (stockList.value.length === 0) {
    ElMessage.warning('没有股票数据可刷新')
    return
  }
  
  if (!currentDate.value) {
    ElMessage.warning('请先选择日期')
    return
  }
  
  // 清空现有数据
  const updatedStockList = stockList.value.map(stock => ({
    ...stock,
    minuteData: [],
    rawData: {}
  }))
  
  stockList.value.splice(0, stockList.value.length, ...updatedStockList)
  
  await fetchMinuteDataFromApi()
  ElMessage.success('数据刷新成功')
}

/**
 * 图表更新回调
 * @param {Object} data 图表数据
 */
const onChartUpdate = (data) => {
  console.log('图表已更新:', data)
}

/**
 * 获取涨跌幅样式类名
 * @param {string|number} change 涨跌幅
 * @returns {string} CSS类名
 */
const getChangeClass = (change) => {
  const num = Number(change)
  if (num > 0) return 'positive-red'
  if (num < 0) return 'negative-green'
  return ''
}

// ==================== 生命周期钩子 ====================

onMounted(async () => {
  try {
    // 获取最近交易日并设置为当前日期
    const latestTradeDate = await getLatestTradeDate()
    currentDate.value = latestTradeDate
    console.log('初始化日期为最近交易日:', latestTradeDate)
  } catch (error) {
    console.error('获取最近交易日失败，使用当前日期:', error)
    currentDate.value = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  }
  
  // 加载保存的数据
  loadFromLocalStorage()
  
  // 如果有日期和股票数据，获取分时数据
  if (currentDate.value && stockList.value.length > 0) {
    await fetchMinuteDataFromApi()
  }
  
  // 启动定时刷新
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

// ==================== 监听器 ====================

watch(stockList, (newVal, oldVal) => {
  console.log('stockList 发生变化:', {
    newLength: newVal.length,
    oldLength: oldVal?.length,
    hasMinuteData: newVal.some(stock => stock.minuteData && stock.minuteData.length > 0)
  })
}, { deep: true })
</script>

<style scoped>
.multi-stock-chart {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  color: #333;
}

.stock-selector {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.chart-container {
  flex: 1;
  margin-bottom: 20px;
  position: relative;
}

.stock-list {
  flex-shrink: 0;
}

.stock-list h3 {
  margin-bottom: 10px;
  color: #333;
}

/* 涨跌幅样式 */
.positive-red {
  color: #f56c6c;
}

.negative-green {
  color: #67c23a;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
</style>