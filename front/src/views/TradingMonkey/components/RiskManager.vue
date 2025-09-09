<template>
  <el-card class="risk-manager-card">
    <template #header>
      <div class="card-header">
        <span>🛡️ 风险管理</span>
        <div class="risk-status">
          <el-tag :type="getRiskTagType(overallRisk)" size="small">
            {{ getRiskText(overallRisk) }}
          </el-tag>
          <el-button size="small" @click="showConfigDialog = true">设置</el-button>
        </div>
      </div>
    </template>

    <!-- 风险概览 -->
    <div class="risk-overview">
      <div class="overview-grid">
        <div class="overview-item">
          <div class="item-label">总风险敞口</div>
          <div class="item-value" :style="{ color: getRiskColor(overallRisk) }">
            {{ (riskReport.totalRisk * 100).toFixed(1) }}%
          </div>
          <div class="item-progress">
            <el-progress 
              :percentage="riskReport.totalRisk * 100" 
              :color="getRiskColor(overallRisk)"
              :show-text="false"
              :stroke-width="6"
            />
          </div>
        </div>
        
        <div class="overview-item">
          <div class="item-label">今日盈亏</div>
          <div class="item-value" :class="getDailyPnLClass(riskReport.dailyPnLPercent)">
            {{ riskReport.dailyPnLPercent }}%
          </div>
          <div class="item-desc">
            {{ parseFloat(riskReport.dailyPnLPercent) > 0 ? '盈利' : '亏损' }}
          </div>
        </div>
        
        <div class="overview-item">
          <div class="item-label">持仓数量</div>
          <div class="item-value">{{ riskReport.positionCount }}</div>
          <div class="item-desc">只股票</div>
        </div>
        
        <div class="overview-item">
          <div class="item-label">最大单仓</div>
          <div class="item-value">{{ getLargestPositionPercent() }}%</div>
          <div class="item-desc">
            {{ riskReport.largestPosition?.证券名称 || riskReport.largestPosition?.stockName || '-' }}
          </div>
        </div>
      </div>
    </div>

    <!-- 止损预警 -->
    <div class="stop-loss-alerts" v-if="stopLossAlerts.length > 0">
      <div class="alerts-header">
        <span>🚨 止损预警 ({{ stopLossAlerts.length }})</span>
        <el-button size="small" @click="refreshAlerts" :loading="loading.alerts">刷新</el-button>
      </div>
      
      <div class="alerts-list">
        <div 
          v-for="alert in stopLossAlerts" 
          :key="alert.stockCode"
          class="alert-item"
          :class="getAlertClass(alert)"
        >
          <div class="alert-header">
            <span class="stock-info">{{ alert.stockCode }} {{ alert.stockName }}</span>
            <el-tag type="danger" size="small">止损</el-tag>
          </div>
          <div class="alert-details">
            <div class="price-info">
              <span>成本: ¥{{ alert.costPrice.toFixed(2) }}</span>
              <span>现价: ¥{{ alert.currentPrice.toFixed(2) }}</span>
              <span class="loss-percent">亏损: {{ alert.lossPercent }}%</span>
            </div>
            <div class="loss-amount">
              亏损金额: ¥{{ alert.lossAmount.toFixed(2) }}
            </div>
          </div>
          <div class="alert-actions">
            <el-button 
              type="danger" 
              size="small"
              @click="executeSell(alert)"
              :loading="loading.sell"
            >
              立即卖出
            </el-button>
            <el-button size="small" @click="ignoreAlert(alert)">忽略</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 止盈建议 -->
    <div class="take-profit-suggestions" v-if="takeProfitAlerts.length > 0">
      <div class="suggestions-header">
        <span>💰 止盈建议 ({{ takeProfitAlerts.length }})</span>
        <el-button size="small" @click="refreshAlerts" :loading="loading.alerts">刷新</el-button>
      </div>
      
      <div class="suggestions-list">
        <div 
          v-for="suggestion in takeProfitAlerts" 
          :key="suggestion.stockCode"
          class="suggestion-item"
        >
          <div class="suggestion-header">
            <span class="stock-info">{{ suggestion.stockCode }} {{ suggestion.stockName }}</span>
            <el-tag type="success" size="small">止盈</el-tag>
          </div>
          <div class="suggestion-details">
            <div class="price-info">
              <span>成本: ¥{{ suggestion.costPrice.toFixed(2) }}</span>
              <span>现价: ¥{{ suggestion.currentPrice.toFixed(2) }}</span>
              <span class="profit-percent">盈利: +{{ suggestion.profitPercent }}%</span>
            </div>
            <div class="profit-amount">
              盈利金额: +¥{{ suggestion.profitAmount.toFixed(2) }}
            </div>
          </div>
          <div class="suggestion-actions">
            <el-button 
              type="success" 
              size="small"
              @click="executeSell(suggestion, 'profit')"
              :loading="loading.sell"
            >
              获利了结
            </el-button>
            <el-button size="small" @click="setTrailingStop(suggestion)">设置跟踪止损</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 风险建议 -->
    <div class="risk-recommendations" v-if="riskReport.recommendations?.length > 0">
      <div class="recommendations-header">📋 风险建议</div>
      <ul class="recommendations-list">
        <li v-for="(rec, index) in riskReport.recommendations" :key="index">
          {{ rec }}
        </li>
      </ul>
    </div>

    <!-- 无预警状态 -->
    <div v-if="stopLossAlerts.length === 0 && takeProfitAlerts.length === 0" class="no-alerts">
      <el-icon><SuccessFilled /></el-icon>
      <span>当前无风险预警</span>
    </div>

    <!-- 风险配置对话框 -->
    <el-dialog v-model="showConfigDialog" title="风险管理配置" width="600px">
      <el-form :model="configForm" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="风险等级">
              <el-select v-model="configForm.riskLevel">
                <el-option label="保守" value="conservative" />
                <el-option label="平衡" value="balanced" />
                <el-option label="激进" value="aggressive" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单股最大仓位">
              <el-input-number 
                v-model="configForm.maxPositionSize" 
                :min="0.05" 
                :max="0.5" 
                :step="0.01"
                :precision="2"
              />
              <span style="margin-left: 8px; font-size: 12px; color: #999;">比例</span>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="止损比例">
              <el-input-number 
                v-model="configForm.stopLossPercent" 
                :min="0.02" 
                :max="0.3" 
                :step="0.01"
                :precision="2"
              />
              <span style="margin-left: 8px; font-size: 12px; color: #999;">比例</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="止盈比例">
              <el-input-number 
                v-model="configForm.takeProfitPercent" 
                :min="0.05" 
                :max="0.5" 
                :step="0.01"
                :precision="2"
              />
              <span style="margin-left: 8px; font-size: 12px; color: #999;">比例</span>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最大日亏损">
              <el-input-number 
                v-model="configForm.maxDailyLoss" 
                :min="0.01" 
                :max="0.2" 
                :step="0.01"
                :precision="2"
              />
              <span style="margin-left: 8px; font-size: 12px; color: #999;">比例</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="紧急止损">
              <el-input-number 
                v-model="configForm.emergencyStopLoss" 
                :min="0.1" 
                :max="0.5" 
                :step="0.01"
                :precision="2"
              />
              <span style="margin-left: 8px; font-size: 12px; color: #999;">比例</span>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="最大总风险敞口">
          <el-input-number 
            v-model="configForm.maxTotalRisk" 
            :min="0.5" 
            :max="1" 
            :step="0.1"
            :precision="1"
          />
          <span style="margin-left: 8px; font-size: 12px; color: #999;">比例</span>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { SuccessFilled } from '@element-plus/icons-vue'
