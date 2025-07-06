<template>
  <div class="trading-strategy-container">
    <!-- 左侧策略表单 -->
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
        <el-form-item label="策略名称" required>
          <el-input
            v-model="strategyData.strategyName"
            placeholder="请输入策略名称"
            class="w-full"
          />
        </el-form-item>

        <el-form-item label="策略描述" required>
          <el-input
            v-model="strategyData.strategyDescription"
            type="textarea"
            :rows="8"
            placeholder="请详细描述您的交易策略，包括策略类型、风险偏好、仓位管理、止损设置等"
            class="w-full"
          />
        </el-form-item>

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
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 右侧股票筛选结果 -->
    <el-card class="stock-result-card">
      <template #header>
        <div class="card-header">
          <span class="title">策略筛选结果</span>
          <div class="header-actions">
            <el-button
              type="primary"
              :icon="Search"
              @click="filterStocks"
              :loading="isFiltering"
              :disabled="!isStrategyValid"
            >
              根据策略筛选股票
            </el-button>
            <el-button
              v-if="filteredStocks.length > 0"
              :icon="Refresh"
              @click="clearFilter"
            >
              清空结果
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="isFiltering" class="filtering-status">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在根据策略筛选股票...</span>
      </div>

      <div v-else-if="filteredStocks.length > 0" class="stock-list">
        <div class="result-summary">
          <el-tag type="info">共找到 {{ filteredStocks.length }} 只符合条件的股票</el-tag>
        </div>
        
        <stock-table
          :table-data="filteredStocks"
          :loading="false"
          :show-k-line="false"
          @row-click="handleStockClick"
          @sort-change="handleSortChange"
        />
      </div>

      <div v-else-if="hasFiltered" class="no-result">
        <el-empty description="未找到符合条件的股票" />
      </div>

      <div v-else class="empty-state">
        <el-empty description="请先输入策略信息，然后点击筛选按钮" />
      </div>
    </el-card>
  </div>
</template>

<script>
import { Check, Search, Refresh, Loading } from '@element-plus/icons-vue'
import StockTable from '../components/stock/StockTable.vue'

export default {
  name: 'TradingStrategy',
  components: {
    Check,
    Search,
    Refresh,
    Loading,
    StockTable
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
        strategyName: '',
        strategyDescription: ''
      },
      filteredStocks: [],
      isFiltering: false,
      hasFiltered: false
    }
  },
  computed: {
    isStrategyValid() {
      return this.strategyData.strategyName.trim().length > 0 && 
             this.strategyData.strategyDescription.trim().length > 0
    }
  },
  methods: {
    saveStrategy() {
      if (!this.isStrategyValid) return
      
      const strategy = {
        name: this.strategyData.strategyName.trim(),
        description: this.strategyData.strategyDescription.trim(),
        timestamp: new Date().toISOString()
      }
      
      this.$emit('strategy-saved', strategy)
      
      // 使用 Element Plus 的消息提示
      this.$message({
        type: 'success',
        message: '策略保存成功!'
      })
    },
    
    async filterStocks() {
      if (!this.isStrategyValid) {
        this.$message({
          type: 'warning',
          message: '请先完善策略信息'
        })
        return
      }

      this.isFiltering = true
      this.hasFiltered = true
      
      try {
        // 模拟API调用，实际项目中这里应该调用真实的筛选API
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // 模拟筛选结果数据
        this.filteredStocks = [
          {
            code: '000001',
            name: '平安银行',
            price: 12.34,
            change: 2.5,
            speed: 1.2,
            reason_type: '业绩预增'
          },
          {
            code: '000002',
            name: '万科A',
            price: 18.56,
            change: -1.2,
            speed: -0.8,
            reason_type: '政策利好'
          },
          {
            code: '600036',
            name: '招商银行',
            price: 45.67,
            change: 3.1,
            speed: 1.5,
            reason_type: '技术突破'
          }
        ]
        
        this.$message({
          type: 'success',
          message: `筛选完成，找到 ${this.filteredStocks.length} 只符合条件的股票`
        })
      } catch (error) {
        this.$message({
          type: 'error',
          message: '筛选失败，请重试'
        })
      } finally {
        this.isFiltering = false
      }
    },
    
    clearFilter() {
      this.filteredStocks = []
      this.hasFiltered = false
    },
    
    handleStockClick(stock) {
      console.log('点击股票:', stock)
      // 这里可以添加股票详情查看逻辑
    },
    
    handleSortChange({ prop, order }) {
      console.log('排序变化:', prop, order)
      // 这里可以添加排序逻辑
    },
    
    resetStrategy() {
      this.strategyData = {
        strategyName: '',
        strategyDescription: ''
      }
    },
    
    getStrategy() {
      return {
        name: this.strategyData.strategyName.trim(),
        description: this.strategyData.strategyDescription.trim()
      }
    },
    
    setStrategy(strategy) {
      if (strategy) {
        this.strategyData = {
          strategyName: strategy.name || '',
          strategyDescription: strategy.description || ''
        }
      }
    }
  }
}
</script>

<style scoped>
.trading-strategy-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: 100%;
}

.strategy-card {
  height: fit-content;
}

.stock-result-card {
  height: fit-content;
  min-height: 400px;
}

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

.header-actions {
  display: flex;
  gap: 12px;
}

.filtering-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--el-text-color-regular);
  gap: 12px;
}

.stock-list {
  padding: 20px 0;
}

.result-summary {
  margin-bottom: 20px;
}

.no-result {
  padding: 40px 20px;
}

.empty-state {
  padding: 40px 20px;
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

/* 响应式设计 */
@media (max-width: 1200px) {
  .trading-strategy-container {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .trading-strategy-container {
    gap: 12px;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .el-button {
    width: 100%;
  }
  
  .header-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .header-actions .el-button {
    width: 100%;
  }
}
</style> 