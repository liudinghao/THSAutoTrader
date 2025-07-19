<template>
  <div class="multi-stock-chart">
    <div class="header">
      <h2>叠加分时图</h2>
      <div class="header-controls">
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

    <div class="stock-list">
      <h3>已添加的股票</h3>
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
import { fetchMinuteData, fetchRealTimeQuote } from '../utils/quoteApi'
import IntradayChart from '../components/IntradayChart.vue'

const intradayChartRef = ref(null)
const newMarketId = ref('17')
const newStockCode = ref('')
const newStockName = ref('')
const stockList = ref([])
const chartData = ref({})
const isLoading = ref(false)
const preCloseCache = ref(new Map()) // 缓存昨收价
const refreshTimer = ref(null) // 定时刷新定时器
const isTradingTime = ref(false) // 是否在交易时间内

// localStorage 相关常量
const STORAGE_KEY = 'multiStockChart_stockList'

// 市场ID映射
const marketMap = {
  '17': '沪市A股',
  '33': '深市A股', 
  '48': '概念',
  '177': '港股',
  '20': '港股基金'
}

// 预定义的颜色池 - 确保颜色足够丰富且易于区分
const colorPool = ['#FF6B6B', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#FF8E8E', '#6BCFCF', '#5BC0DE', '#A8CF', '#FFD93D', '#E6B4', '#B8E0', '#FFB6',
  '#FF69B4', '#20AA', '#4682B4', '#3232', '#FFD700', '#9370DB', '#3CB371', '#FF6347',  '#00D1', '#4169E1', '#8FBC8', '#FF450', '#DA70D6', '#00FF', '#FF1493', '#191970', '#FF7F50', '#6495ED', '#DC143', '#009A', '#FF69B4', '#1E90FF', '#FF6347', '#32D32',
  '#FF8C0', '#8A2BE2', '#007', '#FF1493', '#00FF', '#FF450', '#3232', '#FF69B4'
]

// 已使用的颜色集合，用于避免重复
const usedColors = new Set()


const addStock = async () => {
  if (!newStockCode.value || !newMarketId.value) {
    ElMessage.warning('请选择市场并输入股票代码')
    return
  }
  
  const marketId = newMarketId.value
  const code = newStockCode.value.toUpperCase()
  const stockKey = `${marketId}_${code}`
  
  if (stockList.value.find(stock => stock.marketId === marketId && stock.code === code)) {
    ElMessage.warning('该股票已添加')
    return
  }

  // 优先使用用户输入的名称，如果没有则使用模拟数据或股票代码
  const userStockName = newStockName.value.trim()
  const stockInfo = { name: userStockName || code, color: getColorByIndex(stockList.value.length) }
  const finalStockName = userStockName || stockInfo.name
  
  const newStock = {
    marketId,
    marketName: marketMap[marketId],
    code,
    name: finalStockName,
    price: '0.00',
    change: '0.00',
    preClose: null, // 昨收价
    color: stockInfo.color,
    minuteData: []
  }
  
  stockList.value.push(newStock)
  newStockCode.value = ''
  newStockName.value = ''
  saveToLocalStorage()
  
  // 获取新添加股票的分时数据
  await fetchMinuteDataFromApi()
  // 数据更新后，IntradayChart 的 watch 会自动触发更新
}

const removeStock = (index) => {
  stockList.value.splice(index,1)
  // 重新分配颜色以确保顺序正确
  ensureStockColors()
  saveToLocalStorage()
  // 数据更新后，IntradayChart 的 watch 会自动触发更新
}



// 按顺序分配颜色
const getColorByIndex = (index) => {
  return colorPool[index % colorPool.length]
}

// 保存数据到 localStorage
const saveToLocalStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stockList.value))
  } catch (error) {
    console.error('保存到 localStorage 失败:', error)
    ElMessage.error('保存数据失败')
  }
}

