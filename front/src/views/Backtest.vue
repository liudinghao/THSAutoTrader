<template>
  <div class="backtest-container">
    <div class="page-header">
      <h2>集合竞价回测</h2>
      <p class="page-description">选择日期查看集合竞价预选股票的回测结果</p>
    </div>

    <div class="controls-section">
      <div class="date-picker-container">
        <label>选择回测日期：</label>
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          @change="onDateChange"
          :disabled="loading"
        />
        <el-button
          type="primary"
          @click="fetchBacktestData"
          :loading="loading"
          :disabled="!selectedDate"
        >
          查询
        </el-button>
      </div>
    </div>

    <div class="results-section" v-if="stockList.length > 0 || loading">
      <div class="results-header">
        <h3>回测结果</h3>
        <div class="stats">
          <span>符合条件: {{ stockList.length }} 只股票</span>
          <span v-if="selectedDate">回测日期: {{ selectedDate }}</span>
          <span>过滤条件: 竞价涨跌幅 3%-5%</span>
        </div>
      </div>

      <el-table
        :data="stockList"
        :loading="loading"
        stripe
        border
        height="600"
        class="stock-table"
      >
        <el-table-column prop="code" label="股票代码" width="120">
          <template #default="{ row }">
            <span
              class="clickable-stock-code"
              @click="handleStockClick(row)"
              title="点击跳转到分时图"
            >
              {{ row.code }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="股票名称" width="150">
          <template #default="{ row }">
            <span
              class="clickable-stock-name"
              @click="handleStockClick(row)"
              title="点击跳转到分时图"
            >
              {{ row.name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="zsz" label="总市值(亿)" width="120">
          <template #default="{ row }">
            {{ formatMarketCap(row.zsz) }}
          </template>
        </el-table-column>
        <el-table-column prop="reason_type" label="选股原因" min-width="200">
          <template #default="{ row }">
            <el-tag
              v-for="reason in parseReasons(row.reason_type)"
              :key="reason"
              class="reason-tag"
              size="small"
            >
              {{ reason }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="auction_change" label="竞价涨跌幅(%)" width="130">
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
        <el-table-column prop="close_change" label="当日收盘涨跌幅(%)" width="150">
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
        <el-table-column prop="next_day_return" label="次日开盘收益(%)" width="150">
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
        <el-table-column prop="date" label="最后涨停日期" width="120" />
      </el-table>
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
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { executeAuctionPreselect } from '@/strategies/auctionPreselect.js'
import { jumpToQuote } from '@/utils/quoteApi.js'

export default {
  name: 'Backtest',
  setup() {
    const selectedDate = ref('')
    const loading = ref(false)
    const stockList = ref([])

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
          next_day_return: null // 预留字段，后续计算
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

    // 解析选股原因
    const parseReasons = (reasonType) => {
      if (!reasonType) return []
      return reasonType.split(',').map(reason => reason.trim()).filter(reason => reason)
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

    return {
      selectedDate,
      loading,
      stockList,
      fetchBacktestData,
      onDateChange,
      formatMarketCap,
      parseReasons,
      getReturnClass,
      handleStockClick
    }
  }
}
</script>

<style scoped>
.backtest-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 24px;
}

.page-description {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.controls-section {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.date-picker-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-picker-container label {
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
}

.results-section {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.results-header h3 {
  margin: 0;
  color: #303133;
  font-size: 18px;
}

.stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #606266;
}

.stock-table {
  width: 100%;
}

.reason-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.positive-return {
  color: #f56c6c;
  font-weight: 500;
}

.negative-return {
  color: #67c23a;
  font-weight: 500;
}

.zero-return {
  color: #909399;
}

.no-data {
  color: #c0c4cc;
}

/* 可点击的股票代码和名称样式 */
.clickable-stock-code,
.clickable-stock-name {
  color: #409eff;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
  display: inline-block;
  padding: 2px 4px;
  border-radius: 3px;
}

.clickable-stock-code:hover,
.clickable-stock-name:hover {
  color: #66b1ff;
  background-color: #ecf5ff;
  text-decoration: underline;
  transform: translateY(-1px);
}

.clickable-stock-code:active,
.clickable-stock-name:active {
  color: #3a8ee6;
  transform: translateY(0);
}

.no-data-message,
.welcome-message {
  text-align: center;
  padding: 60px 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .backtest-container {
    padding: 12px;
  }

  .date-picker-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .results-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .stats {
    flex-direction: column;
    gap: 4px;
  }
}
</style>