import { 
  RiskManager, 
  RISK_LEVELS, 
  formatRiskLevel, 
  getRiskColor 
} from '../services/riskManager.js'

// Props
const props = defineProps({
  positionData: {
    type: Array,
    default: () => []
  },
  currentPrices: {
    type: Object,
    default: () => ({})
  },
  availableFunds: {
    type: Number,
    default: 0
  },
  dailyPnL: {
    type: Number,
    default: 0
  }
})

// Emits  
const emit = defineEmits(['execute-order', 'set-trailing-stop'])

// 响应式数据
const showConfigDialog = ref(false)
const loading = ref({
  alerts: false,
  sell: false
})

const stopLossAlerts = ref([])
const takeProfitAlerts = ref([])
const overallRisk = ref('low')

// 风险管理器实例
let riskManager = null

// 配置数据
const config = ref({
  riskLevel: RISK_LEVELS.BALANCED,
  maxPositionSize: 0.2,
  maxTotalRisk: 0.8,
  stopLossPercent: 0.08,
  takeProfitPercent: 0.15,
  maxDailyLoss: 0.05,
  emergencyStopLoss: 0.15
})

const configForm = reactive({ ...config.value })

// 计算属性
const riskReport = computed(() => {
  if (!riskManager || props.positionData.length === 0) {
    return {
      portfolioValue: 0,
      totalRisk: 0,
      dailyPnLPercent: '0.00',
      positionCount: 0,
      largestPosition: null,
      riskLevel: 'low',
      recommendations: []
    }
  }
  
  const report = riskManager.getRiskReport(props.positionData)
  overallRisk.value = report.riskLevel
  return report
})