// 从 localStorage 加载数据
const loadFromLocalStorage = () => {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY)
    if (savedData) {
      stockList.value = JSON.parse(savedData)
      // 确保所有股票都有正确的颜色
      ensureStockColors()
    }
  } catch (error) {
    console.error('从 localStorage 加载数据失败:', error)
    ElMessage.error('加载保存的数据失败')
  }
}

// 确保所有股票都有正确的颜色分配
const ensureStockColors = () => {
  stockList.value.forEach((stock, index) => {
    stock.color = getColorByIndex(index)
  })
}

// 判断是否在交易时间内
const checkTradingTime = () => {
  const now = new Date()
  const currentTime = now.getHours() * 100 + now.getMinutes()
  
  // 判断是否为工作日（周一到周五）
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5
  // 判断是否在交易时间内
  const isMorningSession = currentTime >= 930 && currentTime <= 1130
  const isAfternoonSession = currentTime >= 1300 && currentTime <= 1500
  return isWeekday && (isMorningSession || isAfternoonSession)
}

// 定时刷新分时数据
const startAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
  }
  
  refreshTimer.value = setInterval(async () => {
    const tradingTime = checkTradingTime()
    isTradingTime.value = tradingTime
    
    if (tradingTime && stockList.value.length > 0) {
      try {
        // 只刷新分时数据，不重新获取昨收价
        await refreshMinuteDataOnly()
        
        // 数据更新后，IntradayChart 的 watch 会自动触发更新，无需手动调用
        console.log('定时刷新完成，等待图表自动更新')
      } catch (error) {
        console.error('定时刷新数据失败:', error)
      }
    }
  }, 1000)
}

// 停止定时刷新
const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

// 只刷新分时数据，不重新获取昨收价
const refreshMinuteDataOnly = async () => {
  if (stockList.value.length === 0) return
  
  try {
    console.log('开始定时刷新分时数据...')
    // 将股票对象数组转换为股票代码数组
    const stockCodes = stockList.value.map(stock => `${stock.marketId}:${stock.code}`)
    const data = await fetchMinuteData(stockCodes, '20250718')
    console.log('获取到的分时数据:', data)
    
    if (data) {
      // 创建新的股票列表来触发响应式更新
      const updatedStockList = [...stockList.value]
      let hasUpdates = false
      
      updatedStockList.forEach((stock, index) => {
        const stockKey = `${stock.marketId}:${stock.code}`
        const stockData = data[stockKey]
        
        if (stockData) {
          console.log(`更新股票 ${stock.code} 的分时数据:`, stockData)
          
          // 先按时间戳排序，确保数据按时间顺序处理
          const sortedEntries = Object.entries(stockData).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          
          // 转换数据格式为 ECharts 需要的格式，使用涨跌幅作为Y轴数据
          const chartData = sortedEntries.map(([timestamp, values]) => {
            // 将时间戳转换为时分字符串，格式为 HH:mm:00（与时间轴格式保持一致）
            const date = new Date(parseInt(timestamp) * 1000)
            const hours = date.getHours().toString().padStart(2, '0')
            const minutes = date.getMinutes().toString().padStart(2, '0')
            const timeStr = `${hours}:${minutes}:00` // 统一使用 HH:mm:00
            
            const currentPrice = parseFloat(values.NEW || values.JUNJIA || 0)
            const preClose = stock.preClose || preCloseCache.value.get(stockKey)
            
            // 计算涨跌幅
            let changePercent = 0
            if (preClose && preClose > 0) {
              changePercent = ((currentPrice - preClose) / preClose) * 100
            }
            
            return [
              timeStr, // 使用时分字符串，格式为 HH:mm:00
              parseFloat(changePercent.toFixed(2)) // 涨跌幅作为Y轴数据
            ]
          })
          
          // 保存原始数据用于计算均价线等
          const rawData = {}
          sortedEntries.forEach(([timestamp, values]) => {
            const date = new Date(parseInt(timestamp) * 1000)
            const hours = date.getHours().toString().padStart(2, '0')
            const minutes = date.getMinutes().toString().padStart(2, '0')
            const timeStr = `${hours}:${minutes}:00`
            
            rawData[timeStr] = {
              NEW: values.NEW,
              JUNJIA: values.JUNJIA,
              VOL: parseFloat(values.VOL || 0), // API 已经计算好的成交量
              money: values.money
            }
          })
          
          // 更新股票对象
          updatedStockList[index] = {
            ...stock,
            minuteData: chartData,
            rawData: rawData
          }
          
          // 更新股票的最新价格和涨跌幅
          if (chartData.length > 0) {
            // 从分时数据中获取最新价格
            const latestTimeData = Object.values(stockData).pop()
            const latestPrice = parseFloat(latestTimeData?.NEW || latestTimeData?.JUNJIA || 0)
            const latestChange = chartData[chartData.length - 1][1]
            
            updatedStockList[index].price = latestPrice.toFixed(3)
            updatedStockList[index].change = latestChange.toFixed(2)
            console.log(`股票 ${stock.code} 更新价格: ${updatedStockList[index].price}, 涨跌幅: ${updatedStockList[index].change}%`)
          }
          
          console.log(`股票 ${stock.code} 转换后的分时数据:`, chartData.slice(0, 3))
          hasUpdates = true
        }
      })
      
      // 只有在有更新时才强制更新股票列表以触发响应式更新
      if (hasUpdates) {
        stockList.value.splice(0, stockList.value.length, ...updatedStockList)
        console.log('股票列表已更新，触发响应式更新')
      }
    }
  } catch (error) {
    console.error('刷新分时数据失败:', error)
  }
}

