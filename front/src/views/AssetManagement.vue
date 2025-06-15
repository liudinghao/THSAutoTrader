<template>
  <div class="asset-management">
    <!-- 资产信息卡片 -->
    <el-card class="asset-info-card" :body-style="{ padding: '20px' }" v-loading="loading.asset">
      <template #header>
        <div class="card-header">
          <span>资产信息</span>
          <el-button type="primary" :icon="Refresh" circle @click="refreshAssetInfo" :loading="loading.asset" />
        </div>
      </template>
      <div class="asset-info-grid">
        <div v-for="(value, key) in assetInfo" :key="key" class="asset-info-item">
          <span class="label">{{ key }}：</span>
          <span class="value" :class="getValueClass(key, value)">{{ value }}</span>
        </div>
      </div>
    </el-card>

    <!-- 持仓信息表格 -->
    <el-card class="position-card" :body-style="{ padding: '20px' }" v-loading="loading.position">
      <template #header>
        <div class="card-header">
          <span>当前持仓</span>
          <el-button type="primary" :icon="Refresh" circle @click="refreshPositionData" :loading="loading.position" />
        </div>
      </template>
      <el-table :data="positionData" style="width: 100%" border stripe>
        <el-table-column prop="序号" label="序号" min-width="50" />
        <el-table-column prop="证券代码" label="证券代码" min-width="80" />
        <el-table-column prop="证券名称" label="证券名称" min-width="80" />
        <el-table-column prop="股票余额" label="股票余额" min-width="80" />
        <el-table-column prop="可用余额" label="可用余额" min-width="80" />
        <el-table-column prop="成本价" label="成本价" min-width="80" />
        <el-table-column prop="市价" label="市价" min-width="80" />
        <el-table-column prop="盈亏" label="盈亏" min-width="80">
          <template #default="scope">
            <span :class="getValueClass('盈亏', scope.row.盈亏)">{{ scope.row.盈亏 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="盈亏比例(%)" label="盈亏比例(%)" min-width="90">
          <template #default="scope">
            <span :class="getValueClass('盈亏比例', scope.row['盈亏比例(%)'])">{{ scope.row['盈亏比例(%)'] }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="当日盈亏" label="当日盈亏" min-width="80">
          <template #default="scope">
            <span :class="getValueClass('当日盈亏', scope.row.当日盈亏)">{{ scope.row.当日盈亏 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="当日盈亏比(%)" label="当日盈亏比(%)" min-width="90">
          <template #default="scope">
            <span :class="getValueClass('当日盈亏比', scope.row['当日盈亏比(%)'])">{{ scope.row['当日盈亏比(%)'] }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="市值" label="市值" min-width="80" />
        <el-table-column prop="仓位占比(%)" label="仓位占比(%)" min-width="90" />
        <el-table-column prop="交易市场" label="交易市场" min-width="80" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { indexedDBUtil } from '../utils/indexedDB'
import { getAssetInfo, getPositionData } from '../api/asset'

const loading = ref({
  asset: false,
  position: false
})
const assetInfo = ref({})
const positionData = ref([])

// 初始化 IndexedDB
const initDB = async () => {
  try {
    console.log('开始初始化 IndexedDB...')
    await indexedDBUtil.init()
    console.log('IndexedDB 初始化成功')
  } catch (error) {
    console.error('初始化数据库失败:', error)
    ElMessage.error('初始化数据库失败')
  }
}

// 获取资产信息
const fetchAssetInfo = async (forceRefresh = false) => {
  if (loading.value.asset) return
  
  loading.value.asset = true
  try {
    const data = await getAssetInfo(forceRefresh)
    assetInfo.value = data
  } catch (error) {
    console.error('获取资产信息失败:', error)
    ElMessage.error(`获取资产信息失败: ${error.message}`)
  } finally {
    loading.value.asset = false
  }
}

// 获取持仓信息
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

// 刷新资产信息
const refreshAssetInfo = () => {
  fetchAssetInfo(true)
}

// 刷新持仓信息
const refreshPositionData = () => {
  fetchPositionData(true)
}

// 页面加载时获取数据
onMounted(async () => {
  try {
    await initDB()
    await Promise.all([fetchAssetInfo(), fetchPositionData()])
  } catch (error) {
    console.error('数据加载失败:', error)
    ElMessage.error('数据加载失败')
  }
})

// 根据数值判断显示颜色
const getValueClass = (key, value) => {
  if (typeof value === 'string') {
    const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''))
    if (key.includes('盈亏') || key.includes('盈亏比')) {
      return numValue > 0 ? 'text-red' : numValue < 0 ? 'text-green' : ''
    }
  }
  return ''
}
</script>

<style scoped>
.asset-management {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

.asset-info-card {
  margin-bottom: 20px;
  width: 100%;
}

.asset-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.asset-info-item {
  display: flex;
  align-items: center;
  min-width: 0;
}

.asset-info-item .label {
  font-weight: bold;
  margin-right: 8px;
  white-space: nowrap;
}

.asset-info-item .value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-red {
  color: #f56c6c;
}

.text-green {
  color: #67c23a;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.position-card {
  width: 100%;
}

.position-card :deep(.el-table) {
  width: 100% !important;
}

.position-card :deep(.el-table__body-wrapper) {
  overflow-x: auto;
}

@media screen and (max-width: 768px) {
  .asset-info-grid {
    grid-template-columns: 1fr;
  }
  
  .asset-management {
    padding: 10px;
  }
}
</style> 