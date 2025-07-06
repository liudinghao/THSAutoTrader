<template>
  <div class="zt-tian-ti">
    <div class="page-header">
      <h2>连板天梯</h2>
      <div class="header-actions">
        <el-button type="primary" @click="refreshData" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新数据
        </el-button>
      </div>
    </div>

    <div class="zt-tian-ti-content">
      <div v-if="loading" class="loading-container">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <p>数据加载中...</p>
      </div>

      <div v-else-if="!stockData.length" class="empty-container">
        <el-icon class="empty-icon"><DataLine /></el-icon>
        <p>暂无数据</p>
      </div>

      <div v-else class="data-container">
        <!-- 连板天梯表格 -->
        <div class="tian-ti-table">
          <div class="table-header">
            <div class="header-cell">连板数</div>
            <div class="header-cell">股票信息</div>
            <div class="header-cell">涨停原因</div>
            <div class="header-cell">首次涨停时间</div>
            <div class="header-cell">最后涨停时间</div>
          </div>
          
          <div class="table-body">
            <div 
              v-for="stock in groupedStocks" 
              :key="stock.zttj_days"
              class="table-row"
            >
              <div class="row-header">
                <div class="ban-count">{{ stock.zttj_days === 1 ? '首板' : stock.zttj_days + '连板' }}</div>
                <div class="stock-count">({{ stock.stocks.length }}只)</div>
              </div>
              
              <div class="stocks-container">
                <div 
                  v-for="item in stock.stocks" 
                  :key="item.id"
                  class="stock-item"
                >
                  <div class="stock-info">
                    <div class="stock-name">{{ item.name }}</div>
                    <div class="stock-code">{{ item.code }}</div>
                  </div>
                  <div class="stock-price">
                    <span class="price">¥{{ item.price }}</span>
                    <span class="change" :class="{ 'up': parseFloat(item.zdf) > 0, 'down': parseFloat(item.zdf) < 0 }">
                      {{ item.zdf }}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="reasons-container">
                <div 
                  v-for="item in stock.stocks" 
                  :key="item.id"
                  class="reason-tags"
                >
                  <el-tag 
                    v-for="reason in getReasons(item.reason_type)" 
                    :key="reason"
                    size="small"
                    :color="getTagColor(reason)"
                    effect="dark"
                    class="reason-tag"
                  >
                    {{ reason }}
                  </el-tag>
                </div>
              </div>
              
              <div class="time-container">
                <div 
                  v-for="item in stock.stocks" 
                  :key="item.id"
                  class="time-info"
                >
                  <div class="first-time">{{ formatTime(item.first_zt_time) }}</div>
                  <div class="last-time">{{ formatTime(item.last_zt_time) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Loading, DataLine } from '@element-plus/icons-vue'

// 响应式数据
const loading = ref(false)
const stockData = ref([])

// 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    const response = await fetch('https://www.wttiao.com/moni/ztpool/get?startDate=2025-06-26')
    const result = await response.json()
    
    if (result.code === 0) {
      stockData.value = result.data || []
      ElMessage.success('数据加载成功')
    } else {
      ElMessage.error(result.msg || '数据加载失败')
    }
  } catch (error) {
    console.error('获取数据失败:', error)
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 刷新数据
const refreshData = () => {
  fetchData()
}

// 按连板数分组
const groupedStocks = computed(() => {
  const groups = {}
  
  stockData.value.forEach(stock => {
    const days = stock.zttj_days
    if (!groups[days]) {
      groups[days] = {
        zttj_days: days,
        stocks: []
      }
    }
    groups[days].stocks.push(stock)
  })
  
  // 按连板数降序排列
  return Object.values(groups).sort((a, b) => b.zttj_days - a.zttj_days)
})

// 解析涨停原因
const getReasons = (reasonType) => {
  if (!reasonType) return []
  return reasonType.split('+').filter(reason => reason.trim())
}

// 获取标签颜色
const getTagColor = (reason) => {
  const colorMap = {
    'AI': '#409EFF',
    '芯片': '#67C23A',
    '新能源': '#E6A23C',
    '医药': '#F56C6C',
    '军工': '#909399',
    '金融': '#9C27B0',
    '消费': '#FF9800',
    '科技': '#2196F3',
    '汽车': '#4CAF50',
    '房地产': '#795548',
    '农业': '#8BC34A',
    '传媒': '#FF5722',
    '教育': '#607D8B',
    '环保': '#009688',
    '物流': '#FFC107',
    '游戏': '#9E9E9E',
    '区块链': '#3F51B5',
    '5G': '#00BCD4',
    '物联网': '#FFEB3B',
    '大数据': '#673AB7'
  }
  
  // 根据关键词匹配颜色
  for (const [key, color] of Object.entries(colorMap)) {
    if (reason.includes(key)) {
      return color
    }
  }
  
  // 默认颜色
  return '#909399'
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  const time = timeStr.toString()
  if (time.length === 5) {
    return `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4)}`
  }
  return timeStr
}

// 页面加载时获取数据
onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.zt-tian-ti {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.zt-tian-ti-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.loading-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
}

.loading-icon,
.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #c0c4cc;
}

.data-container {
  padding: 0;
}

.tian-ti-table {
  width: 100%;
}

.table-header {
  display: grid;
  grid-template-columns: 120px 1fr 2fr 200px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
  font-weight: 600;
  color: #606266;
}

.header-cell {
  padding: 16px 12px;
  text-align: center;
  border-right: 1px solid #ebeef5;
}

.header-cell:last-child {
  border-right: none;
}

.table-body {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.table-row {
  display: grid;
  grid-template-columns: 120px 1fr 2fr 200px;
  border-bottom: 1px solid #ebeef5;
  transition: background-color 0.3s;
}

.table-row:hover {
  background-color: #f5f7fa;
}

.row-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
  background: #f0f9ff;
  border-right: 1px solid #ebeef5;
  min-height: 80px;
}

.ban-count {
  font-size: 18px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 4px;
}

.stock-count {
  font-size: 12px;
  color: #909399;
}

.stocks-container,
.reasons-container,
.time-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-right: 1px solid #ebeef5;
}

.stocks-container {
  grid-column: 2;
}

.reasons-container {
  grid-column: 3;
}

.time-container {
  grid-column: 4;
  border-right: none;
}

.stock-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.stock-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stock-name {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.stock-code {
  font-size: 12px;
  color: #909399;
}

.stock-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.price {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.change {
  font-size: 12px;
  font-weight: 600;
}

.change.up {
  color: #f56c6c;
}

.change.down {
  color: #67c23a;
}

.reason-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.reason-tag {
  margin: 0;
  font-size: 11px;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  text-align: center;
}

.first-time,
.last-time {
  font-size: 12px;
  color: #606266;
}

.first-time {
  font-weight: 600;
  color: #409eff;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .table-header {
    grid-template-columns: 100px 1fr 1.5fr 150px;
  }
  
  .header-cell {
    padding: 12px 8px;
    font-size: 13px;
  }
  
  .row-header {
    padding: 12px 8px;
  }
  
  .ban-count {
    font-size: 16px;
  }
}

@media (max-width: 768px) {
  .zt-tian-ti {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .table-header {
    grid-template-columns: 80px 1fr 1fr 120px;
  }
  
  .header-cell {
    padding: 8px 4px;
    font-size: 12px;
  }
  
  .row-header {
    padding: 8px 4px;
  }
  
  .ban-count {
    font-size: 14px;
  }
  
  .stock-item {
    padding: 6px 8px;
  }
  
  .stock-name {
    font-size: 13px;
  }
  
  .stock-code {
    font-size: 11px;
  }
}
</style> 