// 获取昨收价
const fetchPreClose = async (stockList) => {
  if (stockList.length === 0) return
  
  try {
    const stockCodes = stockList.map(stock => `${stock.marketId}:${stock.code}`)
    const realTimeData = await fetchRealTimeQuote(stockCodes)
    
    stockList.forEach(stock => {
      const stockKey = `${stock.marketId}:${stock.code}`
      const stockData = realTimeData[stockKey]
      
      if (stockData && stockData.PRE) {
        const preClose = parseFloat(stockData.PRE)
        stock.preClose = preClose
        // 缓存昨收价，键为 marketId:code
        preCloseCache.value.set(stockKey, preClose)
      }
    })
  } catch (error) {
    console.error('获取昨收价失败:', error)
  }
}

// 获取真实分时数据
const fetchMinuteDataFromApi = async () => {
  if (stockList.value.length === 0) return
  
  try {
    isLoading.value = true
    
    // 首先获取昨收价
    await fetchPreClose(stockList.value)
    
    // 将股票对象数组转换为股票代码数组
    const stockCodes = stockList.value.map(stock => `${stock.marketId}:${stock.code}`)
    const data = await fetchMinuteData(stockCodes, '20250718')
    // 处理返回的数据
    if (data) {
      // 创建新的股票列表来触发响应式更新
      const updatedStockList = [...stockList.value]
      
      updatedStockList.forEach((stock, index) => {
        const stockKey = `${stock.marketId}:${stock.code}`
        const stockData = data[stockKey]
        
        if (stockData) {
          // 转换数据格式为 ECharts 需要的格式，同时保留原始数据
          const chartData = []
          const rawData = {}
          
          // 先按时间戳排序，确保数据按时间顺序处理
          const sortedEntries = Object.entries(stockData).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          
          sortedEntries.forEach(([timestamp, values], index) => {
            // 将时间戳转换为时分字符串，格式为 HH:mm:00（与时间轴格式保持一致）
            const date = new Date(parseInt(timestamp) * 1000)
            const hours = date.getHours().toString().padStart(2, '0')
            const minutes = date.getMinutes().toString().padStart(2, '0')
            const timeStr = `${hours}:${minutes}:00`
            
            const currentPrice = parseFloat(values.NEW || values.JUNJIA || 0)
            const preClose = stock.preClose || preCloseCache.value.get(stockKey)
            
            // 计算涨跌幅
            let changePercent = 0
            if (preClose && preClose > 0) {
              changePercent = ((currentPrice - preClose) / preClose) * 100
            }
            
            chartData.push([
              timeStr, // 使用时分字符串，格式为 HH:mm:00
              parseFloat(changePercent.toFixed(2)) // 涨跌幅作为Y轴数据
            ])
            
            // 保存原始数据用于计算均价线等，API 已经计算好的成交量
            rawData[timeStr] = {
              NEW: values.NEW,
              JUNJIA: values.JUNJIA,
              VOL: parseFloat(values.VOL || 0), // API 已经计算好的成交量
              money: values.money
            }
          })
          
          // 按时间排序
          chartData.sort((a, b) => new Date(`2025/01/01 ${a[0]}`) - new Date(`2025/01/01 ${b[0]}`))
          
          // 更新股票对象
          updatedStockList[index] = {
            ...stock,
            minuteData: chartData,
            rawData: rawData
          }
          
          // 更新股票的最新价格和涨跌幅
          if (chartData.length > 0) {
            // 从分时数据中获取最新价格
            const latestTimeData = Object.values(stockData).pop()
            const latestPrice = parseFloat(latestTimeData?.NEW || latestTimeData?.JUNJIA || 0)
            const latestChange = chartData[chartData.length - 1][1]
            
            updatedStockList[index].price = latestPrice.toFixed(3)
            updatedStockList[index].change = latestChange.toFixed(2)
          }
        }
      })
      
      // 强制更新股票列表以触发响应式更新
      stockList.value.splice(0, stockList.value.length, ...updatedStockList)
      console.log('fetchMinuteData: 股票列表已更新，触发响应式更新')
    }
  } catch (error) {
    console.error('获取分时数据失败:', error)
    ElMessage.error('获取分时数据失败')
  } finally {
    isLoading.value = false
  }
}


