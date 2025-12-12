<template>
  <div class="backtest-container">
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <el-icon size="32" color="#409eff">
            <TrendCharts />
          </el-icon>
        </div>
        <div class="header-text">
          <h2>集合竞价回测</h2>
          <p class="page-description">基于历史数据验证集合竞价选股策略的有效性</p>
        </div>
      </div>
    </div>

    <div class="controls-section">
      <div class="controls-card">
        <div class="card-header">
          <el-icon size="16" color="#606266">
            <Calendar />
          </el-icon>
          <span class="card-title">回测配置</span>
        </div>
        <div class="card-content">
          <div class="form-row">
            <label class="form-label">回测日期</label>
            <div class="form-controls">
              <el-date-picker
                v-model="selectedDate"
                type="date"
                placeholder="选择回测日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                @change="onDateChange"
                :disabled="loading"
                size="default"
              />
              <el-button
                type="primary"
                @click="fetchBacktestData"
                :loading="loading"
                :disabled="!selectedDate"
                size="default"
              >
                <template #icon>
                  <el-icon><Search /></el-icon>
                </template>
                {{ loading ? '分析中...' : '开始回测' }}
              </el-button>
            </div>
          </div>
          <div class="strategy-info">
            <el-tag type="info" size="small">策略：集合竞价选股</el-tag>
            <el-tag type="warning" size="small">条件：竞价涨跌幅 3%-5%</el-tag>
          </div>
        </div>
      </div>
    </div>

    <div class="results-section" v-if="stockList.length > 0 || loading">
      <div class="results-card">
        <div class="results-header">
          <div class="results-title">
            <el-icon size="18" color="#409eff">
              <DataAnalysis />
            </el-icon>
            <h3>回测结果</h3>
          </div>
          <div class="header-actions">
            <el-button
              v-if="stockList.length > 0"
              type="success"
              @click="saveStockPickResults"
              :loading="saving"
              :disabled="saving"
              size="default"
              round
            >
              <template #icon>
                <el-icon><Download /></el-icon>
              </template>
              {{ saving ? '保存中...' : '保存选股结果' }}
            </el-button>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stockList.length }}</div>
            <div class="stat-label">符合条件股票</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ selectedDate || '--' }}</div>
            <div class="stat-label">回测日期</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">3%-5%</div>
            <div class="stat-label">竞价涨跌幅</div>
          </div>
          <div class="stat-card" v-if="successRate !== null">
            <div class="stat-value success-rate-value">{{ successRate }}%</div>
            <div class="stat-label">成功率 ({{ successCount }}/{{ validCount }})</div>
          </div>
        </div>
      </div>

      <div class="table-container">
        <el-table
          :data="stockList"
          :loading="loading"
          stripe
          height="600"
          class="stock-table"
          :header-cell-style="{ backgroundColor: '#f8f9fa', color: '#495057', fontWeight: '600' }"
          :row-style="{ cursor: 'default' }"
        >
        <el-table-column prop="code" label="股票" width="100">
          <template #default="{ row }">
            <div class="stock-info" @click="handleStockClick(row)" title="点击跳转到分时图">
              <div class="stock-code">{{ row.code }}</div>
              <div class="stock-name">{{ row.name }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="zsz" label="市值(亿)" width="90">
          <template #default="{ row }">
            {{ formatMarketCap(row.zsz) }}
          </template>
        </el-table-column>
        <el-table-column prop="reason_type" label="选股原因" width="auto">
          <template #default="{ row }">
            <div class="reason-text">
              {{ row.reason_type || '--' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="auction_change" label="竞价(%)" width="90">
          <template #default="{ row }">
            <span
              v-if="row.auction_change !== null && row.auction_change !== undefined"
              :class="getReturnClass(row.auction_change)"
            >
              {{ row.auction_change }}%
            </span>
            <span v-else class="no-data">--</span>
          </template>
        </el-table-column>
        <el-table-column prop="close_change" label="收盘涨幅" width="90">
          <template #default="{ row }">
            <span
              v-if="row.close_change !== null && row.close_change !== undefined"
              :class="getReturnClass(row.close_change)"
            >
              {{ row.close_change }}%
            </span>
            <span v-else class="no-data">--</span>
          </template>
        </el-table-column>
        <el-table-column prop="next_day_return" label="次日开盘" width="90">
          <template #default="{ row }">
            <span
              v-if="row.next_day_return !== null && row.next_day_return !== undefined"
              :class="getReturnClass(row.next_day_return)"
            >
              {{ row.next_day_return }}%
            </span>
            <span v-else class="no-data">--</span>
          </template>
        </el-table-column>
        <el-table-column prop="next_day_close" label="次日收盘" width="90">
          <template #default="{ row }">
            <span
              v-if="row.next_day_close !== null && row.next_day_close !== undefined"
              :class="getReturnClass(row.next_day_close)"
            >
              {{ row.next_day_close }}%
            </span>
            <span v-else class="no-data">--</span>
          </template>
        </el-table-column>
        <el-table-column prop="date" label="涨停日期" width="100" />
        </el-table>
      </div>
    </div>

    <div v-else-if="!loading && selectedDate" class="no-data-message">
      <el-empty description="该日期没有找到回测数据" />
    </div>

    <div v-else-if="!selectedDate" class="welcome-message">
      <el-empty description="请选择日期开始回测" />
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { TrendCharts, Calendar, Search, DataAnalysis, Download } from '@element-plus/icons-vue'
import { executeAuctionPreselect } from '@/strategies/auctionPreselect.js'
import { jumpToQuote } from '@/utils/quoteApi.js'
import axios from 'axios'

export default {
  name: 'Backtest',
  components: {
    TrendCharts,
    Calendar,
    Search,
    DataAnalysis,
    Download
  },
  setup() {
    const selectedDate = ref('')
    const loading = ref(false)
    const stockList = ref([])
    const saving = ref(false)

    // 成功率计算 - 收盘涨幅大于竞价涨幅
    const successStats = computed(() => {
      if (stockList.value.length === 0) {
        return {
          successCount: 0,
          validCount: 0,
          successRate: null
        }
      }

      // 筛选有效数据（同时有竞价涨幅和收盘涨幅的股票）
      const validStocks = stockList.value.filter(stock =>
        stock.auction_change !== null && stock.auction_change !== undefined &&
        stock.close_change !== null && stock.close_change !== undefined
      )

      const validCount = validStocks.length
      if (validCount === 0) {
        return {
          successCount: 0,
          validCount: 0,
          successRate: null
        }
      }

      // 计算成功的股票数量（收盘涨幅 > 竞价涨幅）
      const successCount = validStocks.filter(stock =>
        parseFloat(stock.close_change) > parseFloat(stock.auction_change)
      ).length

      const successRate = ((successCount / validCount) * 100).toFixed(1)

      return {
        successCount,
        validCount,
        successRate: parseFloat(successRate)
      }
    })

    // 提取计算属性的值供模板使用
    const successCount = computed(() => successStats.value.successCount)
    const validCount = computed(() => successStats.value.validCount)
    const successRate = computed(() => successStats.value.successRate)

    // 获取回测数据
    const fetchBacktestData = async () => {
      if (!selectedDate.value) {
        ElMessage.warning('请先选择日期')
        return
      }

      loading.value = true
      try {
        // 使用竞价选股策略执行回测
        const result = await executeAuctionPreselect({
          date: selectedDate.value,
          minChange: 3, // 最小竞价涨跌幅 3%
          maxChange: 5, // 最大竞价涨跌幅 5%
          onProgress: (message, progress) => {
            console.log(`[${progress}%] ${message}`)
          }
        })

        // 为股票列表添加次日收益字段（close_change已经在策略中计算）
        stockList.value = result.stocks.map(stock => ({
          ...stock,
          next_day_return: null, // 预留字段，后续计算
          next_day_close: null   // 次日收盘涨跌幅，预留字段
        }))

        ElMessage.success(
          `获取到 ${result.originalCount} 只股票，过滤后 ${result.filteredCount} 只符合3%-5%竞价涨跌幅条件`
        )
      } catch (error) {
        console.error('竞价选股策略执行失败:', error)
        ElMessage.error(`回测失败: ${error.message}`)
        stockList.value = []
      } finally {
        loading.value = false
      }
    }

    // 日期变化处理
    const onDateChange = (date) => {
      if (date) {
        // 自动查询数据
        fetchBacktestData()
      }
    }

    // 格式化市值
    const formatMarketCap = (value) => {
      if (value === null || value === undefined) return '--'
      const num = parseFloat(value)
      if (isNaN(num)) return '--'
      return (num / 100000000).toFixed(2) // 转换为亿元
    }


    // 获取收益率样式类
    const getReturnClass = (returnValue) => {
      const num = parseFloat(returnValue)
      if (isNaN(num)) return ''
      if (num > 0) return 'positive-return'
      if (num < 0) return 'negative-return'
      return 'zero-return'
    }

    // 处理股票点击事件，跳转到分时图
    const handleStockClick = (stock) => {
      try {
        // 第一个参数：当前点击的股票代码（不带市场ID）
        // 第二个参数：整个表格的所有股票代码数组
        const allStockCodes = stockList.value.map(item => item.code)

        jumpToQuote(stock.code, allStockCodes)

        ElMessage.success(`正在跳转到 ${stock.name}(${stock.code}) 的分时图`)
      } catch (error) {
        console.error('跳转分时图失败:', error)
        ElMessage.error('跳转分时图失败，请检查API连接')
      }
    }

    // 保存选股结果
    const saveStockPickResults = async () => {
      if (!stockList.value || stockList.value.length === 0) {
        ElMessage.warning('没有可保存的选股结果')
        return
      }

      if (!selectedDate.value) {
        ElMessage.warning('缺少回测日期信息')
        return
      }

      saving.value = true

      try {
        // 根据新的API接口格式转换数据
        const stockListData = stockList.value.map(stock => ({
          code: stock.code,
          name: stock.name,
          status: 0, // 固定值 0
          message: '集合竞价选股法',
          buy_point: stock.reason_type || '集合竞价买入' // 使用选股原因作为买入点，如果没有则使用默认值
        }))

        // 构造新的请求数据结构
        const requestData = {
          date: selectedDate.value,
          type: 2, // 固定值 2
          stockList: stockListData
        }

        // 调用保存API
        const response = await axios.post('https://www.wttiao.com/moni/ztpool/stock-pick/batch', requestData, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10秒超时
        })

        if (response.status === 200) {
          ElMessage.success(`成功保存 ${stockListData.length} 只股票的选股结果`)
        } else {
          throw new Error(`API返回状态码: ${response.status}`)
        }
      } catch (error) {
        console.error('保存选股结果失败:', error)

        if (error.code === 'ECONNREFUSED') {
          ElMessage.error('连接失败：请确保后端服务运行在 localhost:3000')
        } else if (error.message.includes('timeout')) {
          ElMessage.error('保存超时，请稍后重试')
        } else if (error.response) {
          ElMessage.error(`保存失败：${error.response.data?.message || error.response.statusText}`)
        } else {
          ElMessage.error(`保存失败：${error.message}`)
        }
      } finally {
        saving.value = false
      }
    }

    return {
      selectedDate,
      loading,
      stockList,
      saving,
      successCount,
      validCount,
      successRate,
      fetchBacktestData,
      onDateChange,
      formatMarketCap,
      getReturnClass,
      handleStockClick,
      saveStockPickResults
    }
  }
}
</script>

<style scoped>
.backtest-container {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.page-header {
  margin-bottom: 32px;
  padding: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: white;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  background: rgba(255, 255, 255, 0.2);
  padding: 12px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.header-text h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
  color: white;
}

.page-description {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  opacity: 0.9;
}

.controls-section {
  margin-bottom: 24px;
}

.controls-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.form-label {
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  min-width: 80px;
}

.form-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.strategy-info {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.results-section {
  margin-bottom: 24px;
}

.results-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.05);
  margin-bottom: 16px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.results-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.results-title h3 {
  margin: 0;
  color: #303133;
  font-size: 20px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 8px;
}

.success-rate-value {
  color: #67c23a;
}

.stat-label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.table-container {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.04);
}

.stock-table {
  width: 100%;
}

:deep(.el-table) {
  border-radius: 0;
  border: none;
}

:deep(.el-table__header-wrapper) {
  border-radius: 0;
}

:deep(.el-table__body-wrapper) {
  border-radius: 0;
}

:deep(.el-table tr) {
  background-color: transparent;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(0, 0, 0, 0.02);
}

:deep(.el-table td, .el-table th) {
  border-bottom: 1px solid #f0f0f0;
}

.reason-text {
  word-wrap: break-word;
  word-break: break-all;
  line-height: 1.4;
  color: #606266;
  font-size: 13px;
  padding: 4px 0;
}

.positive-return {
  color: #f56c6c;
  font-weight: 600;
  background: linear-gradient(135deg, rgba(245, 108, 108, 0.1) 0%, rgba(245, 108, 108, 0.05) 100%);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 13px;
}

.negative-return {
  color: #67c23a;
  font-weight: 600;
  background: linear-gradient(135deg, rgba(103, 194, 58, 0.1) 0%, rgba(103, 194, 58, 0.05) 100%);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 13px;
}

.zero-return {
  color: #909399;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(144, 147, 153, 0.1);
  font-size: 13px;
}

.no-data {
  color: #c0c4cc;
  font-style: italic;
}

/* 股票信息样式 */
.stock-info {
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.05) 0%, rgba(64, 158, 255, 0.02) 100%);
  border: 1px solid rgba(64, 158, 255, 0.1);
}

