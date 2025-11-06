/**
 * 股票监控状态管理 Composable
 * 集中管理监控股票的状态和操作逻辑
 */
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { dataSourceService } from '../services/dataSourceService.js'
import { fetchRealTimeQuote, isTradeTime } from '../../../utils/quoteApi.js'

export function useStockMonitor() {
  // 状态
  const stocks = ref([])
  const loading = ref({
    fetch: false,
    realTime: false
  })
  
  // 计算属性
  const stockCodes = computed(() => stocks.value.map(stock => stock.code))
  const hasStocks = computed(() => stocks.value.length > 0)
  
  /**
   * 获取股票池数据
   */
  const fetchStocks = async () => {
    if (loading.value.fetch) return
    
    loading.value.fetch = true
    try {
      console.log('开始获取监控股票数据...')
      
      const stockData = await dataSourceService.getStockData()
      
      if (Array.isArray(stockData)) {
        stocks.value = stockData.map(stock => ({
          code: stock.code,
          name: stock.name,
          price: stock.price || '--',
          changePercent: stock.changePercent || '--',
          limitUpReason: stock.limitUpReason || '--',
          source: stock.source || 'auction-strategy',
          marketId: stock.marketId
        }))
        return true
      } else {
        ElMessage.warning('获取股票池数据格式异常')
        return false
      }
    } catch (error) {
      console.error('获取股票池数据失败:', error)
      ElMessage.error(`获取股票池数据失败: ${error.message}`)
      return false
    } finally {
      loading.value.fetch = false
    }
  }
  
  /**
   * 更新实时股票数据
   */
  const updateRealTimeData = async () => {
    if (loading.value.realTime || stocks.value.length === 0) return

    loading.value.realTime = true
    try {
      const realTimeData = await fetchRealTimeQuote(stockCodes.value)

      // 优化：使用 Map 提高查找效率
      const realTimeMap = new Map(Object.entries(realTimeData))
      
      stocks.value = stocks.value.map(stock => {
        const quoteData = realTimeMap.get(stock.code)
        if (quoteData) {
          return {
            ...stock,
            price: parseFloat(quoteData.NEW || stock.price || 0).toFixed(2),
            changePercent: parseFloat(quoteData.ZHANGDIEFU || stock.changePercent || 0).toFixed(2)
          }
        }
        return stock
      })
      
      return realTimeData
    } catch (error) {
      console.error('获取实时股票数据失败:', error)
      return null
    } finally {
      loading.value.realTime = false
    }
  }
  
  /**
   * 添加监控股票
   */
  const addStock = (stockInfo) => {
    if (!stockInfo.code?.trim() || !stockInfo.name?.trim()) {
      ElMessage.warning('请填写完整的股票信息')
      return false
    }
    
    // 检查是否已存在
    const exists = stocks.value.some(stock => stock.code === stockInfo.code.trim())
    if (exists) {
      ElMessage.warning('该股票已在监控列表中')
      return false
    }
    
    // 添加到监控列表
    const newStock = {
      code: stockInfo.code.trim().toUpperCase(),
      name: stockInfo.name.trim(),
      price: '0.00',
      changePercent: '0.00',
      limitUpReason: '--',
      source: 'manual'
    }
    
    stocks.value = [...stocks.value, newStock]
    ElMessage.success('添加监控股票成功')
    return true
  }
  
  /**
   * 删除监控股票
   */
  const removeStock = (stockCode) => {
    const index = stocks.value.findIndex(stock => stock.code === stockCode)
    if (index === -1) {
      ElMessage.warning('股票不存在')
      return false
    }
    
    stocks.value = stocks.value.filter(stock => stock.code !== stockCode)
    ElMessage.success('删除监控股票成功')
    return true
  }
  
  /**
   * 根据索引删除监控股票（向后兼容）
   */
  const removeStockByIndex = (index) => {
    if (index < 0 || index >= stocks.value.length) {
      ElMessage.warning('无效的股票索引')
      return false
    }
    
    const removedStock = stocks.value[index]
    stocks.value = stocks.value.filter((_, i) => i !== index)
    ElMessage.success(`删除监控股票 ${removedStock.name} 成功`)
    return true
  }
  
  /**
   * 清空所有监控股票
   */
  const clearAllStocks = () => {
    stocks.value = []
    ElMessage.success('已清空所有监控股票')
  }
  
  /**
   * 检查是否为交易时间并更新实时数据
   */
  const updateIfTradingTime = async () => {
    try {
      const isTradingTime = await isTradeTime()
      if (isTradingTime) {
        return await updateRealTimeData()
      } else {
        console.log('当前不在交易时间，跳过实时数据更新')
        return null
      }
    } catch (error) {
      console.error('检查交易时间失败:', error)
      return null
    }
  }
  
  /**
   * 获取指定股票的当前价格
   */
  const getStockPrice = (stockCode) => {
    const stock = stocks.value.find(s => s.code === stockCode)
    return parseFloat(stock?.price || 0)
  }
  
  /**
   * 获取指定股票信息
   */
  const getStock = (stockCode) => {
    return stocks.value.find(s => s.code === stockCode)
  }
  
  return {
    // 状态 - 返回响应式引用
    stocks,
    loading,
    
    // 计算属性
    stockCodes,
    hasStocks,
    
    // 方法
    fetchStocks,
    updateRealTimeData,
    addStock,
    removeStock,
    removeStockByIndex,
    clearAllStocks,
    updateIfTradingTime,
    getStockPrice,
    getStock
  }
}