// 刷新所有股票的分时数据
const refreshData = async () => {
  if (stockList.value.length === 0) {
    ElMessage.warning('没有股票数据可刷新')
    return
  }
  
  // 创建新的股票列表，清空分时数据
  const updatedStockList = stockList.value.map(stock => ({
    ...stock,
    minuteData: [],
    rawData: {}
  }))
  
  // 更新股票列表
  stockList.value.splice(0, stockList.value.length, ...updatedStockList)
  
  await fetchMinuteDataFromApi()
  // 数据更新后，IntradayChart 的 watch 会自动触发更新
  ElMessage.success('数据刷新成功')
}

// 图表更新回调
const onChartUpdate = (data) => {
  console.log('图表已更新:', data)
}

function getChangeClass(change) {
  const num = Number(change)
  if (num > 0) return 'positive-red'
  if (num < 0) return 'negative-green'
  return ''
}

onMounted(async () => {
  // 首先加载保存的数据
  loadFromLocalStorage()
  
  // 如果有保存的股票数据，获取分时数据
  if (stockList.value.length > 0) {
    await fetchMinuteDataFromApi()
  }
  
  startAutoRefresh() // 启动定时刷新
})

onUnmounted(() => {
  stopAutoRefresh() // 卸载时停止定时刷新
})

watch(stockList, (newVal, oldVal) => {
  console.log('stockList 发生变化:', {
    newLength: newVal.length,
    oldLength: oldVal?.length,
    hasMinuteData: newVal.some(stock => stock.minuteData && stock.minuteData.length > 0)
  })
  // IntradayChart 会自动响应数据变化，无需手动更新
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

.controls {
  display: flex;
  gap: 10px;
}

.stock-selector {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.chart-container {
  flex: 1;
  margin-bottom: 20px;
}


.stock-list {
  flex-shrink: 0;
}

.stock-list h3 {
  margin-bottom: 10px;
  color: #333;
}

.positive {
  color: #67c23a;
}

.negative {
  color: #f56c6c;
}

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

.chart-container {
  position: relative;
}
</style> 