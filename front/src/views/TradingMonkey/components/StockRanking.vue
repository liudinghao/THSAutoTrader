<template>
  <el-card class="stock-ranking-card">
    <template #header>
      <div class="card-header">
        <span>🎯 交易计划 - 智能排序</span>
        <div class="header-actions">
          <el-tooltip content="根据概念匹配、技术形态等综合评分排序" placement="top">
            <el-tag size="small" type="info" effect="plain">
              <el-icon><TrendCharts /></el-icon>
              智能评分
            </el-tag>
          </el-tooltip>
          <el-button 
            size="small" 
            @click="handleRanking" 
            :loading="isRanking"
            :disabled="!hasStocks"
          >
            {{ isRanking ? '排序中...' : '开始排序' }}
          </el-button>
        </div>
      </div>
    </template>
    
    <!-- 排序结果 -->
    <div class="ranking-content">
      <!-- 无股票提示 -->
      <div v-if="!hasStocks" class="empty-state">
        <el-empty description="暂无监控股票">
          <template #image>
            <el-icon size="60" color="#909399"><DocumentRemove /></el-icon>
          </template>
          <p class="empty-text">请先在股票监控中添加股票</p>
        </el-empty>
      </div>

      <!-- 排序中状态 -->
      <div v-else-if="isRanking" class="loading-state">
        <el-icon class="is-loading loading-icon"><Loading /></el-icon>
        <p class="loading-text">正在分析股票数据...</p>
        <p class="loading-sub">包括K线形态、概念匹配、技术指标等</p>
      </div>

      <!-- 排序结果列表 -->
      <div v-else-if="rankedStocks.length > 0" class="ranking-list">
        <div class="ranking-header">
          <span class="header-info">
            共 {{ rankedStocks.length }} 只股票 · 
            最高分 {{ maxScore }} 分 · 
            {{ formatTime(lastRankingTime) }}
          </span>
        </div>

        <div 
          v-for="(stock, index) in rankedStocks" 
          :key="stock.code"
          class="ranking-item"
          :class="getRankingClass(index)"
        >
          <!-- 排名和分数 -->
          <div class="rank-section">
            <div class="rank-number">{{ index + 1 }}</div>
            <div class="score-section">
              <div class="score-value">{{ stock.score }}</div>
              <div class="score-max">/ {{ stock.maxScore }}</div>
            </div>
          </div>

          <!-- 股票信息 -->
          <div class="stock-section">
            <div class="stock-name">{{ stock.name }}</div>
            <div class="stock-code">{{ stock.code }}</div>
            <div class="stock-price">
              <span :class="getPriceChangeClass(stock.change_percent)">
                ¥{{ formatPrice(stock.price) }}
                {{ formatChangePercent(stock.change_percent) }}
              </span>
            </div>
          </div>

          <!-- 评分详情 -->
          <div class="score-details">
            <div v-if="stock.scoreDetails && stock.scoreDetails.length > 0" class="score-tags">
              <el-tag 
                v-for="detail in stock.scoreDetails" 
                :key="detail"
                size="small" 
                type="success"
                effect="plain"
              >
                {{ detail }}
              </el-tag>
            </div>
            <div v-else class="no-score-tags">
              <el-tag size="small" type="info" effect="plain">暂无加分项</el-tag>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="action-section">
            <el-button-group>
              <el-button size="small" @click="$emit('jump-to-quote', stock.code)">
                分时图
              </el-button>
              <el-button 
                size="small" 
                type="primary" 
                @click="$emit('analyze-stock', stock)"
              >
                分析
              </el-button>
            </el-button-group>
          </div>
        </div>
      </div>

      <!-- 未排序状态 -->
      <div v-else class="unranked-state">
        <el-empty description="点击'开始排序'获取智能交易建议">
          <template #image>
            <el-icon size="60" color="#409EFF"><Trophy /></el-icon>
          </template>
          <p class="unranked-text">
            将根据以下维度进行评分：<br>
            • 概念匹配度（涨停原因vs热门概念）<br>
            • K线技术形态（向上趋势判断）<br>
            • 龙回头二波启动信号<br>
            • 风险控制（60日内无跌停）
          </p>
        </el-empty>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  TrendCharts, 
  DocumentRemove, 
  Loading, 
  Trophy 
} from '@element-plus/icons-vue'
import { stockRankingService } from '../services/stockRankingService.js'

// Props
const props = defineProps({
  // 监控股票列表
  stocks: {
    type: Array,
    default: () => []
  },
  // 概念排行数据
  conceptRanking: {
    type: Object,
    default: () => ({
      topRisers: [],
      topFallers: []
    })
  }
})

// Emits
defineEmits(['jump-to-quote', 'analyze-stock'])

// 响应式数据
const isRanking = ref(false)
const rankedStocks = ref([])
const lastRankingTime = ref(null)

// 计算属性
const hasStocks = computed(() => props.stocks && props.stocks.length > 0)

