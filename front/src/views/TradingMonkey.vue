<template>
  <div class="trading-monkey">
    <el-card class="trading-card">
      <template #header>
        <div class="card-header">
          <span>交易猿 - 智能交易系统</span>
          <div class="status-area">
            <el-tag :type="connectionStatus ? 'success' : 'danger'">
              {{ connectionStatus ? '已连接' : '未连接' }}
            </el-tag>
            <el-button 
              size="small" 
              circle
              @click="checkHealth"
              title="刷新连接状态"
            >
              <i class="el-icon-refresh" />
            </el-button>
          </div>
        </div>
      </template>

      <!-- 监控股票列表 -->
      <div class="monitor-list">
        <div class="monitor-header">
          <span>监控股票</span>
          <div>
            <el-button size="small" @click="fetchStockPool" :loading="loading.stockPool">刷新</el-button>
            <el-button size="small" @click="addMonitorStock">添加监控</el-button>
          </div>
        </div>

        <el-table :data="monitorStocks" style="width: 100%" size="small" max-height="400">
          <el-table-column prop="code" label="代码" width="80">
            <template #default="scope">
              <span 
                class="clickable-stock-code" 
                @click="jumpToStockQuote(scope.row.code)"
                title="点击查看分时图"
              >
                {{ scope.row.code }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" width="100">
            <template #default="scope">
              <span 
                class="clickable-stock-name" 
                @click="jumpToStockQuote(scope.row.code)"
                title="点击查看分时图"
              >
                {{ scope.row.name }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="price" label="价格" width="80" />
          <el-table-column prop="changePercent" label="涨跌幅" width="80">
            <template #default="scope">
              <span :class="getChangeClass(scope.row.changePercent)">
                {{ scope.row.changePercent }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="涨停原因" width="120" />
          <el-table-column label="操作建议" width="100">
            <template #default="scope">
              <el-tooltip 
                :content="analysisResults[scope.row.code] ? '点击查看详细分析' : '暂无分析结果'"
                placement="top"
              >
                <el-button 
                  v-if="analysisResults[scope.row.code]"
                  size="small" 
                  type="success"
                  @click="showAnalysisResult(scope.row)"
                >
                  查看结论
                </el-button>
                <span v-else>--</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160">
            <template #default="scope">
              <div style="display: flex; gap: 5px;">
                <el-button 
                  size="small" 
                  type="primary"
                  @click="analyzeStock(scope.row)"
                  :loading="loading.analysis"
                  :disabled="loading.analysis"
                >
                  {{ loading.analysis ? '分析中...' : '分析' }}
                </el-button>
                <el-button 
                  size="small" 
                  type="danger" 
                  @click="removeMonitorStock(scope.$index)"
                >
                  删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 持仓股票 -->
      <div class="position-stocks">
        <div class="position-header">
          <span>持仓股票 (可用金额：{{ availableBalance }} 
            <el-button 
              size="small" 
              type="text" 
              @click="refreshBalance" 
              :loading="loading.balance"
              style="padding: 0; margin-left: 5px;"
            >
              刷新
            </el-button>
          )</span>
          <el-button size="small" @click="refreshPositionData" :loading="loading.position">刷新</el-button>
        </div>

        <el-table :data="positionData" style="width: 100%" size="small" max-height="200">
          <el-table-column prop="证券名称" label="名称" width="100">
            <template #default="scope">
              <span 
                class="clickable-stock-name" 
                @click="jumpToStockQuote(scope.row.证券代码)"
                title="点击查看分时图"
              >
                {{ scope.row.证券名称 }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="股票余额" label="余额" width="80" />
          <el-table-column prop="可用余额" label="可用" width="80" />
          <el-table-column prop="成本价" label="成本价" width="80" />
          <el-table-column prop="市价" label="市价" width="80" />
          <el-table-column prop="盈亏" label="盈亏" width="80">
            <template #default="scope">
              <span :class="getValueClass('盈亏', scope.row.盈亏)">{{ scope.row.盈亏 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="盈亏比例(%)" label="盈亏比例" width="80">
            <template #default="scope">
              <span :class="getValueClass('盈亏比例', scope.row['盈亏比例(%)'])">{{ scope.row['盈亏比例(%)'] }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="市值" label="市值" width="80" />
          <el-table-column label="操作建议" width="100">
            <template #default="scope">
              <el-tooltip 
                :content="analysisResults[scope.row.证券代码] ? '点击查看详细分析' : '暂无分析结果'"
                placement="top"
              >
                <el-button 
                  v-if="analysisResults[scope.row.证券代码]"
                  size="small" 
                  type="success"
                  @click="showAnalysisResult(scope.row, 'position')"
                >
                  查看结论
                </el-button>
                <span v-else>--</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button 
                size="small" 
                type="primary"
                @click="analyzeStock(scope.row)"
                :loading="loading.analysis"
                :disabled="loading.analysis"
              >
                {{ loading.analysis ? '分析中...' : '分析' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 添加监控股票对话框 -->
    <el-dialog v-model="monitorDialogVisible" title="添加监控股票" width="400px">
      <el-form :model="monitorForm" label-width="80px">
        <el-form-item label="股票代码">
          <el-input v-model="monitorForm.code" placeholder="请输入股票代码" />
        </el-form-item>
        <el-form-item label="股票名称">
          <el-input v-model="monitorForm.name" placeholder="请输入股票名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="monitorDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmAddMonitor">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 分析结果对话框 -->
    <AnalysisResultDialog
      v-model="analysisDialogVisible"
      :analysis-data="currentAnalysisData"
      :title="`${currentAnalysisData.stockName || '股票'} 分析报告`"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPositionData } from '../api/asset'
import axios from 'axios'
import { fetchRealTimeQuote, isTradeTime, jumpToQuote } from '../utils/quoteApi.js'
import { performStockAnalysis } from '../services/stockAnalysisService'
import { saveAnalysisResult, getAnalysisResult, getAllAnalysisResults } from '../utils/indexedDB'
import AnalysisResultDialog from '../components/AnalysisResultDialog.vue'

// 响应式数据
const connectionStatus = ref(false)
const monitorDialogVisible = ref(false)
const loading = ref({
  position: false,
  stockPool: false,
  analysis: false,
  balance: false
})
const analysisResults = ref({})
const analysisDialogVisible = ref(false)
const currentAnalysisData = ref({})
const availableBalance = ref('0.00')
let healthCheckInterval = null
let stockQuoteInterval = null
let quoteSessionId = null



// 监控表单
const monitorForm = reactive({
  code: '',
  name: ''
})

// 监控股票列表
const monitorStocks = ref([])

// 持仓数据
const positionData = ref([])



// 方法

// 跳转到股票分时图
const jumpToStockQuote = (stockCode) => {
  if (!stockCode) {
    ElMessage.warning('股票代码无效')
    return
  }
  
  try {
    // 获取所有监控股票的代码作为跟踪列表
    const stockCodeList = monitorStocks.value.map(stock => stock.code).filter(code => code && code !== stockCode)
    
    // 将当前股票添加到跟踪列表开头
    const trackingList = [stockCode, ...stockCodeList]
    
    // 调用jumpToQuote跳转到分时图
    jumpToQuote(stockCode, trackingList)
    ElMessage.success(`正在跳转到 ${stockCode} 分时图`)
  } catch (error) {
    console.error('跳转分时图失败:', error)
    ElMessage.error('跳转分时图失败')
  }
}

const addMonitorStock = () => {
  monitorDialogVisible.value = true
  monitorForm.code = ''
  monitorForm.name = ''
}

const confirmAddMonitor = () => {
  if (!monitorForm.code || !monitorForm.name) {
    ElMessage.warning('请填写完整的股票信息')
    return
  }

  monitorStocks.value.push({
    code: monitorForm.code,
    name: monitorForm.name,
    price: '0.00',
    change: '0.00',
    changePercent: '0.00'
  })

  monitorDialogVisible.value = false
  ElMessage.success('添加监控股票成功')
}

const removeMonitorStock = (index) => {
  monitorStocks.value.splice(index, 1)
  ElMessage.success('删除监控股票成功')
}

// 获取可用金额
const fetchBalanceData = async () => {
  if (loading.value.balance) return
  
  loading.value.balance = true
  try {
    const response = await axios.get('http://localhost:5000/balance')
    
    if (response.data.data && response.data.data['可用金额'] !== undefined) {
      const balance = parseFloat(response.data.data['可用金额']).toFixed(2)
      availableBalance.value = balance
      // 存储完整接口返回数据到available_balance键
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

// 刷新可用金额
const refreshBalance = async () => {
  await fetchBalanceData()
}

// 获取持仓数据
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

// 刷新持仓数据
const refreshPositionData = () => {
  fetchPositionData(true)
}

// 获取股票池数据
const fetchStockPool = async () => {
  if (loading.value.stockPool) return
  
  loading.value.stockPool = true
  try {
    const response = await axios.get('https://www.wttiao.com/moni/ztpool/dragonCallback')
    
    // 假设API返回的数据结构为 { data: [...] } 或 数组格式
    const stockData = response.data.data || response.data
    
    if (Array.isArray(stockData)) {
      monitorStocks.value = stockData.map(stock => ({
        code: stock.code,
        name: stock.name,
        price: '0.00',
        changePercent: '0.00',
        reason: stock.reason_type
      }))
      
      // 初始化完成后立即获取一次实时数据
      await fetchRealTimeStockData()
      
      // 然后启动定时更新
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

const getChangeClass = (change) => {
  const numValue = parseFloat(change)
  if (numValue > 0) return 'text-red'
  if (numValue < 0) return 'text-green'
  return ''
}

// 根据数值判断显示颜色
const getValueClass = (key, value) => {
  if (typeof value === 'string') {
    const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''))
    if (key.includes('盈亏') || key.includes('盈亏比')) {
      return numValue > 0 ? 'text-red' : numValue < 0 ? 'text-green' : ''
    }
  } else if (typeof value === 'number') {
    if (key.includes('盈亏') || key.includes('盈亏比')) {
      return value > 0 ? 'text-red' : value < 0 ? 'text-green' : ''
    }
  }
  return ''
}

// 检查健康状态
const checkHealth = async () => {
  try {
    const response = await axios.get('http://localhost:5000/health')
    connectionStatus.value = response.data.status === 'success'
  } catch (error) {
    console.error('健康检查失败:', error)
    connectionStatus.value = false
  }
}

// 启动实时行情轮询
const startRealTimeQuotePolling = async () => {
  // 清理现有的轮询
  stopRealTimeQuotePolling()
  
  if (monitorStocks.value.length === 0) return
  
  try {
    // 检查是否在交易时间
    const isTrading = await isTradeTime('300033') // 使用示例股票代码
    if (!isTrading) {
      console.log('当前不在交易时间，跳过实时数据获取')
      return
    }
    
    // 立即获取一次实时数据
    await fetchRealTimeStockData()
    
    // 设置每秒轮询
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

// 获取实时股票数据
const fetchRealTimeStockData = async () => {
  try {
    const stockCodes = monitorStocks.value.map(stock => stock.code)
    if (stockCodes.length === 0) return
    
    const realTimeData = await fetchRealTimeQuote(stockCodes)
    
    // 更新股票数据
    monitorStocks.value = monitorStocks.value.map(stock => {
      const quoteData = realTimeData[stock.code]
      if (quoteData) {
        return {
          ...stock,
          price: parseFloat(quoteData.NEW || 0).toFixed(2),
          changePercent: parseFloat(quoteData.ZHANGDIEFU || 0).toFixed(2)
        }
      }
      return stock
    })
  } catch (error) {
    console.error('获取实时股票数据失败:', error)
  }
}

// 分析股票
const analyzeStock = async (stock) => {
  const stockCode = stock.code || stock.证券代码
  const stockName = stock.name || stock.证券名称
  
  if (!stockCode) {
    ElMessage.warning('股票代码无效')
    return
  }

  // 设置加载状态
  loading.value.analysis = true
  ElMessage.info(`正在分析 ${stockName || stockCode}...`)
  
  try {
    // 使用股票分析服务，传入持仓数据
    const result = await performStockAnalysis(stockCode, stockName, {
      months: 6,
      recentDays: 30,
      recentMinutes: 30
    }, positionData.value)

    if (result.success) {
      // 保存分析结果到本地存储
      await saveAnalysisResult(stockCode, {
        analysis: result.analysis,
        timestamp: new Date().toISOString(),
        stockName: stockName || stockCode
      })
      
      // 更新本地状态
      analysisResults.value[stockCode] = {
        analysis: result.analysis,
        timestamp: new Date().toISOString(),
        stockName: stockName || stockCode
      }
      
      // 分析完成后立即展示结果
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
    // 清除加载状态
    loading.value.analysis = false
  }
}

// 显示分析结果
const showAnalysisResult = async (stock, type = 'monitor') => {
  const stockCode = stock.code || stock.证券代码
  const stockName = stock.name || stock.证券名称
  
  try {
    let result = analysisResults.value[stockCode]
    
    if (!result) {
      // 从本地存储获取
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

// 加载本地存储的可用金额
const loadStoredBalance = () => {
  try {
    const storedData = localStorage.getItem('available_balance')
    if (storedData) {
      const data = JSON.parse(storedData)
      availableBalance.value = data['可用金额'] ? parseFloat(data['可用金额']).toFixed(2) : '0.00'
    }
  } catch (error) {
    console.error('加载本地存储的可用金额失败:', error)
  }
}

// 加载所有已保存的分析结果
const loadAnalysisResults = async () => {
  try {
    // 获取所有保存的分析结果
    const allResults = await getAllAnalysisResults()
    analysisResults.value = allResults
    console.log('已加载分析结果:', Object.keys(allResults).length, '条')
    
    // 确保视图更新
    await nextTick()
  } catch (error) {
    console.error('加载分析结果失败:', error)
  }
}

// 停止实时行情轮询
const stopRealTimeQuotePolling = () => {
  if (stockQuoteInterval) {
    clearInterval(stockQuoteInterval)
    stockQuoteInterval = null
  }
}

// 生命周期
onMounted(async () => {
  // 检查连接状态
  await checkHealth()
  
  // 设置定时检查连接状态（每30秒检查一次）
  healthCheckInterval = setInterval(() => {
    checkHealth()
  }, 30000)
  
  // 先加载本地存储的可用金额
  loadStoredBalance()
  
  // 先加载已保存的分析结果（确保数据先行）
  await loadAnalysisResults()
  
  // 获取股票池数据
  await fetchStockPool()
  
  // 获取持仓数据
  try {
    await fetchPositionData()
    // 持仓数据加载完成后再刷新一次分析结果
    await loadAnalysisResults()
    // 加载可用金额（仅在本地没有时才从接口获取）
    if (!localStorage.getItem('available_balance')) {
      await fetchBalanceData()
    }
  } catch (error) {
    console.error('持仓数据加载失败:', error)
  }
})

onUnmounted(() => {
  // 清理定时器
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
  }
  
  // 停止实时行情轮询
  stopRealTimeQuotePolling()
})
</script>

<style scoped>
.trading-monkey {
  padding: 20px;
}

.trading-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.monitor-panel {
  height: 100%;
}

.monitor-list,
.position-stocks {
  margin-bottom: 20px;
}

.monitor-list {
  height: 450px;
  overflow: hidden;
}

.monitor-header,
.position-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: bold;
}

.text-success {
  color: #67c23a;
}

.text-danger {
  color: #f56c6c;
}

.text-red {
  color: #f56c6c;
}

.text-green {
  color: #67c23a;
}

.clickable-stock-code,
.clickable-stock-name {
  cursor: pointer;
  color: #1890ff;
  text-decoration: underline;
  transition: color 0.2s;
}

.clickable-stock-code:hover,
.clickable-stock-name:hover {
  color: #40a9ff;
  text-decoration: underline;
}

.clickable-stock-code:active,
.clickable-stock-name:active {
  color: #096dd9;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
:deep(.stock-analysis-result-dialog) {
  width: 800px !important;
}

:deep(.analysis-result-container) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  line-height: 1.6;
  color: #333;
}

:deep(.analysis-header) {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f0f0f0;
}

:deep(.analysis-header h2) {
  margin: 0 0 8px 0;
  color: #1890ff;
  font-size: 24px;
}

:deep(.analysis-meta) {
  color: #666;
  font-size: 14px;
}

:deep(.analysis-content) {
  max-height: 600px;
  overflow-y: auto;
  padding: 0 8px;
}

:deep(.analysis-content h2) {
  color: #1a1a1a;
  margin: 24px 0 12px 0;
  font-size: 20px;
  border-left: 4px solid #1890ff;
  padding-left: 12px;
}

:deep(.analysis-content h3) {
  color: #262626;
  margin: 20px 0 10px 0;
  font-size: 18px;
}

:deep(.analysis-content h4) {
  color: #595959;
  margin: 16px 0 8px 0;
  font-size: 16px;
}

:deep(.analysis-content strong) {
  color: #d48806;
  font-weight: 600;
}

:deep(.analysis-content em) {
  color: #722ed1;
  font-style: italic;
}

:deep(.analysis-code) {
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 12px;
  margin: 8px 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}

:deep(.analysis-inline-code) {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #d4380d;
}

:deep(.analysis-content ul) {
  margin: 8px 0;
  padding-left: 24px;
}

:deep(.analysis-content li) {
  margin: 4px 0;
  color: #595959;
}

:deep(.analysis-content br) {
  margin: 4px 0;
}

:deep(.analysis-table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 14px;
}

:deep(.analysis-table th) {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: #262626;
}

:deep(.analysis-table td) {
  border: 1px solid #f0f0f0;
  padding: 8px 12px;
  color: #595959;
}

:deep(.analysis-quote) {
  border-left: 4px solid #1890ff;
  padding: 12px 16px;
  margin: 12px 0;
  background: #f6ffed;
  color: #52c41a;
  font-style: italic;
}

:deep(.analysis-divider) {
  border: none;
  border-top: 1px solid #e8e8e8;
  margin: 16px 0;
}

:deep(.analysis-link) {
  color: #1890ff;
  text-decoration: none;
}

:deep(.analysis-link:hover) {
  text-decoration: underline;
}

</style> 