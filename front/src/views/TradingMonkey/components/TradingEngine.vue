<template>
  <el-card class="trading-engine-card">
    <template #header>
      <div class="card-header">
        <span>🤖 智能交易引擎</span>
        <div class="engine-status">
          <el-tag :type="engineRunning ? 'success' : 'info'" size="small">
            {{ engineRunning ? '运行中' : '已停止' }}
          </el-tag>
          <el-switch 
            v-model="engineRunning"
            @change="toggleEngine"
            :loading="loading.engine"
            active-text="启动"
            inactive-text="停止"
            size="small"
          />
        </div>
      </div>
    </template>

    <!-- 策略配置 -->
    <div class="strategy-config">
      <div class="config-header">
        <span>策略配置</span>
        <el-button size="small" @click="showConfigDialog = true">设置</el-button>
      </div>
      
      <div class="config-summary">
        <div class="config-item">
          <span class="label">风险等级:</span>
          <el-tag size="small" :type="getRiskLevelType(config.riskLevel)">
            {{ getRiskLevelText(config.riskLevel) }}
          </el-tag>
        </div>
        <div class="config-item">
          <span class="label">启用策略:</span>
          <span class="value">{{ enabledStrategies.length }}个</span>
        </div>
        <div class="config-item">
          <span class="label">检查间隔:</span>
          <span class="value">{{ config.checkInterval }}秒</span>
        </div>
      </div>
    </div>

    <!-- 实时信号 -->
    <div class="live-signals" v-if="engineRunning">
      <div class="signals-header">
        <span>实时信号 ({{ signals.length }})</span>
        <el-button size="small" @click="clearSignals">清空</el-button>
      </div>
      
      <div class="signals-list" v-if="signals.length > 0">
        <div 
          v-for="signal in signals.slice(0, 5)" 
          :key="`${signal.stockCode}-${signal.timestamp}`"
          class="signal-item"
          :class="getSignalClass(signal.type)"
        >
          <div class="signal-header">
            <span class="stock-info">{{ signal.stockCode }} {{ signal.stockName }}</span>
            <el-tag 
              :type="getSignalTagType(signal.type)" 
              size="small"
            >
              {{ getSignalText(signal.type) }}
            </el-tag>
          </div>
          <div class="signal-details">
            <div class="signal-meta">
              <span class="confidence">置信度: {{ (signal.confidence * 100).toFixed(0) }}%</span>
              <span class="strength">强度: {{ '★'.repeat(signal.strength) }}</span>
              <span class="time">{{ formatTime(signal.timestamp) }}</span>
            </div>
            <div class="signal-reason">{{ signal.reason }}</div>
          </div>
          <div class="signal-actions" v-if="signal.type !== 'hold'">
            <el-button 
              size="small" 
              type="primary"
              @click="executeSignal(signal)"
              :loading="loading.execute"
            >
              执行
            </el-button>
            <el-button size="small" @click="ignoreSignal(signal)">忽略</el-button>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-signals">
        <el-icon><TrendCharts /></el-icon>
        <span>等待交易信号...</span>
      </div>
    </div>

    <!-- 停止状态提示 -->
    <div v-else class="engine-stopped">
      <el-icon><VideoPause /></el-icon>
      <span>交易引擎已停止，启动后开始监控交易信号</span>
    </div>

    <!-- 执行统计 -->
    <div class="execution-stats" v-if="stats.totalSignals > 0">
      <div class="stats-header">执行统计</div>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalSignals }}</div>
          <div class="stat-label">总信号数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.executedSignals }}</div>
          <div class="stat-label">已执行</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.successRate }}%</div>
          <div class="stat-label">成功率</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatCurrency(stats.totalProfit) }}</div>
          <div class="stat-label">累计收益</div>
        </div>
      </div>
    </div>

    <!-- 配置对话框 -->
    <el-dialog v-model="showConfigDialog" title="交易引擎配置" width="500px">
      <el-form :model="configForm" label-width="100px">
        <el-form-item label="风险等级">
          <el-select v-model="configForm.riskLevel">
            <el-option label="保守" value="low" />
            <el-option label="平衡" value="medium" />
            <el-option label="激进" value="high" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="检查间隔">
          <el-input-number 
            v-model="configForm.checkInterval" 
            :min="10" 
            :max="300" 
            :step="10"
          />
          <span style="margin-left: 8px; color: #999; font-size: 12px;">秒</span>
        </el-form-item>
        
        <el-form-item label="启用策略">
          <el-checkbox-group v-model="configForm.strategies">
            <el-checkbox 
              v-for="strategy in availableStrategies" 
              :key="strategy.type"
              :label="strategy.type"
            >
              {{ strategy.name }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        
        <el-form-item label="自动执行">
          <el-switch 
            v-model="configForm.autoExecute"
            active-text="开启"
            inactive-text="关闭"
          />
          <div style="font-size: 12px; color: #999; margin-top: 4px;">
            开启后将自动执行交易信号，请谨慎使用
          </div>
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
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { TrendCharts, VideoPause } from '@element-plus/icons-vue'
import { 
  TradingDecisionEngine, 
  SIGNAL_TYPES, 
  getSignalText, 
  getSignalColor 
} from '../services/decisionEngine.js'
import { strategyManager } from '@/strategies/index.js'

// Props
const props = defineProps({
  stockData: {
    type: Array,
    default: () => []
  },
  marketData: {
    type: Object,
    default: () => ({})
  },
  analysisResults: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['execute-signal', 'engine-status-changed'])

// 响应式数据
const engineRunning = ref(false)
const showConfigDialog = ref(false)
const loading = ref({
  engine: false,
  execute: false
})

const signals = ref([])
const stats = ref({
  totalSignals: 0,
  executedSignals: 0,
  successRate: 0,
  totalProfit: 0
})

// 配置数据
const config = ref({
  riskLevel: 'medium',
  checkInterval: 30,
  strategies: ['sell_point_analysis'],
  autoExecute: false
})

const configForm = reactive({ ...config.value })

// 交易引擎实例
let decisionEngine = null
let engineInterval = null

// 计算属性
const availableStrategies = computed(() => {
  return strategyManager.getAvailableStrategies()
})

const enabledStrategies = computed(() => {
  return availableStrategies.value.filter(s => config.value.strategies.includes(s.type))
})

// 方法
const toggleEngine = async (running) => {
  loading.value.engine = true
  
  try {
    if (running) {
      await startEngine()
    } else {
      await stopEngine()
    }
    emit('engine-status-changed', running)
  } catch (error) {
    console.error('切换引擎状态失败:', error)
    ElMessage.error('操作失败')
    engineRunning.value = !running
  } finally {
    loading.value.engine = false
  }
}

const startEngine = async () => {
  // 创建决策引擎实例
  decisionEngine = new TradingDecisionEngine({
    strategies: config.value.strategies,
    riskLevel: config.value.riskLevel,
    marketConditions: props.marketData
  })
  
  // 启动定时检查
  engineInterval = setInterval(async () => {
    await checkSignals()
  }, config.value.checkInterval * 1000)
  
  ElMessage.success('交易引擎已启动')
  console.log('交易引擎启动成功')
}

const stopEngine = async () => {
  if (engineInterval) {
    clearInterval(engineInterval)
    engineInterval = null
  }
  
  decisionEngine = null
  ElMessage.info('交易引擎已停止')
  console.log('交易引擎停止')
}

const checkSignals = async () => {
  if (!decisionEngine || props.stockData.length === 0) return
  
  try {
    for (const stock of props.stockData) {
      const analysisResult = props.analysisResults[stock.code]
      
      if (analysisResult) {
        const signal = decisionEngine.generateTradingSignal(
          stock,
          analysisResult,
          props.marketData
        )
        
        // 只保留有意义的信号
        if (signal.type !== SIGNAL_TYPES.HOLD && signal.confidence > 0.3) {
          addSignal(signal)
          stats.value.totalSignals++
          
          // 自动执行
          if (config.value.autoExecute) {
            setTimeout(() => executeSignal(signal), 1000)
          }
        }
      }
    }
  } catch (error) {
    console.error('检查信号失败:', error)
  }
}

const addSignal = (signal) => {
  // 避免重复信号
  const exists = signals.value.some(s => 
    s.stockCode === signal.stockCode && 
    s.type === signal.type &&
    Date.now() - new Date(s.timestamp).getTime() < 60000 // 1分钟内的重复信号
  )
  
  if (!exists) {
    signals.value.unshift(signal)
    
    // 保留最近20条信号
    if (signals.value.length > 20) {
      signals.value.pop()
    }
  }
}

const executeSignal = async (signal) => {
  loading.value.execute = true
  
  try {
    // 发送执行事件到父组件
    emit('execute-signal', signal)
    
    // 更新统计
    stats.value.executedSignals++
    
    // 从信号列表中移除
    const index = signals.value.findIndex(s => 
      s.stockCode === signal.stockCode && s.timestamp === signal.timestamp
    )
    if (index > -1) {
      signals.value.splice(index, 1)
    }
    
    ElMessage.success(`已执行${getSignalText(signal.type)}信号: ${signal.stockCode}`)
  } catch (error) {
    console.error('执行信号失败:', error)
    ElMessage.error('执行失败')
  } finally {
    loading.value.execute = false
  }
}

const ignoreSignal = (signal) => {
  const index = signals.value.findIndex(s => 
    s.stockCode === signal.stockCode && s.timestamp === signal.timestamp
  )
  if (index > -1) {
    signals.value.splice(index, 1)
    ElMessage.info('已忽略信号')
  }
}

const clearSignals = () => {
  signals.value = []
  ElMessage.info('已清空信号列表')
}

const saveConfig = () => {
  config.value = { ...configForm }
  
  // 如果引擎正在运行，重启以应用新配置
  if (engineRunning.value) {
    stopEngine()
    setTimeout(() => {
      startEngine()
    }, 1000)
  }
  
  // 保存到本地存储
  localStorage.setItem('trading_engine_config', JSON.stringify(config.value))
  
  showConfigDialog.value = false
  ElMessage.success('配置已保存')
}

// 辅助函数
const getRiskLevelType = (level) => {
  const types = { low: 'success', medium: 'warning', high: 'danger' }
  return types[level] || 'info'
}

const getRiskLevelText = (level) => {
  const texts = { low: '保守', medium: '平衡', high: '激进' }
  return texts[level] || '未知'
}

const getSignalClass = (type) => {
  return `signal-${type.replace('_', '-')}`
}

const getSignalTagType = (type) => {
  const types = {
    [SIGNAL_TYPES.STRONG_BUY]: 'danger',
    [SIGNAL_TYPES.BUY]: 'warning', 
    [SIGNAL_TYPES.SELL]: 'success',
    [SIGNAL_TYPES.STRONG_SELL]: 'info',
    [SIGNAL_TYPES.HOLD]: ''
  }
  return types[type] || ''
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(amount)
}

// 生命周期
onMounted(() => {
  // 加载配置
  const savedConfig = localStorage.getItem('trading_engine_config')
  if (savedConfig) {
    try {
      Object.assign(config.value, JSON.parse(savedConfig))
      Object.assign(configForm, config.value)
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }
})

onUnmounted(() => {
  if (engineRunning.value) {
    stopEngine()
  }
})

// 监听配置变化
watch(() => config.value, (newConfig) => {
  if (decisionEngine) {
    decisionEngine.riskLevel = newConfig.riskLevel
    decisionEngine.strategies = newConfig.strategies
  }
}, { deep: true })
</script>

<style scoped>
.trading-engine-card {
  margin-bottom: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.engine-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.strategy-config {
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: bold;
  font-size: 14px;
}

.config-summary {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.config-item .label {
  color: #666;
}

.config-item .value {
  font-weight: 500;
}

.live-signals {
  margin-bottom: 15px;
}

.signals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: bold;
  font-size: 14px;
}

.signals-list {
  max-height: 300px;
  overflow-y: auto;
}

.signal-item {
  padding: 10px;
  margin-bottom: 8px;
  background: white;
  border-radius: 4px;
  border-left: 4px solid #ddd;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.signal-item.signal-buy {
  border-left-color: #e6a23c;
}

.signal-item.signal-strong-buy {
  border-left-color: #f56c6c;
}

.signal-item.signal-sell {
  border-left-color: #67c23a;
}

.signal-item.signal-strong-sell {
  border-left-color: #409eff;
}

.signal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.stock-info {
  font-weight: 500;
  color: #333;
}

.signal-details {
  margin-bottom: 8px;
}

.signal-meta {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.signal-reason {
  font-size: 12px;
  color: #333;
  line-height: 1.4;
}

.signal-actions {
  display: flex;
  gap: 5px;
}

.empty-signals,
.engine-stopped {
  text-align: center;
  padding: 30px;
  color: #999;
}

.empty-signals .el-icon,
.engine-stopped .el-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.execution-stats {
  margin-top: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.stats-header {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stat-item {
  text-align: center;
  padding: 8px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.stat-value {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 11px;
  color: #666;
}

@media (max-width: 768px) {
  .config-summary {
    flex-direction: column;
    gap: 8px;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .signal-meta {
    flex-direction: column;
    gap: 4px;
  }
}
</style>