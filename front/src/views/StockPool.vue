<template>
  <el-card class="stock-pool-card" :body-style="{ padding: '20px' }">
    <template #header>
      <div class="card-header">
        <span class="title">股票池管理</span>
      </div>
    </template>

    <div class="tables-container">
      <!-- 使用v-for循环渲染两张表 -->
      <el-table
        v-for="(tableData, index) in [leftTableData, rightTableData]"
        :key="index"
        :data="tableData"
        style="width: 100%"
        v-loading="loading"
        border
        stripe
        @row-click="handleRowClick"
        @sort-change="handleSortChange"
      >
        <el-table-column label="股票信息" min-width="65">
          <template #default="{ row }">
            <div class="stock-info">
              <span class="stock-name">{{ row.name }}</span>
              <span class="stock-code">{{ row.code }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="speed" label="涨速" min-width="65" align="right" sortable="custom">
          <template #default="{ row }">
            <div v-if="row.speed !== null">
              <el-tag
                :type="row.speed > 0 ? 'danger' : row.speed < 0 ? 'success' : 'info'"
                size="small"
              >
                {{ row.speed > 0 ? '+' : '' }}{{ row.speed?.toFixed(2) }}%
              </el-tag>
            </div>
            <span v-else>--</span>
          </template>
        </el-table-column>
        
        <el-table-column label="涨停次数" min-width="60" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.zttj_ct && row.zttj_days" type="info">
              {{ row.zttj_ct }}/{{ row.zttj_days }}
            </el-tag>
            <span v-else>--</span>
          </template>
        </el-table-column>
        
        <el-table-column label="现价" min-width="60" align="right">
          <template #default="{ row }">
            <div v-if="row.price !== null && row.price !== undefined && !isNaN(row.price)">
              <span class="price">{{ Number(row.price).toFixed(2) }}</span>
            </div>
            <span v-else>--</span>
          </template>
        </el-table-column>

        <el-table-column prop="change" label="涨跌幅" min-width="70" align="right" sortable="custom">
          <template #default="{ row }">
            <div v-if="row.change !== null && row.change !== undefined && !isNaN(row.change)">
              <el-tag
                :type="row.change > 0 ? 'danger' : row.change < 0 ? 'success' : 'info'"
                size="small"
              >
                {{ row.change > 0 ? '+' : '' }}{{ Number(row.change).toFixed(2) }}%
              </el-tag>
            </div>
            <span v-else>--</span>
          </template>
        </el-table-column>
        
        <el-table-column label="K线图" min-width="130" align="center">
          <template #default="{ row }">
            <stock-k-line 
              :code="row.code" 
              :kline-data="row.klineData || []"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-card>
</template>

<script>
import { Delete, Trophy } from '@element-plus/icons-vue'
import StockKLine from '../components/StockKLine.vue'
import { jumpToQuote, registerPush, unregisterPush } from '../utils/quoteApi'

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
      sortOrder: 'desc',
      quoteSessionId: null
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
  beforeUnmount() {
    // 组件销毁前取消推送
    if (this.quoteSessionId) {
      unregisterPush(this.quoteSessionId)
      this.quoteSessionId = null
    }
  },
  computed: {
    // 计算左侧表格数据
    leftTableData() {
      const midPoint = Math.ceil(this.sortedStockPool.length / 2)
      return this.sortedStockPool.slice(0, midPoint)
    },
    // 计算右侧表格数据
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
        
        return this.sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      })
    }
  },
  methods: {
    // 修改删除方法，增加表格位置参数
    removeStock(index, tablePosition) {
      const actualIndex = tablePosition === 'left' ? index : index + this.leftTableData.length
      this.stockPool.splice(actualIndex, 1)
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
        const dragonStocks = await this.fetchDragonStocks()
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

    // 获取龙头股票数据
    async fetchDragonStocks() {
      const response = await fetch('https://www.wttiao.com/moni/ztpool/dragonCallback')
      const result = await response.json()
      
      if (result.code === 0 && result.data && Array.isArray(result.data)) {
        return result.data.map(item => ({
          code: item.code,
          name: item.name,
          date: item.date,
          zttj_days: item.zttj_days,
          zttj_ct: item.zttj_ct,
          price: null,
          change: null
        }))
      }
      throw new Error(result.msg || '获取数据失败')
    },

    // 获取K线数据
    async fetchKLineData(code) {
      try {
        const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`
        const date = new Date()
        const endDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
        
        const response = await fetch(
          `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1%2Cf2%2Cf3%2Cf4%2Cf5%2Cf6&fields2=f51%2Cf52%2Cf53%2Cf54%2Cf55%2Cf56%2Cf57%2Cf58%2Cf59%2Cf60%2Cf61&klt=101&fqt=1&end=${endDate}&lmt=30`
        )
        const result = await response.json()
        
        if (result.rc === 0 && result.data.klines) {
          return result.data.klines.map(item => {
            const [date, open, close, high, low] = item.split(',')
            return {
              date,
              value: [parseFloat(open), parseFloat(close), parseFloat(low), parseFloat(high)]
            }
          })
        }
        return []
      } catch (error) {
        console.error('获取K线数据失败:', error)
        return []
      }
    },

    // 更新股票池数据
    async updateStockPool(dragonStocks) {
      // 合并股票池，避免重复
      const existingCodes = this.stockPool.map(stock => stock.code)
      const newStocks = dragonStocks.filter(stock => !existingCodes.includes(stock.code))
      
      // 先添加股票到池中，不等待K线数据
      this.stockPool = [...this.stockPool, ...newStocks]
      
      // 触发事件通知父组件股票池已更新
      this.$emit('stock-pool-updated', this.stockPool)
      
      // 显示成功消息
      this.$emit('show-message', {
        type: 'success',
        message: `成功加载${newStocks.length}只龙头股票到股票池`
      })

      // 异步加载K线数据
      this.loadKLineDataAsync(newStocks)
    },

    // 异步加载K线数据
    async loadKLineDataAsync(stocks) {
      for (const stock of stocks) {
        try {
          const klineData = await this.fetchKLineData(stock.code)
          // 使用Vue 3的响应式更新
          const stockIndex = this.stockPool.findIndex(s => s.code === stock.code)
          if (stockIndex !== -1) {
            // 补充现价和涨跌幅，从K线数据中获取
            const latestPrice = klineData[klineData.length - 1]?.value[1]
            const prevPrice = klineData[klineData.length - 2]?.value[1]
            
            // 直接更新对象属性，Vue 3会自动处理响应式
            Object.assign(this.stockPool[stockIndex], {
              klineData,
              price: latestPrice,
              change: prevPrice ? Number(((latestPrice - prevPrice) / prevPrice * 100).toFixed(2)) : 0
            })
          }
        } catch (error) {
          console.error(`获取股票${stock.code}的K线数据失败:`, error)
        }
      }
    },

    // 注册行情推送
    async registerQuotePush() {
      if (this.stockPool.length === 0) return

      const stockCodes = this.stockPool.map(stock => stock.code)
      if (this.quoteSessionId) {
        unregisterPush(this.quoteSessionId) // 如果已存在推送，先取消
      }
      
      this.quoteSessionId = registerPush(stockCodes, (data) => {
        this.handleQuoteData(data)
      })
    },

    // 处理行情推送数据
    handleQuoteData(data) {
      data.forEach(item => {
        const stock = this.stockPool.find(s => s.code === item.code)
        if (stock) {
          // 只在有数据时才更新对应字段
          if (item.price !== undefined && item.price !== null) {
            stock.price = item.price
          }
          if (item.zhangdiefu !== undefined && item.zhangdiefu !== null) {
            stock.change = item.zhangdiefu
          }
          if (item.zhangshu !== undefined && item.zhangshu !== null) {
            stock.speed = item.zhangshu
          }
        }
      })
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
        // 获取所有股票代码
        const stockCodes = this.stockPool.map(stock => stock.code)
        
        // 注册推送
        if (this.quoteSessionId) {
          unregisterPush(this.quoteSessionId) // 如果已存在推送，先取消
        }
        this.quoteSessionId = registerPush(stockCodes, (data) => {
          // 处理推送数据
          data.forEach(item => {
            const stock = this.stockPool.find(s => s.code === item.code)
            if (stock) {
              // 只在有数据时才更新对应字段
              if (item.price !== undefined && item.price !== null) {
                stock.price = item.price
              }
              if (item.zhangdiefu !== undefined && item.zhangdiefu !== null) {
                stock.change = item.zhangdiefu
              }
              if (item.zhangshu !== undefined && item.zhangshu !== null) {
                stock.speed = item.zhangshu
              }
            }
          })
        })
        
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
    
    // 处理行点击事件
    handleRowClick(row) {
      // 获取所有股票池中的股票代码
      const stockCodes = this.stockPool.map(stock => stock.code)
      jumpToQuote(row.code, stockCodes)
    },

    // 处理K线组件发送的价格更新
    handleKLinePriceUpdate({ code, price, change }) {
      const stock = this.stockPool.find(s => s.code === code)
      if (stock) {
        stock.price = price
        stock.change = change
      }
    },

    // 处理排序变化
    handleSortChange({ prop, order }) {
      if (!prop) {
        this.sortField = ''
        this.sortOrder = 'desc'
        return
      }
      
      this.sortField = prop
      this.sortOrder = order === 'ascending' ? 'asc' : 'desc'
      
      // 强制更新排序后的数据
      this.$nextTick(() => {
        this.stockPool = [...this.sortedStockPool]
      })
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

.tables-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
  padding: 12px 20px;
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

/* 压缩表格竖向空间 */
:deep(.el-table__row) { 
  height: 30px;
}

:deep(.el-table .cell) {
  padding: 0px 4px;  
}

:deep(.el-table__header .cell) {
  font-weight: 500;
}

:deep(.el-table__body td) {
  padding: 0px 0;
}

:deep(.el-button--small) {
  padding: 4px 8px;
  font-size: 12px;
}

:deep(.el-tag--small) {
  padding: 0 4px;
  height: 20px;
  line-height: 18px;
}
</style>