// 方法
const initRiskManager = () => {
  riskManager = new RiskManager(config.value)
  if (props.dailyPnL !== undefined) {
    riskManager.updateDailyPnL(props.dailyPnL)
  }
}

const refreshAlerts = async () => {
  if (!riskManager || props.positionData.length === 0) return
  
  loading.value.alerts = true
  
  try {
    // 检查止损
    const stopLossResults = riskManager.checkStopLoss(props.positionData, props.currentPrices)
    stopLossAlerts.value = stopLossResults
    
    // 检查止盈
    const takeProfitResults = riskManager.checkTakeProfit(props.positionData, props.currentPrices)
    takeProfitAlerts.value = takeProfitResults
    
    console.log('风险检查完成:', {
      stopLoss: stopLossResults.length,
      takeProfit: takeProfitResults.length
    })
  } catch (error) {
    console.error('刷新风险预警失败:', error)
    ElMessage.error('刷新失败')
  } finally {
    loading.value.alerts = false
  }
}

const executeSell = async (alert, type = 'stop_loss') => {
  const action = type === 'profit' ? '止盈' : '止损'
  
  try {
    await ElMessageBox.confirm(
      `确认${action}卖出 ${alert.stockCode} ${alert.stockName}？`,
      `${action}确认`,
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: type === 'profit' ? 'success' : 'warning'
      }
    )
    
    loading.value.sell = true
    
    // 发送卖出订单事件
    emit('execute-order', {
      action: 'sell',
      stockCode: alert.stockCode,
      stockName: alert.stockName,
      quantity: alert.quantity,
      price: alert.currentPrice,
      type: type,
      reason: type === 'profit' ? `止盈卖出，盈利${alert.profitPercent}%` : `止损卖出，亏损${alert.lossPercent}%`
    })
    
    ElMessage.success(`${action}订单已提交`)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('执行卖出失败:', error)
      ElMessage.error('执行失败')
    }
  } finally {
    loading.value.sell = false
  }
}

const setTrailingStop = (alert) => {
  ElMessageBox.prompt('请输入跟踪止损比例', '设置跟踪止损', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    inputValue: '5',
    inputType: 'number',
    inputValidator: (value) => {
      const num = parseFloat(value)
      return num >= 1 && num <= 20 ? true : '请输入1-20之间的数值'
    }
  }).then(({ value }) => {
    const trailingPercent = parseFloat(value) / 100
    riskManager.setTrailingStop(alert.stockCode, alert.currentPrice, trailingPercent)
    
    emit('set-trailing-stop', {
      stockCode: alert.stockCode,
      stockName: alert.stockName,
      currentPrice: alert.currentPrice,
      trailingPercent: trailingPercent
    })
    
    ElMessage.success(`已为${alert.stockCode}设置${value}%跟踪止损`)
  }).catch(() => {
    // 用户取消
  })
}

const ignoreAlert = (alert) => {
  const isStopLoss = stopLossAlerts.value.some(a => a.stockCode === alert.stockCode)
  
  if (isStopLoss) {
    const index = stopLossAlerts.value.findIndex(a => a.stockCode === alert.stockCode)
    if (index > -1) stopLossAlerts.value.splice(index, 1)
  } else {
    const index = takeProfitAlerts.value.findIndex(a => a.stockCode === alert.stockCode)
    if (index > -1) takeProfitAlerts.value.splice(index, 1)
  }
  
  ElMessage.info('已忽略预警')
}

const saveConfig = () => {
  config.value = { ...configForm }
  
  // 重新初始化风险管理器
  initRiskManager()
  
  // 保存到本地存储
  localStorage.setItem('risk_manager_config', JSON.stringify(config.value))
  
  showConfigDialog.value = false
  ElMessage.success('配置已保存')
  
  // 重新检查预警
  refreshAlerts()
}

