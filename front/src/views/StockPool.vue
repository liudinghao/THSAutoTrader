<template>
  <el-card class="stock-pool-card" :body-style="{ padding: '20px' }">
    <template #header>
      <div class="card-header">
        <span class="title">股票池管理</span>
        <div class="header-actions">
          <el-button 
            type="success" 
            :icon="Trophy"
            @click="loadDragonStockPool"
            :loading="loadingDragonPool"
          >
            加载龙头股票池
          </el-button>
        </div>
      </div>
    </template>

    <!-- 股票池表格 -->
    <el-table
      :data="sortedStockPool"
      style="width: 100%"
      v-loading="loading"
      border
      stripe
      @row-click="handleRowClick"
    >
      <el-table-column prop="name" label="股票信息" min-width="200">
        <template #default="{ row }">
          <div class="stock-info">
            <span class="stock-name">{{ row.name }}</span>
            <span class="stock-code">{{ row.code }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column label="涨速" width="120" align="right" sortable>
        <template #default="{ row }">
          <div v-if="row.speed !== null">
            <el-tag
              :type="row.speed > 0 ? 'success' : row.speed < 0 ? 'danger' : 'info'"
              size="small"
            >
              {{ row.speed > 0 ? '+' : '' }}{{ row.speed?.toFixed(2) }}%
            </el-tag>
          </div>
          <span v-else>--</span>
        </template>
      </el-table-column>
      
      <el-table-column prop="zttj_ct" label="涨停次数" width="120" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.zttj_ct && row.zttj_days" type="info">
            {{ row.zttj_ct }}/{{ row.zttj_days }}
          </el-tag>
          <span v-else>--</span>
        </template>
      </el-table-column>
      
      <el-table-column label="现价/涨跌幅" min-width="150" align="right" sortable>
        <template #default="{ row }">
          <div v-if="row.price !== null">
            <span class="price">￥{{ row.price.toFixed(2) }}</span>
            <el-tag
              :type="row.change > 0 ? 'success' : row.change < 0 ? 'danger' : 'info'"
              size="small"
              class="ml-2"
            >
              {{ row.change > 0 ? '+' : '' }}{{ row.change?.toFixed(2) }}%
            </el-tag>
          </div>
          <span v-else>--</span>
        </template>
      </el-table-column>
      
      <el-table-column label="K线图" min-width="250" align="center">
        <template #default="{ row }">
          <stock-k-line :code="row.code" />
        </template>
      </el-table-column>
      
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ $index }">
          <el-button
            type="danger"
            :icon="Delete"
            @click="removeStock($index)"
            :disabled="loading"
            size="small"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script>
import { Delete, Trophy } from '@element-plus/icons-vue'
import StockKLine from '../components/StockKLine.vue'
import { jumpToQuote } from '../utils/quoteApi'

export default {
  name: 'StockPool',
  components: {
    Delete,
    Trophy,
    StockKLine
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
      sortOrder: 'desc'
    }
  },
  created() {
    // 页面加载时自动加载龙头股票池数据
    this.loadDragonStockPool()
    // 加载完成后自动刷新价格
    this.$nextTick(() => {
      this.refreshStockPrices()
    })
  },
  computed: {
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
        
        return this.sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      })
    }
  },
  methods: {
    removeStock(index) {
      this.stockPool.splice(index, 1)
    },
    
    // 外部调用方法，用于获取股票池数据
    getStockPool() {
      return this.stockPool
    },
    
    // 外部调用方法，用于设置股票池数据
    setStockPool(stockPool) {
      this.stockPool = stockPool || []
    },
    
    // 加载龙头股票池数据
    async loadDragonStockPool() {
      this.loadingDragonPool = true
      
      try {
        const response = await fetch('https://www.wttiao.com/moni/ztpool/dragonCallback')
        const result = await response.json()
        
        if (result.code === 0 && result.data && Array.isArray(result.data)) {
          // 转换数据格式
          const dragonStocks = result.data.map(item => ({
            code: item.code,
            name: item.name,
            date: item.date,
            zttj_days: item.zttj_days,
            zttj_ct: item.zttj_ct,
            price: null,
            change: null
          }))
          
          // 合并股票池，避免重复
          const existingCodes = this.stockPool.map(stock => stock.code)
          const newStocks = dragonStocks.filter(stock => !existingCodes.includes(stock.code))
          
          this.stockPool = [...this.stockPool, ...newStocks]
          
          // 触发事件通知父组件股票池已更新
          this.$emit('stock-pool-updated', this.stockPool)
          
          // 显示成功消息
          this.$emit('show-message', {
            type: 'success',
            message: `成功加载${newStocks.length}只龙头股票到股票池`
          })
          
        } else {
          throw new Error(result.msg || '获取数据失败')
        }
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
    
    // 刷新股票价格（可以集成其他股票价格API）
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
        // 这里可以集成股票价格API，目前只是模拟
        for (let stock of this.stockPool) {
          // 模拟价格数据
          stock.price = Math.random() * 100 + 10
          stock.change = (Math.random() - 0.5) * 20
          stock.speed = (Math.random() - 0.5) * 10 // 模拟涨速数据
        }
        
        this.$emit('show-message', {
          type: 'success',
          message: '股票价格刷新完成'
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
    
    // 按涨跌幅排序
    sortByChange() {
      if (this.sortField === 'change') {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortField = 'change'
        this.sortOrder = 'desc'
      }
    },
    
    // 处理行点击事件
    handleRowClick(row) {
      // 获取所有股票池中的股票代码
      const stockCodes = this.stockPool.map(stock => stock.code)
      jumpToQuote(row.code, stockCodes)
    }
  }
}
</script>

<style scoped>
.stock-pool-card {
  margin: 20px;
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

.header-actions {
  display: flex;
  gap: 10px;
}

.stock-info {
  display: flex;
  flex-direction: column;
}

.stock-name {
  font-weight: 500;
}

.stock-code {
  font-size: 12px;
  color: #909399;
}

.price {
  font-weight: 500;
  margin-right: 8px;
}

.ml-2 {
  margin-left: 8px;
}

:deep(.el-card__header) {
  padding: 15px 20px;
}

:deep(.el-table) {
  width: 100% !important;
}

:deep(.el-table__body) {
  width: 100% !important;
}

:deep(.el-table__header) {
  width: 100% !important;
}

:deep(.el-table__body-wrapper) {
  overflow-x: auto;
}
</style>