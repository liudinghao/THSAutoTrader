<template>
  <el-card class="trading-history-card">
    <template #header>
      <div class="card-header">
        <span>📊 交易历史</span>
        <div class="header-actions">
          <el-select v-model="activeTab" size="small" style="width: 120px;">
            <el-option label="订单记录" value="orders" />
            <el-option label="执行日志" value="logs" />
            <el-option label="统计分析" value="stats" />
          </el-select>
          <el-button size="small" @click="refreshData" :loading="loading">刷新</el-button>
          <el-button size="small" @click="exportData">导出</el-button>
        </div>
      </div>
    </template>

    <!-- 订单记录 -->
    <div v-show="activeTab === 'orders'" class="orders-section">
      <div class="section-filters">
        <div class="filter-row">
          <el-select v-model="orderFilters.status" size="small" clearable placeholder="订单状态">
            <el-option label="全部" value="" />
            <el-option label="待处理" value="pending" />
            <el-option label="已提交" value="submitted" />
            <el-option label="已成交" value="filled" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
          
          <el-input 
            v-model="orderFilters.stockCode" 
            size="small" 
            clearable 
            placeholder="股票代码"
            style="width: 120px;"
          />
          
          <el-date-picker
            v-model="orderFilters.date"
            type="date"
            size="small"
            clearable
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </div>
      </div>

      <el-table :data="filteredOrders" size="small" max-height="400">
        <el-table-column prop="id" label="订单号" width="140">
          <template #default="scope">
            <span class="order-id">{{ scope.row.id.split('_').slice(-1)[0] }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="stockCode" label="股票" width="80" />
        <el-table-column prop="stockName" label="名称" width="100" />
        <el-table-column prop="type" label="类型" width="60">
          <template #default="scope">
            <el-tag :type="scope.row.type === 'buy' ? 'danger' : 'success'" size="small">
              {{ getOrderTypeText(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="price" label="价格" width="80">
          <template #default="scope">
            ¥{{ parseFloat(scope.row.price || 0).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="scope">
            <el-tag 
              :color="getOrderStatusColor(scope.row.status)" 
              size="small"
              effect="dark"
            >
              {{ getOrderStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="130">
          <template #default="scope">
            {{ formatDateTime(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button 
              v-if="canCancelOrder(scope.row)"
              size="small" 
              type="warning"
              @click="cancelOrder(scope.row)"
            >
              取消
            </el-button>
            <el-button 
              size="small" 
              @click="showOrderDetail(scope.row)"
            >
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-pagination" v-if="filteredOrders.length > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredOrders.length"
          layout="prev, pager, next"
          size="small"
        />
      </div>
    </div>

    <!-- 执行日志 -->
    <div v-show="activeTab === 'logs'" class="logs-section">
      <div class="logs-list" ref="logsList">
        <div 
          v-for="log in executionLogs" 
          :key="log.id"
          class="log-item"
          :class="getLogClass(log.type)"
        >
          <div class="log-header">
            <span class="log-type">{{ getLogTypeIcon(log.type) }}</span>
            <span class="log-message">{{ log.message }}</span>
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          </div>
          <div v-if="log.order" class="log-details">
            <span>{{ log.order.stockCode }} {{ log.order.stockName }}</span>
            <span>{{ getOrderTypeText(log.order.type) }} {{ log.order.quantity }}股</span>
            <span v-if="log.order.price">¥{{ parseFloat(log.order.price).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计分析 -->
    <div v-show="activeTab === 'stats'" class="stats-section">
      <div class="stats-overview">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-title">今日交易</div>
            <div class="stat-value">{{ todayStats.totalOrders }}</div>
            <div class="stat-desc">笔订单</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">成功率</div>
            <div class="stat-value">{{ todayStats.successRate }}%</div>
            <div class="stat-desc">成交率</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">买入笔数</div>
            <div class="stat-value buy-count">{{ todayStats.buyOrders }}</div>
            <div class="stat-desc">买入</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">卖出笔数</div>
            <div class="stat-value sell-count">{{ todayStats.sellOrders }}</div>
            <div class="stat-desc">卖出</div>
          </div>
        </div>
      </div>

      <div class="stats-charts">
        <div class="chart-container">
          <div class="chart-title">订单状态分布</div>
          <div class="status-distribution">
            <div 
              v-for="(count, status) in statusDistribution" 
              :key="status"
              class="status-item"
            >
              <span class="status-dot" :style="{ backgroundColor: getOrderStatusColor(status) }"></span>
              <span class="status-name">{{ getOrderStatusText(status) }}</span>
              <span class="status-count">{{ count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 订单详情对话框 -->
    <el-dialog v-model="orderDetailVisible" title="订单详情" width="500px">
      <div v-if="selectedOrder" class="order-detail">
        <div class="detail-row">
          <span class="label">订单号:</span>
          <span class="value">{{ selectedOrder.id }}</span>
        </div>
        <div class="detail-row">
          <span class="label">股票信息:</span>
          <span class="value">{{ selectedOrder.stockCode }} {{ selectedOrder.stockName }}</span>
        </div>
        <div class="detail-row">
          <span class="label">操作类型:</span>
          <el-tag :type="selectedOrder.type === 'buy' ? 'danger' : 'success'" size="small">
            {{ getOrderTypeText(selectedOrder.type) }}
          </el-tag>
        </div>
        <div class="detail-row">
          <span class="label">数量:</span>
          <span class="value">{{ selectedOrder.quantity }}股</span>
        </div>
        <div class="detail-row">
          <span class="label">价格:</span>
          <span class="value">¥{{ parseFloat(selectedOrder.price || 0).toFixed(2) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">订单状态:</span>
          <el-tag 
            :color="getOrderStatusColor(selectedOrder.status)" 
            effect="dark"
          >
            {{ getOrderStatusText(selectedOrder.status) }}
          </el-tag>
        </div>
        <div class="detail-row">
          <span class="label">创建时间:</span>
          <span class="value">{{ formatDateTime(selectedOrder.createdAt) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">更新时间:</span>
          <span class="value">{{ formatDateTime(selectedOrder.updatedAt) }}</span>
        </div>
        <div v-if="selectedOrder.reason" class="detail-row">
          <span class="label">执行原因:</span>
          <span class="value">{{ selectedOrder.reason }}</span>
        </div>
        <div v-if="selectedOrder.signal" class="detail-row">
          <span class="label">交易信号:</span>
          <div class="signal-info">
            <div>类型: {{ selectedOrder.signal.type }}</div>
            <div>置信度: {{ (selectedOrder.signal.confidence * 100).toFixed(0) }}%</div>
            <div>强度: {{ '★'.repeat(selectedOrder.signal.strength) }}</div>
          </div>
        </div>
      </div>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  TradingService, 
  getOrderStatusText, 
  getOrderTypeText, 
  getOrderStatusColor,
  ORDER_STATUS 
} from '../services/tradingService.js'

// Props
const props = defineProps({
  tradingService: {
    type: TradingService,
    required: true
  }
})

// 响应式数据
const activeTab = ref('orders')
const loading = ref(false)
const orderDetailVisible = ref(false)
const selectedOrder = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)

const orderFilters = ref({
  status: '',
  stockCode: '',
  date: ''
})

// 数据
const orders = ref([])
const executionLogs = ref([])

// 计算属性
const filteredOrders = computed(() => {
  let filtered = orders.value

  // 状态过滤
  if (orderFilters.value.status) {
    filtered = filtered.filter(order => order.status === orderFilters.value.status)
  }

  // 股票代码过滤
  if (orderFilters.value.stockCode) {
    filtered = filtered.filter(order => 
      order.stockCode.includes(orderFilters.value.stockCode.toUpperCase())
    )
  }

  // 日期过滤
  if (orderFilters.value.date) {
    const targetDate = new Date(orderFilters.value.date).toDateString()
    filtered = filtered.filter(order => 
      new Date(order.createdAt).toDateString() === targetDate
    )
  }

  // 分页
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filtered.slice(start, end)
})

const todayStats = computed(() => {
  const today = new Date().toDateString()
  const todayOrders = orders.value.filter(order => 
    new Date(order.createdAt).toDateString() === today
  )

  const totalOrders = todayOrders.length
  const filledOrders = todayOrders.filter(order => order.status === ORDER_STATUS.FILLED).length
  const buyOrders = todayOrders.filter(order => order.type === 'buy').length
  const sellOrders = todayOrders.filter(order => order.type === 'sell').length
  const successRate = totalOrders > 0 ? Math.round((filledOrders / totalOrders) * 100) : 0

  return {
    totalOrders,
    successRate,
    buyOrders,
    sellOrders
  }
})

const statusDistribution = computed(() => {
  const distribution = {}
  orders.value.forEach(order => {
    distribution[order.status] = (distribution[order.status] || 0) + 1
  })
  return distribution
})

// 方法
const refreshData = async () => {
  loading.value = true
  try {
    // 获取订单数据
    orders.value = props.tradingService.getAllOrders()
    
    // 获取执行日志
    executionLogs.value = props.tradingService.getExecutionHistory(100)
    
    console.log('交易历史数据刷新完成')
  } catch (error) {
    console.error('刷新交易历史失败:', error)
    ElMessage.error('刷新失败')
  } finally {
    loading.value = false
  }
}

const cancelOrder = async (order) => {
  try {
    await ElMessageBox.confirm(
      `确认取消订单 ${order.stockCode}？`,
      '取消订单',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const result = await props.tradingService.cancelOrder(order.id)
    
    if (result.success) {
      ElMessage.success('订单已取消')
      await refreshData()
    } else {
      ElMessage.error(result.message || '取消失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('取消订单失败:', error)
      ElMessage.error('取消失败')
    }
  }
}

const showOrderDetail = (order) => {
  selectedOrder.value = order
  orderDetailVisible.value = true
}

const exportData = () => {
  try {
    const data = {
      orders: orders.value,
      logs: executionLogs.value,
      stats: todayStats.value,
      exportTime: new Date().toISOString()
    }
    
    const dataStr = JSON.stringify(data, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    
    const link = document.createElement('a')
    link.href = URL.createObjectURL(dataBlob)
    link.download = `trading_history_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success('交易历史已导出')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 辅助函数
const canCancelOrder = (order) => {
  return order.status === ORDER_STATUS.PENDING || order.status === ORDER_STATUS.SUBMITTED
}

const getLogClass = (type) => {
  return `log-${type}`
}

const getLogTypeIcon = (type) => {
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    batch: '📦'
  }
  return icons[type] || 'ℹ️'
}

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatTime = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleTimeString('zh-CN', {
    hour12: false
  })
}

// 生命周期
onMounted(() => {
  refreshData()
})

// 监听过滤条件变化
watch([orderFilters], () => {
  currentPage.value = 1
}, { deep: true })
</script>

<style scoped>
.trading-history-card {
  margin-bottom: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-filters {
  margin-bottom: 15px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.filter-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.order-id {
  font-family: monospace;
  font-size: 12px;
  color: #666;
}

.table-pagination {
  margin-top: 15px;
  text-align: center;
}

.logs-section {
  max-height: 400px;
}

.logs-list {
  max-height: 380px;
  overflow-y: auto;
  padding: 5px;
}

.log-item {
  padding: 8px 12px;
  margin-bottom: 6px;
  background: white;
  border-radius: 4px;
  border-left: 3px solid #ddd;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.log-item.log-success {
  border-left-color: #67c23a;
}

.log-item.log-error {
  border-left-color: #f56c6c;
}

.log-item.log-info {
  border-left-color: #409eff;
}

.log-item.log-batch {
  border-left-color: #e6a23c;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.log-type {
  font-size: 12px;
}

.log-message {
  flex: 1;
  font-size: 13px;
  color: #333;
}

.log-time {
  font-size: 11px;
  color: #999;
}

.log-details {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #666;
}

.stats-section {
  padding: 10px 0;
}

.stats-overview {
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
}

.stat-card {
  text-align: center;
  padding: 15px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stat-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.stat-value.buy-count {
  color: #f56c6c;
}

.stat-value.sell-count {
  color: #67c23a;
}

.stat-desc {
  font-size: 11px;
  color: #999;
}

.stats-charts {
  background: white;
  border-radius: 6px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.chart-title {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
}

.status-distribution {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-name {
  flex: 1;
  font-size: 13px;
  color: #333;
}

.status-count {
  font-size: 13px;
  font-weight: 500;
  color: #666;
}

.order-detail {
  padding: 10px 0;
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .label {
  width: 100px;
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.detail-row .value {
  flex: 1;
  font-size: 13px;
  color: #333;
}

.signal-info {
  font-size: 12px;
  color: #666;
}

.signal-info > div {
  margin-bottom: 2px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions {
    flex-direction: column;
    gap: 5px;
  }
}
</style>