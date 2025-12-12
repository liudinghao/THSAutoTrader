<template>
  <el-card class="market-overview-card">
    <template #header>
      <div class="card-header">
        <span>📈 市场概况</span>
        <div class="header-actions">
          <el-tooltip 
            content="市场统计盘中每30秒更新，概念排行盘中每1分钟更新"
            placement="top"
          >
            <el-tag 
              size="small" 
              type="info"
              effect="plain"
            >
              <el-icon><Timer /></el-icon>
              自动更新
            </el-tag>
          </el-tooltip>
          <el-button size="small" @click="$emit('refresh')" :loading="loading">刷新</el-button>
        </div>
      </div>
    </template>
    
    <!-- 基本市场统计 -->
    <div class="market-stats">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">涨停数</div>
          <div class="stat-value text-red">{{ marketStats.limit_up || 0 }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">跌停数</div>
          <div class="stat-value text-green">{{ marketStats.limit_down || 0 }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">上涨数量</div>
          <div class="stat-value text-red">{{ marketStats.rising || 0 }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">下跌数量</div>
          <div class="stat-value text-green">{{ marketStats.falling || 0 }}</div>
        </div>
      </div>

      <!-- 四大指数 -->
      <div class="index-stats">
        <div class="index-item">
          <div class="index-label">上证指数</div>
          <div class="index-value">
            <span :class="getIndexColor(marketStats.sh_index.change_percent)">
              {{ formatIndexValue(marketStats.sh_index.price) }}
            </span>
            <span :class="getIndexChangeColor(marketStats.sh_index.change_percent)">
              {{ formatIndexChange(marketStats.sh_index.change_percent) }}
            </span>
          </div>
        </div>
        <div class="index-item">
          <div class="index-label">深证成指</div>
          <div class="index-value">
            <span :class="getIndexColor(marketStats.sz_index.change_percent)">
              {{ formatIndexValue(marketStats.sz_index.price) }}
            </span>
            <span :class="getIndexChangeColor(marketStats.sz_index.change_percent)">
              {{ formatIndexChange(marketStats.sz_index.change_percent) }}
            </span>
          </div>
        </div>
        <div class="index-item">
          <div class="index-label">创业板指</div>
          <div class="index-value">
            <span :class="getIndexColor(marketStats.gem_index.change_percent)">
              {{ formatIndexValue(marketStats.gem_index.price) }}
            </span>
            <span :class="getIndexChangeColor(marketStats.gem_index.change_percent)">
              {{ formatIndexChange(marketStats.gem_index.change_percent) }}
            </span>
          </div>
        </div>
        <div class="index-item">
          <div class="index-label">微盘股</div>
          <div class="index-value">
            <span :class="getIndexColor(marketStats.microcap_index.change_percent)">
              {{ formatIndexValue(marketStats.microcap_index.price) }}
            </span>
            <span :class="getIndexChangeColor(marketStats.microcap_index.change_percent)">
              {{ formatIndexChange(marketStats.microcap_index.change_percent) }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- 概念排行 -->
      <div class="concept-ranking">
        <div class="ranking-section">
          <div class="section-title">📈 涨幅前十概念</div>
          <div class="loading-container" v-if="loading && conceptRanking.topRisers.length === 0">
            <el-icon class="is-loading"><RefreshRight /></el-icon>
            <span>加载中...</span>
          </div>
          <div class="ranking-list" v-else>
            <div 
              v-for="(concept, index) in displayTopRisers" 
              :key="`riser-${concept.code || index}`"
              class="ranking-item"
            >
              <span class="rank-number">{{ index + 1 }}</span>
              <span class="concept-name">{{ concept.name || '国家大基金持股' }}</span>
              <span class="change-value text-red">+{{ concept.changePercent || '0.00' }}%</span>
            </div>
            <div v-if="displayTopRisers.length === 0 && !loading" class="empty-data">
              暂无数据
            </div>
          </div>
        </div>
        
        <div class="ranking-section">
          <div class="section-title">📉 跌幅前十概念</div>
          <div class="loading-container" v-if="loading && conceptRanking.topFallers.length === 0">
            <el-icon class="is-loading"><RefreshRight /></el-icon>
            <span>加载中...</span>
          </div>
          <div class="ranking-list" v-else>
            <div 
              v-for="(concept, index) in displayTopFallers" 
              :key="`faller-${concept.code || index}`"
              class="ranking-item"
            >
              <span class="rank-number">{{ index + 1 }}</span>
              <span class="concept-name">{{ concept.name || '国家大基金持股' }}</span>
              <span class="change-value text-green">{{ concept.changePercent || '0.00' }}%</span>
            </div>
            <div v-if="displayTopFallers.length === 0 && !loading" class="empty-data">
              暂无数据
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { Timer, RefreshRight } from '@element-plus/icons-vue'

// Props
const props = defineProps({
  marketStats: {
    type: Object,
    default: () => ({
      limit_up: 0,
      limit_down: 0,
      rising: 0,
      falling: 0,
      sh_index: { price: 0, change: 0, change_percent: 0 },
      sz_index: { price: 0, change: 0, change_percent: 0 },
      gem_index: { price: 0, change: 0, change_percent: 0 },
      microcap_index: { price: 0, change: 0, change_percent: 0 }
    })
  },
  conceptRanking: {
    type: Object,
    default: () => ({
      topRisers: [],
      topFallers: [],
      timestamp: null
    })
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// Emits
defineEmits(['refresh'])

// 计算属性：处理概念名称默认显示逻辑
const displayTopRisers = computed(() => {
  if (props.conceptRanking.topRisers && props.conceptRanking.topRisers.length > 0) {
    return props.conceptRanking.topRisers.map(concept => ({
      ...concept,
      name: concept.name || '国家大基金持股'
    }))
  }
  // 如果没有数据，返回空数组
  return []
})

const displayTopFallers = computed(() => {
  if (props.conceptRanking.topFallers && props.conceptRanking.topFallers.length > 0) {
    return props.conceptRanking.topFallers.map(concept => ({
      ...concept,
      name: concept.name || '国家大基金持股'
    }))
  }
  // 如果没有数据，返回空数组
  return []
})

// 辅助函数
const formatIndexValue = (value) => {
  if (!value || value === '0') return '-'
  return parseFloat(value).toFixed(2)
}

const formatIndexChange = (change) => {
  if (!change || change === '0') return '0.00%'
  const num = parseFloat(change)
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`
}

const getIndexColor = (change) => {
  const num = parseFloat(change || 0)
  if (num > 0) return 'text-red'
  if (num < 0) return 'text-green'
  return ''
}

const getIndexChangeColor = (change) => {
  const num = parseFloat(change || 0)
  if (num > 0) return 'text-red'
  if (num < 0) return 'text-green'
  return 'text-gray'
}
</script>

<style scoped>
.market-overview-card {
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

.market-stats {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.stat-item {
  text-align: center;
  padding: 6px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.stat-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
}

.index-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.index-item {
  text-align: center;
  padding: 6px 4px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.index-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 3px;
  font-weight: 500;
}

.index-value {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  flex-wrap: nowrap;
}

.index-value > span:first-child {
  font-size: 14px;
  font-weight: bold;
}

.index-value > span:last-child {
  font-size: 11px;
  opacity: 0.9;
}

.concept-ranking {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.ranking-section {
  background: white;
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.section-title {
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 4px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 2px;
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 11px;
}

.ranking-item:last-child {
  border-bottom: none;
}

.rank-number {
  width: 20px;
  text-align: center;
  font-weight: bold;
  color: #666;
}

.concept-name {
  flex: 1;
  margin-left: 8px;
  color: #333;
  font-weight: 500;
}

.change-value {
  font-weight: bold;
  min-width: 50px;
  text-align: right;
}

.empty-data {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 12px;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #666;
  font-size: 12px;
}

.loading-container .el-icon {
  margin-right: 8px;
}

.text-red {
  color: #f56c6c;
}

.text-green {
  color: #67c23a;
}

.text-gray {
  color: #909399;
}

@media (max-width: 768px) {
  .concept-ranking {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .index-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>