const maxScore = computed(() => {
  if (rankedStocks.value.length === 0) return 0
  return Math.max(...rankedStocks.value.map(stock => stock.score))
})

// 监听股票列表变化，清空排序结果
watch(() => props.stocks, () => {
  if (rankedStocks.value.length > 0) {
    rankedStocks.value = []
    lastRankingTime.value = null
  }
}, { deep: true })

// 方法
const handleRanking = async () => {
  console.log('🎯 排序按钮被点击!')
  console.log('监控股票数量:', props.stocks?.length || 0)
  console.log('hasStocks:', hasStocks.value)
  console.log('概念排行数据:', props.conceptRanking)
  
  if (!hasStocks.value) {
    ElMessage.warning('请先添加监控股票')
    return
  }

  if (isRanking.value) {
    return
  }

  try {
    isRanking.value = true
    ElMessage.info('开始智能排序分析...')

    // 调用排序服务
    const result = await stockRankingService.rankStocks(
      props.stocks, 
      props.conceptRanking
    )

    rankedStocks.value = result
    lastRankingTime.value = new Date()

    ElMessage.success(`排序完成！共分析 ${result.length} 只股票`)

  } catch (error) {
    console.error('股票排序失败:', error)
    ElMessage.error(`排序失败: ${error.message}`)
  } finally {
    isRanking.value = false
  }
}

// 辅助函数
const getRankingClass = (index) => {
  if (index === 0) return 'rank-first'
  if (index === 1) return 'rank-second'
  if (index === 2) return 'rank-third'
  return ''
}

const getPriceChangeClass = (changePercent) => {
  const change = parseFloat(changePercent || 0)
  if (change > 0) return 'text-red'
  if (change < 0) return 'text-green'
  return 'text-gray'
}

const formatPrice = (price) => {
  const num = parseFloat(price || 0)
  return num > 0 ? num.toFixed(2) : '--'
}

const formatChangePercent = (changePercent) => {
  const num = parseFloat(changePercent || 0)
  if (num === 0) return '0.00%'
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`
}

const formatTime = (time) => {
  if (!time) return ''
  return time.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}
</script>

<style scoped>
.stock-ranking-card {
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

.ranking-content {
  min-height: 200px;
}

/* 空状态样式 */
.empty-state, .unranked-state {
  padding: 20px;
  text-align: center;
}

.empty-text, .unranked-text {
  color: #666;
  font-size: 14px;
  line-height: 1.6;
  margin-top: 10px;
}

/* 加载状态样式 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.loading-icon {
  font-size: 32px;
  color: #409EFF;
  margin-bottom: 10px;
}

.loading-text {
  font-size: 16px;
  color: #333;
  margin-bottom: 5px;
}

.loading-sub {
  font-size: 12px;
  color: #666;
}

/* 排序列表样式 */
.ranking-header {
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 8px;
}

.header-info {
  font-size: 12px;
  color: #666;
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: white;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.ranking-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transform: translateY(-1px);
}

/* 排名特殊样式 */
.rank-first {
  border-left: 4px solid #FFD700;
  background: linear-gradient(90deg, #FFF9E6 0%, #FFFFFF 100%);
}

.rank-second {
  border-left: 4px solid #C0C0C0;
  background: linear-gradient(90deg, #F8F8F8 0%, #FFFFFF 100%);
}

.rank-third {
  border-left: 4px solid #CD7F32;
  background: linear-gradient(90deg, #FDF5E6 0%, #FFFFFF 100%);
}

/* 排名区域 */
.rank-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 12px;
  min-width: 50px;
}

.rank-number {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  line-height: 1;
}

.score-section {
  display: flex;
  align-items: baseline;
  margin-top: 2px;
}

.score-value {
  font-size: 16px;
  font-weight: bold;
  color: #409EFF;
}

.score-max {
  font-size: 12px;
  color: #999;
  margin-left: 2px;
}

/* 股票信息区域 */
.stock-section {
  flex: 1;
  margin-right: 12px;
}

.stock-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.stock-code {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.stock-price {
  font-size: 13px;
  font-weight: 500;
}

/* 评分详情区域 */
.score-details {
  margin-right: 12px;
  min-width: 120px;
}

.score-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.score-tags .el-tag {
  font-size: 10px;
  height: 20px;
  line-height: 18px;
}

.no-score-tags .el-tag {
  font-size: 10px;
  height: 20px;
  line-height: 18px;
}

/* 操作区域 */
.action-section {
  min-width: 100px;
}

/* 颜色类 */
.text-red {
  color: #f56c6c;
}

.text-green {
  color: #67c23a;
}

.text-gray {
  color: #909399;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .ranking-item {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .rank-section, .stock-section, .score-details, .action-section {
    margin-right: 0;
    min-width: auto;
  }
  
  .rank-section {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  
  .score-tags {
    justify-content: flex-start;
  }
}
</style>