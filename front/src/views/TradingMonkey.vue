<template>
  <div class="trading-monkey">
    <el-card class="trading-card">
      <template #header>
        <div class="card-header">
          <span>交易猿 - 智能交易系统</span>
          <el-tag :type="connectionStatus ? 'success' : 'danger'">
            {{ connectionStatus ? '已连接' : '未连接' }}
          </el-tag>
        </div>
      </template>

      <!-- 监控股票列表 -->
      <div class="monitor-list">
        <div class="monitor-header">
          <span>监控股票</span>
          <el-button size="small" @click="addMonitorStock">添加监控</el-button>
        </div>

        <el-table :data="monitorStocks" style="width: 100%" size="small">
          <el-table-column prop="code" label="代码" width="80" />
          <el-table-column prop="name" label="名称" width="100" />
          <el-table-column prop="price" label="价格" width="80" />
          <el-table-column prop="change" label="涨跌" width="80">
            <template #default="scope">
              <span :class="getChangeClass(scope.row.change)">
                {{ scope.row.change }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="changePercent" label="涨跌幅" width="80">
            <template #default="scope">
              <span :class="getChangeClass(scope.row.changePercent)">
                {{ scope.row.changePercent }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="scope">
              <el-button 
                size="small" 
                type="danger" 
                @click="removeMonitorStock(scope.$index)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 持仓股票 -->
      <div class="position-stocks">
        <div class="position-header">
          <span>持仓股票</span>
          <el-button size="small" @click="refreshPositionData" :loading="loading.position">刷新</el-button>
        </div>

        <el-table :data="positionData" style="width: 100%" size="small" max-height="200">
          <el-table-column prop="证券代码" label="代码" width="80" />
          <el-table-column prop="证券名称" label="名称" width="100" />
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
          <el-table-column prop="仓位占比(%)" label="仓位占比" width="80" />
          <el-table-column prop="持股天数" label="持股天数" width="80" />
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPositionData } from '../api/asset'

// 响应式数据
const connectionStatus = ref(false)
const monitorDialogVisible = ref(false)
const loading = ref({
  position: false
})



// 监控表单
const monitorForm = reactive({
  code: '',
  name: ''
})

// 监控股票列表
const monitorStocks = ref([
  { code: '000001', name: '平安银行', price: '12.34', change: '+0.12', changePercent: '+0.98' },
  { code: '000002', name: '万科A', price: '18.56', change: '-0.23', changePercent: '-1.22' },
  { code: '600036', name: '招商银行', price: '45.67', change: '+0.89', changePercent: '+1.99' }
])

// 持仓数据
const positionData = ref([])



// 方法

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

const getChangeClass = (change) => {
  if (change.startsWith('+')) return 'text-success'
  if (change.startsWith('-')) return 'text-danger'
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

// 生命周期
onMounted(async () => {
  // 模拟连接状态
  setTimeout(() => {
    connectionStatus.value = true
  }, 1000)
  
  // 获取持仓数据
  try {
    await fetchPositionData()
  } catch (error) {
    console.error('持仓数据加载失败:', error)
  }
})

onUnmounted(() => {
  // 清理定时器等资源
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

.monitor-panel {
  height: 100%;
}

.monitor-list,
.position-stocks {
  margin-bottom: 20px;
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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style> 