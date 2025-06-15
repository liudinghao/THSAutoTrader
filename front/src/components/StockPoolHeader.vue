<template>
  <div class="header-buttons">
    <el-button
      type="primary"
      size="small"
      :loading="addingToSelf"
      @click="handleAddAllToSelf"
    >
      <el-icon class="el-icon--left"><Star /></el-icon>
      一键加自选
    </el-button>
    <el-button
      :type="showKLine ? 'primary' : 'info'"
      size="small"
      @click="toggleKLine"
    >
      <el-icon class="el-icon--left"><TrendCharts /></el-icon>
      {{ showKLine ? '隐藏K线' : '显示K线' }}
    </el-button>
  </div>
</template>

<script>
import { Star, TrendCharts } from '@element-plus/icons-vue'
import { addSelfStock } from '../utils/quoteApi'

export default {
  name: 'StockPoolHeader',
  components: {
    Star,
    TrendCharts
  },
  props: {
    stockPool: {
      type: Array,
      required: true
    },
    showKLine: {
      type: Boolean,
      required: true
    }
  },
  data() {
    return {
      addingToSelf: false
    }
  },
  methods: {
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
    },
    toggleKLine() {
      this.$emit('update:showKLine', !this.showKLine)
      localStorage.setItem('showKLine', !this.showKLine)
    }
  }
}
</script>

<style scoped>
.header-buttons {
  display: flex;
  gap: 8px;
}

:deep(.el-button--small) {
  padding: 4px 8px;
  font-size: 12px;
}
</style> 