.stock-info:hover {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.15) 0%, rgba(64, 158, 255, 0.08) 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
  border-color: rgba(64, 158, 255, 0.3);
}

.stock-info:active {
  transform: translateY(0);
}

.stock-code {
  color: #409eff;
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 2px;
  letter-spacing: 0.5px;
}

.stock-name {
  color: #606266;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 500;
}

.stock-info:hover .stock-code {
  color: #66b1ff;
  text-decoration: underline;
}

.stock-info:hover .stock-name {
  color: #409eff;
}

.no-data-message,
.welcome-message {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.el-empty__description p) {
  color: #606266;
  font-size: 16px;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .backtest-container {
    padding: 16px;
  }

  .page-header {
    padding: 24px;
    margin-bottom: 24px;
  }

  .header-content {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }

  .header-text h2 {
    font-size: 24px;
  }

  .controls-card,
  .results-card {
    padding: 20px;
  }

  .form-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .form-label {
    min-width: auto;
  }

  .form-controls {
    width: 100%;
    flex-direction: column;
    gap: 12px;
  }

  .form-controls .el-date-editor,
  .form-controls .el-button {
    width: 100%;
  }

  .strategy-info {
    flex-direction: column;
    gap: 8px;
  }

  .results-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .el-button {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-value {
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .backtest-container {
    padding: 12px;
  }

  .page-header {
    padding: 20px;
  }

  .header-text h2 {
    font-size: 20px;
  }

  .page-description {
    font-size: 14px;
  }

  .controls-card,
  .results-card {
    padding: 16px;
  }
}
</style>