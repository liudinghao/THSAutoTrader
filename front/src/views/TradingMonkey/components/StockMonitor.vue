<template>
  <el-card class="stock-monitor-card">
    <template #header>
      <div class="card-header">
        <div class="header-left">
          <span>👁️ 监控股票</span>
          <div class="data-source-info">
            <el-tag size="small" type="warning">集合竞价策略</el-tag>
          </div>
        </div>
        <div class="header-actions">
          <el-button size="small" @click="$emit('refresh')" :loading="loading">刷新</el-button>
          <el-button size="small" @click="showAddDialog = true">添加监控</el-button>
        </div>
      </div>
    </template>

    <el-table :data="stocks" size="small" max-height="450">
      <el-table-column prop="code" label="代码" width="80">
        <template #default="scope">
          <span 
            class="clickable-stock-code" 
            @click="$emit('jump-to-quote', scope.row.code)"
            :title="`点击查看 ${scope.row.code} 分时图`"
          >
            {{ scope.row.code }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" width="100">
        <template #default="scope">
          <span 
            class="clickable-stock-name" 
            @click="$emit('jump-to-quote', scope.row.code)"
            :title="`点击查看 ${scope.row.code} 分时图`"
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
      <el-table-column prop="limitUpReason" label="涨停原因" width="150">
        <template #default="scope">
          <el-tooltip
            :content="scope.row.limitUpReason"
            placement="top"
            effect="light"
          >
            <span class="limit-up-reason">{{ scope.row.limitUpReason }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
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
              @click="$emit('show-analysis', scope.row)"
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
              @click="$emit('analyze-stock', scope.row)"
              :loading="analyzing"
              :disabled="analyzing"
            >
              {{ analyzing ? '分析中...' : '分析' }}
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="removeStock(scope.$index)"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加监控股票对话框 -->
    <el-dialog v-model="showAddDialog" title="添加监控股票" width="400px">
      <el-form :model="addForm" label-width="80px" @submit.prevent="confirmAdd">
        <el-form-item label="股票代码" required>
          <el-input 
            v-model="addForm.code" 
            placeholder="请输入股票代码"
            @keyup.enter="confirmAdd"
          />
        </el-form-item>
        <el-form-item label="股票名称" required>
          <el-input 
            v-model="addForm.name" 
            placeholder="请输入股票名称"
            @keyup.enter="confirmAdd"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showAddDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmAdd">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'

// Props
const props = defineProps({
  stocks: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  analysisResults: {
    type: Object,
    default: () => ({})
  },
  analyzing: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits([
  'update:stocks',
  'refresh', 
  'analyze-stock', 
  'show-analysis',
  'jump-to-quote'
])

// 响应式数据
const showAddDialog = ref(false)
const addForm = reactive({
  code: '',
  name: ''
})


// 计算属性
const stocks = computed({
  get: () => props.stocks,
  set: (value) => emit('update:stocks', value)
})

// 方法

const confirmAdd = () => {
  if (!addForm.code.trim() || !addForm.name.trim()) {
    ElMessage.warning('请填写完整的股票信息')
    return
  }

  // 检查是否已存在
  const exists = stocks.value.some(stock => stock.code === addForm.code.trim())
  if (exists) {
    ElMessage.warning('该股票已在监控列表中')
    return
  }

  // 添加到监控列表
  const newStocks = [...stocks.value, {
    code: addForm.code.trim().toUpperCase(),
    name: addForm.name.trim(),
    price: '0.00',
    changePercent: '0.00'
  }]
  
  stocks.value = newStocks
  
  // 重置表单
  addForm.code = ''
  addForm.name = ''
  showAddDialog.value = false
  
  ElMessage.success('添加监控股票成功')
}

const removeStock = (index) => {
  const newStocks = [...stocks.value]
  newStocks.splice(index, 1)
  stocks.value = newStocks
  ElMessage.success('删除监控股票成功')
}

const getChangeClass = (changePercent) => {
  const numValue = parseFloat(changePercent)
  if (numValue > 0) return 'text-red'
  if (numValue < 0) return 'text-green'
  return ''
}
</script>

<style scoped>
.stock-monitor-card {
  margin-bottom: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.data-source-info {
  display: flex;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
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

.text-red {
  color: #f56c6c;
}

.text-green {
  color: #67c23a;
}

.limit-up-reason {
  cursor: pointer;
  color: #e74c3c;
  font-weight: 500;
  max-width: 130px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.limit-up-reason:hover {
  color: #c0392b;
  text-decoration: underline;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>