<template>
  <el-card class="stock-ranking-card">
    <template #header>
      <div class="card-header">
        <span class="card-title">🎯</span>
        <div class="header-actions">
          <el-tooltip content="AI综合分析概念匹配、量价关系、技术形态，给出0-100分评分" placement="top">
            <el-tag size="small" type="success" effect="plain">
              <el-icon><TrendCharts /></el-icon>
              AI智能评分
            </el-tag>
          </el-tooltip>
          <el-button
            size="small"
            @click="handleRanking(true)"
            :loading="isRanking"
            :disabled="!hasStocks"
          >
            {{ isRanking ? '排序中...' : '刷新' }}
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
            <span v-if="hasCachedResults" class="cache-info">
              · <el-icon><DataAnalysis /></el-icon> 使用缓存
            </span>
          </span>
        </div>

        <div
          v-for="(stock, index) in rankedStocks"
          :key="stock.code"
          class="ranking-item"
          :class="getRankingClass(index)"
        >
          <!-- 第一行：分数 + 股票信息 -->
          <div class="ranking-header-row">
            <!-- 分数 -->
            <div class="score-section">
              <span class="score-value">{{ stock.score }}</span>
              <span class="score-max">/ {{ stock.maxScore }}</span>
            </div>

            <!-- 股票信息 -->
            <div class="stock-section">
              <span class="stock-name">{{ stock.name }}</span>
              <span class="stock-code">{{ stock.code }}</span>
            </div>
          </div>

          <!-- 第二行：AI评分详情 -->
          <div class="ranking-detail-row">
            <div v-if="stock.scoreReason" class="score-reason">
              <div class="reason-text">{{ formatScoreReason(stock.scoreReason) }}</div>
            </div>
            <div v-else class="no-score-reason">
              <span class="no-score-text">暂无评分</span>
            </div>
          </div>

        </div>
      </div>

      <!-- 未排序状态 -->
      <div v-else class="unranked-state">
        <el-empty description="点击'刷新'获取智能交易建议">
          <template #image>
            <el-icon size="60" color="#409EFF"><Trophy /></el-icon>
          </template>
          <p class="unranked-text">
            AI将根据以下维度进行综合评分（0-100分）：<br>
            ✅ 概念匹配度（0-40分）：题材热度与涨停原因匹配<br>
            ✅ 量价健康度（0-40分）：超短线量价关系分析<br>
            ✅ 技术形态加分（0-20分）：龙回头、突破等形态<br>
            ⚠️ 风险减分项：跌停、破位、出货等信号扣分<br><br>
            <el-tag size="small" type="warning" effect="plain">
              🤖 AI严格执行减分项，宁可错过不接盘高风险股票
            </el-tag>
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
  Trophy,
  DataAnalysis
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
defineEmits([])

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

const hasCachedResults = computed(() => {
  return rankedStocks.value.some(stock => stock.fromCache === true)
})

// 监听股票列表变化，自动重新排序
watch(() => props.stocks, async (newStocks, oldStocks) => {
  const hasNewStocks = newStocks && newStocks.length > 0
  const hadOldStocks = oldStocks && oldStocks.length > 0

  // 检查是否是股票列表内容的实质性变化（而非价格等实时数据更新）
  const isStructuralChange = hasStructuralChange(newStocks, oldStocks)

  // 情况1：从无股票到有股票，自动执行第一次排序
  if (hasNewStocks && !hadOldStocks) {
    await handleRanking()
    return
  }

  // 情况2：股票结构变化（添加/删除股票），自动重新排序
  if (isStructuralChange && hasNewStocks) {
    console.log('[StockRanking] 检测到股票列表结构变化，自动触发AI分析排序')
    await handleRanking()
  }
}, { deep: true })

// 方法

/**
 * 检查股票列表是否发生结构性变化
 * @param {Array} newStocks - 新的股票列表
 * @param {Array} oldStocks - 旧的股票列表
 * @returns {Boolean} 是否发生结构性变化
 */
const hasStructuralChange = (newStocks, oldStocks) => {
  // 如果任一为空或不是数组，按变化处理
  if (!Array.isArray(newStocks) || !Array.isArray(oldStocks)) {
    return true
  }

  // 数量变化
  if (newStocks.length !== oldStocks.length) {
    return true
  }

  // 检查股票代码列表是否相同
  const newCodes = new Set(newStocks.map(stock => stock.code).filter(Boolean))
  const oldCodes = new Set(oldStocks.map(stock => stock.code).filter(Boolean))

  // 比较代码集合
  if (newCodes.size !== oldCodes.size) {
    return true
  }

  for (const code of newCodes) {
    if (!oldCodes.has(code)) {
      return true
    }
  }

  return false
}

const handleRanking = async (forceRefresh = false) => {
  if (!hasStocks.value) {
    ElMessage.warning('请先添加监控股票')
    return
  }

  if (isRanking.value) {
    return
  }

  try {
    isRanking.value = true
    if (forceRefresh) {
      ElMessage.info('强制刷新智能排序（跳过缓存）...')
    } else {
      ElMessage.info('开始刷新智能排序...')
    }

    // 调用排序服务
    const result = await stockRankingService.rankStocks(
      props.stocks,
      props.conceptRanking,
      forceRefresh  // 传递强制刷新参数
    )

    rankedStocks.value = result
    lastRankingTime.value = new Date()

    ElMessage.success(`刷新完成！共分析 ${result.length} 只股票`)

  } catch (error) {
    console.error('股票排序失败:', error)
    ElMessage.error(`刷新失败: ${error.message}`)
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

const formatScoreReason = (reason) => {
  if (!reason) return ''
  // AI统一用 + 连接所有项（包括减分项），直接替换为换行符即可
  return reason.replace(/\s*\+\s*/g, '\n').trim()
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

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
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

.cache-info {
  color: #409EFF;
  font-weight: 500;
}

.cache-info .el-icon {
  vertical-align: middle;
  margin-right: 2px;
}

.ranking-item {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  background: white;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
  gap: 8px;
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

/* 第一行：分数 + 股票信息 */
.ranking-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.score-section {
  display: flex;
  align-items: baseline;
  gap: 2px;
  min-width: 70px;
}

.score-value {
  font-size: 20px;
  font-weight: bold;
  color: #409EFF;
}

.score-max {
  font-size: 13px;
  color: #999;
}

/* 股票信息区域 */
.stock-section {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.stock-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.stock-code {
  font-size: 12px;
  color: #909399;
}

/* 第二行：评分详情 */
.ranking-detail-row {
  width: 100%;
}

/* AI评分理由显示 */
.score-reason {
  width: 100%;
}

.reason-text {
  font-size: 12px;
  line-height: 1.8;
  color: #606266;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 6px;
  word-break: break-word;
  white-space: pre-line; /* 保留换行符，自动将 + 换行 */
}

/* 无评分状态 */
.no-score-reason {
  width: 100%;
  display: flex;
  align-items: center;
}

.no-score-text {
  font-size: 12px;
  color: #909399;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid #dcdfe6;
}




/* 响应式适配 */
@media (max-width: 768px) {
  .score-value {
    font-size: 18px;
  }

  .score-max {
    font-size: 12px;
  }

  .stock-name {
    font-size: 13px;
  }

  .stock-code {
    font-size: 11px;
  }

  .reason-text {
    font-size: 11px;
    padding: 6px 10px;
    line-height: 1.6;
  }

  .no-score-text {
    font-size: 11px;
    padding: 6px 10px;
  }
}
</style>