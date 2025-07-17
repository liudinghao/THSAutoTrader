<template>
  <el-card class="stock-pool-card" :body-style="{ padding: '20px' }">
    <template #header>
      <div class="card-header">
        <span class="title">股票池管理</span>
        <stock-pool-header
          :stock-pool="stockPool"
          :show-k-line="showKLine"
          @update:show-k-line="showKLine = $event"
          @show-message="$emit('show-message', $event)"
        />
      </div>
    </template>

    <div class="tables-container">
      <stock-table
        v-for="(tableData, index) in [leftTableData, rightTableData]"
        :key="index"
        :table-data="tableData"
        :loading="loading"
        :show-k-line="showKLine"
        @row-click="handleRowClick"
        @sort-change="handleSortChange"
      />
    </div>
  </el-card>
</template>

<script>
import { Delete, Trophy, Star, TrendCharts } from '@element-plus/icons-vue'
import StockTable from '../components/stock/StockTable.vue'
import StockPoolHeader from '../components/StockPoolHeader.vue'
import { jumpToQuote, addSelfStock } from '../utils/quoteApi'
import { indexedDBUtil } from '../utils/indexedDB'
import { stockService } from '../services/stockService'

export default {
  name: 'StockPool',
  components: {
    Delete,
    Trophy,
    Star,
    TrendCharts,
    StockTable,
    StockPoolHeader
  },
  props: {
    loading: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      stockPool: [],
      loadingDragonPool: false,
      loadingPrices: false,
      sortField: '',
      sortOrder: 'desc',
      addingToSelf: false,
      showKLine: localStorage.getItem('showKLine') !== 'false'
    }
  },
  created() {
    this.initIndexedDB().then(() => {
      this.loadDragonStockPool()
      this.$nextTick(() => {
        this.refreshStockPrices()
      })
    })
  },
  beforeUnmount() {
    stockService.dispose()
  },
  computed: {
    leftTableData() {
      const midPoint = Math.ceil(this.sortedStockPool.length / 2)
      return this.sortedStockPool.slice(0, midPoint)
    },
    rightTableData() {
      const midPoint = Math.ceil(this.sortedStockPool.length / 2)
      return this.sortedStockPool.slice(midPoint)
    },
    sortedStockPool() {
      if (!this.sortField) {
        return this.stockPool
      }
      
      return [...this.stockPool].sort((a, b) => {
        let aValue = a[this.sortField]
        let bValue = b[this.sortField]
        
        if (aValue === null && bValue === null) return 0
        if (aValue === null) return 1
        if (bValue === null) return -1
        
        if (this.sortField === 'reason_type') {
          const aFirstReason = aValue.split('+')[0]?.trim() || ''
          const bFirstReason = bValue.split('+')[0]?.trim() || ''
          return this.sortOrder === 'asc' 
            ? aFirstReason.localeCompare(bFirstReason)
            : bFirstReason.localeCompare(aFirstReason)
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return this.sortOrder === 'asc' ? aValue - bValue : bValue - aValue
        }
        
        return this.sortOrder === 'asc' 
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue))
      })
    }
  },
  methods: {
    async initIndexedDB() {
      try {
        await indexedDBUtil.init()
      } catch (error) {
        console.error('初始化数据库失败:', error)
        this.$emit('show-message', {
          type: 'error',
          message: '初始化数据库失败: ' + error.message
        })
      }
    },
    
    async loadDragonStockPool() {
      this.loadingDragonPool = true
      
      try {
        const dragonStocks = await stockService.fetchDragonStocks()
        await this.updateStockPool(dragonStocks)
        await this.registerQuotePush()
      } catch (error) {
        console.error('加载龙头股票池失败:', error)
        this.$emit('show-message', {
          type: 'error',
          message: '加载龙头股票池失败: ' + error.message
        })
      } finally {
        this.loadingDragonPool = false
      }
    },

    async updateStockPool(dragonStocks) {
      const existingCodes = this.stockPool.map(stock => stock.code)
      const newStocks = dragonStocks.filter(stock => !existingCodes.includes(stock.code))
      
      this.stockPool = [...this.stockPool, ...newStocks]
      
      this.$emit('stock-pool-updated', this.stockPool)
      
      this.$emit('show-message', {
        type: 'success',
        message: `成功加载${newStocks.length}只龙头股票到股票池`
      })

      stockService.loadKLineData(newStocks, (code, data) => {
        const stockIndex = this.stockPool.findIndex(s => s.code === code)
        if (stockIndex !== -1) {
          Object.assign(this.stockPool[stockIndex], data)
        }
      })
    },

    async registerQuotePush() {
      const stockCodes = this.stockPool.map(stock => stock.code)
      stockService.registerQuotePush(stockCodes, (data) => {
        data.forEach(item => {
          const stock = this.stockPool.find(s => s.code === item.code)
          if (stock) {
            const updates = {}
            if (item.price !== undefined && item.price !== null) {
              updates.price = item.price
            }
            if (item.zhangdiefu !== undefined && item.zhangdiefu !== null) {
              updates.change = item.zhangdiefu
            }

            
            if (Object.keys(updates).length > 0) {
              Object.assign(stock, updates)
            }
          }
        })
      })
    },

    async refreshStockPrices() {
      if (this.stockPool.length === 0) {
        this.$emit('show-message', {
          type: 'warning',
          message: '股票池为空，无需刷新'
        })
        return
      }
      
      this.loadingPrices = true
      
      try {
        const stockCodes = this.stockPool.map(stock => stock.code)
        stockService.registerQuotePush(stockCodes, this.handleQuoteData)
        
        this.$emit('show-message', {
          type: 'success',
          message: '股票价格推送注册成功'
        })
      } catch (error) {
        console.error('刷新股票价格失败:', error)
        this.$emit('show-message', {
          type: 'error',
          message: '刷新股票价格失败: ' + error.message
        })
      } finally {
        this.loadingPrices = false
      }
    },
    
    handleRowClick(row) {
      const stockCodes = this.stockPool.map(stock => stock.code)
      jumpToQuote(row.code, stockCodes)
    },

    handleSortChange({ prop, order }) {
      if (!prop) {
        this.sortField = ''
        this.sortOrder = 'desc'
        return
      }
      
      this.sortField = prop
      this.sortOrder = order === 'ascending' ? 'asc' : 'desc'
      
      this.$nextTick(() => {
        this.stockPool = [...this.sortedStockPool]
      })
    },

    async handleAddAllToSelf() {
      this.addingToSelf = true
      try {
        const stockCodes = this.stockPool.map(stock => stock.code)
        await addSelfStock(stockCodes)
        this.$emit('show-message', {
          type: 'success',
          message: '所有股票已添加到自选股'
        })
      } catch (error) {
        console.error('添加自选股失败:', error)
        this.$emit('show-message', {
          type: 'error',
          message: '添加自选股失败: ' + error.message
        })
      } finally {
        this.addingToSelf = false
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
  font-size: var(--font-size-xlarge);
  font-weight: 600;
}

.tables-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-small);
}