// 辅助函数
const getRiskTagType = (risk) => {
  const types = { low: 'success', medium: 'warning', high: 'danger' }
  return types[risk] || 'info'
}

const getRiskText = (risk) => {
  const texts = { low: '低风险', medium: '中风险', high: '高风险' }
  return texts[risk] || '未知'
}

const getDailyPnLClass = (percent) => {
  const num = parseFloat(percent)
  if (num > 0) return 'profit-text'
  if (num < 0) return 'loss-text'
  return ''
}

const getLargestPositionPercent = () => {
  if (!riskReport.value.largestPosition || !riskReport.value.portfolioValue) return '0.0'
  
  const largestValue = parseFloat(
    riskReport.value.largestPosition.市值 || 
    riskReport.value.largestPosition.marketValue || 
    0
  )
  return ((largestValue / riskReport.value.portfolioValue) * 100).toFixed(1)
}

const getAlertClass = (alert) => {
  const lossPercent = parseFloat(alert.lossPercent)
  if (lossPercent > 15) return 'alert-critical'
  if (lossPercent > 10) return 'alert-high'
  return 'alert-medium'
}

// 生命周期
onMounted(() => {
  // 加载配置
  const savedConfig = localStorage.getItem('risk_manager_config')
  if (savedConfig) {
    try {
      Object.assign(config.value, JSON.parse(savedConfig))
      Object.assign(configForm, config.value)
    } catch (error) {
      console.error('加载风险管理配置失败:', error)
    }
  }
  
  // 初始化风险管理器
  initRiskManager()
})

// 监听数据变化
watch([() => props.positionData, () => props.currentPrices], () => {
  if (riskManager && props.positionData.length > 0) {
    setTimeout(() => refreshAlerts(), 1000)
  }
}, { deep: true })

watch(() => props.dailyPnL, (newPnL) => {
  if (riskManager && typeof newPnL === 'number') {
    riskManager.updateDailyPnL(newPnL)
  }
})
</script>

<style scoped>
.risk-manager-card {
  margin-bottom: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.risk-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.risk-overview {
  margin-bottom: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
}

.overview-item {
  text-align: center;
  padding: 12px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.item-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.item-value {
  font-size: 20px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.item-desc {
  font-size: 11px;
  color: #999;
}

.item-progress {
  margin-top: 8px;
}

.stop-loss-alerts,
.take-profit-suggestions {
  margin-bottom: 15px;
}

.alerts-header,
.suggestions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: bold;
  font-size: 14px;
}

.alerts-list,
.suggestions-list {
  max-height: 200px;
  overflow-y: auto;
}

.alert-item,
.suggestion-item {
  padding: 12px;
  margin-bottom: 8px;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #f56c6c;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.suggestion-item {
  border-left-color: #67c23a;
}

.alert-item.alert-critical {
  border-left-color: #ff0000;
  background: #fff5f5;
}

.alert-item.alert-high {
  border-left-color: #f56c6c;
}

.alert-item.alert-medium {
  border-left-color: #e6a23c;
}

.alert-header,
.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.stock-info {
  font-weight: 500;
  color: #333;
}

.alert-details,
.suggestion-details {
  margin-bottom: 10px;
}

.price-info {
  display: flex;
  gap: 15px;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.loss-percent {
  color: #f56c6c;
  font-weight: 500;
}

.profit-percent {
  color: #67c23a;
  font-weight: 500;
}

.loss-amount,
.profit-amount {
  font-size: 12px;
  font-weight: 500;
}

.loss-amount {
  color: #f56c6c;
}

.profit-amount {
  color: #67c23a;
}

.alert-actions,
.suggestion-actions {
  display: flex;
  gap: 5px;
}

.risk-recommendations {
  margin-bottom: 15px;
  padding: 12px;
  background: #f0f9ff;
  border-left: 4px solid #409eff;
  border-radius: 4px;
}

.recommendations-header {
  font-weight: bold;
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
}

.recommendations-list {
  margin: 0;
  padding-left: 16px;
}

.recommendations-list li {
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.no-alerts {
  text-align: center;
  padding: 30px;
  color: #67c23a;
}

.no-alerts .el-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.profit-text {
  color: #67c23a;
}

.loss-text {
  color: #f56c6c;
}

@media (max-width: 768px) {
  .overview-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  
  .price-info {
    flex-direction: column;
    gap: 4px;
  }
}
</style>