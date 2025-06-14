<template>
  <el-card class="strategy-card">
    <template #header>
      <div class="card-header">
        <span class="title">交易策略</span>
      </div>
    </template>

    <el-form 
      ref="strategyForm"
      :model="strategyData"
      label-position="top"
      class="strategy-form"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="策略类型" required>
            <el-select
              v-model="strategyData.strategyType"
              placeholder="请选择策略类型"
              class="w-full"
            >
              <el-option label="趋势跟踪" value="trend" />
              <el-option label="反转策略" value="reversal" />
              <el-option label="动量策略" value="momentum" />
            </el-select>
          </el-form-item>
        </el-col>
        
        <el-col :span="12">
          <el-form-item label="风险等级" required>
            <el-select
              v-model="strategyData.riskLevel"
              placeholder="请选择风险等级"
              class="w-full"
            >
              <el-option label="低风险" value="low">
                <el-tag type="success" size="small">低风险</el-tag>
              </el-option>
              <el-option label="中等风险" value="medium">
                <el-tag type="warning" size="small">中等风险</el-tag>
              </el-option>
              <el-option label="高风险" value="high">
                <el-tag type="danger" size="small">高风险</el-tag>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="最大仓位 (%)" required>
            <el-input-number
              v-model="strategyData.maxPosition"
              :min="0"
              :max="100"
              :step="5"
              class="w-full"
              placeholder="输入最大仓位比例"
            />
          </el-form-item>
        </el-col>
        
        <el-col :span="12">
          <el-form-item label="止损比例 (%)" required>
            <el-input-number
              v-model="strategyData.stopLoss"
              :min="0"
              :max="50"
              :step="1"
              class="w-full"
              placeholder="输入止损比例"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item>
        <div class="form-actions">
          <el-button
            type="primary"
            :icon="Check"
            @click="saveStrategy"
            :loading="loading"
            :disabled="!isStrategyValid"
          >
            保存策略
          </el-button>
          <el-button
            :icon="Refresh"
            @click="resetStrategy"
          >
            重置
          </el-button>
        </div>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script>
import { Check, Refresh } from '@element-plus/icons-vue'

export default {
  name: 'TradingStrategy',
  components: {
    Check,
    Refresh
  },
  props: {
    loading: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      strategyData: {
        strategyType: '',
        riskLevel: '',
        maxPosition: 50,
        stopLoss: 5
      }
    }
  },
  computed: {
    isStrategyValid() {
      return this.strategyData.strategyType && 
             this.strategyData.riskLevel && 
             this.strategyData.maxPosition > 0 && 
             this.strategyData.stopLoss > 0
    }
  },
  methods: {
    saveStrategy() {
      if (!this.isStrategyValid) return
      
      const strategy = {
        type: this.strategyData.strategyType,
        riskLevel: this.strategyData.riskLevel,
        maxPosition: this.strategyData.maxPosition,
        stopLoss: this.strategyData.stopLoss,
        timestamp: new Date().toISOString()
      }
      
      this.$emit('strategy-saved', strategy)
      
      // 使用 Element Plus 的消息提示
      this.$message({
        type: 'success',
        message: '策略保存成功!'
      })
    },
    
    resetStrategy() {
      this.strategyData = {
        strategyType: '',
        riskLevel: '',
        maxPosition: 50,
        stopLoss: 5
      }
    },
    
    getStrategy() {
      return {
        type: this.strategyData.strategyType,
        riskLevel: this.strategyData.riskLevel,
        maxPosition: this.strategyData.maxPosition,
        stopLoss: this.strategyData.stopLoss
      }
    },
    
    setStrategy(strategy) {
      if (strategy) {
        this.strategyData = {
          strategyType: strategy.type || '',
          riskLevel: strategy.riskLevel || '',
          maxPosition: strategy.maxPosition || 50,
          stopLoss: strategy.stopLoss || 5
        }
      }
    }
  }
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.strategy-form {
  padding: 20px;
  background-color: var(--el-bg-color-page);
  border-radius: 4px;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-select) {
  width: 100%;
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .el-button {
    width: 100%;
  }
}
</style> 