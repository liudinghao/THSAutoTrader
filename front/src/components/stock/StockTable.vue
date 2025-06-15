<template>
  <el-table
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
          <span v-if="row.zttj_ct && row.zttj_days" class="stock-zttj">
            <el-tag type="info" size="small">{{ row.zttj_ct }}/{{ row.zttj_days }}</el-tag>
          </span>
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
    
    <el-table-column label="涨停原因" prop="reason_type" min-width="80" align="center" sortable="custom">
      <template #default="{ row }">
        <reason-tags :reason-type="row.reason_type" />
      </template>
    </el-table-column>
    
    <el-table-column label="K线图" min-width="130" align="center" v-if="showKLine">
      <template #default="{ row }">
        <stock-k-line 
          :code="row.code" 
          :kline-data="row.klineData || []"
        />
      </template>
    </el-table-column>
  </el-table>
</template>

<script>
import StockKLine from '../../components/StockKLine.vue'
import ReasonTags from '../../components/ReasonTags.vue'

export default {
  name: 'StockTable',
  components: {
    StockKLine,
    ReasonTags
  },
  props: {
    tableData: {
      type: Array,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    showKLine: {
      type: Boolean,
      default: true
    }
  },
  emits: ['row-click', 'sort-change'],
  methods: {
    handleRowClick(row) {
      this.$emit('row-click', row)
    },
    handleSortChange({ prop, order }) {
      this.$emit('sort-change', { prop, order })
    }
  }
}
</script>

<style scoped>
.stock-info {
  display: flex;
  flex-direction: column;
}

.stock-name {
  font-weight: 500;
}

.stock-code {
  font-size: var(--font-size-small);
  color: var(--info-color);
}

.price {
  font-weight: 500;
  margin-right: var(--spacing-small);
}
</style> 