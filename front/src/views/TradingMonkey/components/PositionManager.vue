<template>
  <el-card class="position-manager-card">
    <template #header>
      <div class="card-header">
        <span>💼 持仓股票 (可用金额：{{ availableBalance }})</span>
        <el-button size="small" @click="$emit('refresh')" :loading="loading">刷新</el-button>
      </div>
    </template>

    <el-table :data="positionData" size="small" max-height="200">
      <el-table-column prop="证券名称" label="名称" width="100">
        <template #default="scope">
          <span 
            class="clickable-stock-name" 
            @click="$emit('jump-to-quote', scope.row.证券代码)"
            :title="`点击查看 ${scope.row.证券代码} 分时图`"
          >
            {{ scope.row.证券名称 }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="实际数量" label="实际数量" width="80" />
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
              @click="$emit('show-analysis', scope.row, 'position')"
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
            @click="$emit('analyze-stock', scope.row)"
            :loading="analyzing"
            :disabled="analyzing"
          >
            {{ analyzing ? '分析中...' : '分析' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 无持仓提示 -->
    <div v-if="positionData.length === 0" class="empty-positions">
      <el-icon><Wallet /></el-icon>
      <span>暂无持仓</span>
    </div>
  </el-card>
</template>

<script setup>
import { Wallet } from '@element-plus/icons-vue'

// Props
const props = defineProps({
  positionData: {
    type: Array,
    default: () => []
  },
  availableBalance: {
    type: String,
    default: '0.00'
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
defineEmits([
  'refresh',
  'analyze-stock',
  'show-analysis',
  'jump-to-quote'
])

// 方法
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
</script>

<style scoped>
.position-manager-card {
  margin-bottom: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clickable-stock-name {
  cursor: pointer;
  color: #1890ff;
  text-decoration: underline;
  transition: color 0.2s;
}

.clickable-stock-name:hover {
  color: #40a9ff;
  text-decoration: underline;
}

.clickable-stock-name:active {
  color: #096dd9;
}

.text-red {
  color: #f56c6c;
}

.text-green {
  color: #67c23a;
}

.empty-positions {
  text-align: center;
  padding: 30px;
  color: #999;
}

.empty-positions .el-icon {
  font-size: 24px;
  margin-bottom: 8px;
}
</style>