/* 表格样式优化 */
:deep(.el-card__header) {
  padding: var(--spacing-small) var(--spacing-base);
}

:deep(.el-table) {
  width: 100% !important;
}

:deep(.el-table__body),
:deep(.el-table__header) {
  width: 100% !important;
}

:deep(.el-table__body-wrapper) {
  overflow-x: auto;
}

:deep(.el-table__row) { 
  height: 30px;
}

:deep(.el-table .cell) {
  padding: 1px var(--spacing-mini);  
}

:deep(.el-table__header .cell) {
  font-weight: 500;
}

:deep(.el-table__body td) {
  padding: 0;
}

:deep(.el-button--small) {
  padding: var(--spacing-mini) var(--spacing-small);
  font-size: var(--font-size-small);
}

:deep(.el-tag--small) {
  padding: 0 var(--spacing-mini);
  height: 20px;
  line-height: 18px;
}

/* 标签基础样式 */
:deep(.el-tag) {
  --tag-bg: var(--tag-info-bg);
  --tag-border: var(--tag-info-border);
  --tag-color: var(--tag-info-color);
  
  background-color: var(--tag-bg);
  border-color: var(--tag-border);
  color: var(--tag-color);
}

/* 标签变体样式 */
:deep(.el-tag--success) {
  --tag-bg: var(--tag-success-bg);
  --tag-border: var(--tag-success-border);
  --tag-color: var(--tag-success-color);
}

:deep(.el-tag--warning) {
  --tag-bg: var(--tag-warning-bg);
  --tag-border: var(--tag-warning-border);
  --tag-color: var(--tag-warning-color);
}

:deep(.el-tag--danger) {
  --tag-bg: var(--tag-danger-bg);
  --tag-border: var(--tag-danger-border);
  --tag-color: var(--tag-danger-color);
}

:deep(.el-tag--info) {
  --tag-bg: var(--tag-info-bg);
  --tag-border: var(--tag-info-border);
  --tag-color: var(--tag-info-color);
}

:deep(.el-tag--primary) {
  --tag-bg: var(--tag-primary-bg);
  --tag-border: var(--tag-primary-border);
  --tag-color: var(--tag-primary-color);
}
</style>