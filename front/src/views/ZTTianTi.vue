<template>
  <div class="zt-tian-ti-new">
    <!-- 顶部统计标签区 -->
    <div class="zt-stats-bar">
      <div
        v-for="stat in statsList"
        :key="stat.label"
        class="zt-stat-tag"
        :style="{ background: stat.bg, color: stat.color }"
      >
        <span class="zt-stat-label">{{ stat.label }}:</span>
        <span class="zt-stat-value">{{ stat.value }}</span>
      </div>
    </div>

    <!-- 主体内容区 -->
    <div class="zt-tian-ti-content-new">
      <div v-if="loading" class="zt-loading">
        <span class="zt-loading-spinner"></span>
        <span>数据加载中...</span>
      </div>
      <div v-else-if="!stockData.length" class="zt-empty">
        <span>暂无数据</span>
      </div>
      <div v-else class="zt-tian-ti-table-new">
        <div
          v-for="group in groupedStocks"
          :key="group.zttj_days"
          class="zt-tier-row"
        >
          <div class="zt-tier-label">
            <span class="zt-tier-main">{{ group.zttj_days === 1 ? '首板' : group.zttj_days + '板' }}</span>
          </div>
          <div class="zt-tier-stocks">
            <div
              v-for="item in group.stocks"
              :key="item.id"
              class="zt-stock-card"
              :class="{ 'zt-stock-yizi': item.yizi }"
            >
              <div class="zt-stock-header">
                <span class="zt-stock-name">{{ item.name }}</span>
                <span v-if="item.yizi" class="zt-yizi-tag">一字</span>
              </div>
              <div class="zt-stock-tags">
                <span
                  v-for="reason in getReasons(item.reason_type)"
                  :key="reason"
                  class="zt-reason-tag"
                  :style="{ background: getTagColor(reason) }"
                >
                  {{ reason }}
                </span>
              </div>
              <div class="zt-stock-meta">
                <span class="zt-stock-time">{{ formatTime(item.first_zt_time) }}</span>
                <span v-if="item.last_zt_time && item.last_zt_time !== item.first_zt_time" class="zt-stock-time">{{ formatTime(item.last_zt_time) }}</span>
              </div>
              <div class="zt-stock-extra">
                <span v-if="item.extra" class="zt-stock-extra-label">{{ item.extra }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const loading = ref(false)
const stockData = ref([])

// 统计标签数据（可根据实际数据动态生成）
const statsList = computed(() => {
  // 统计逻辑示例，根据实际数据结构调整
  const stats = [
    { label: '泛金融', value: 0, bg: '#f56c6c', color: '#fff' },
    { label: '稀土', value: 0, bg: '#ff9800', color: '#fff' },
    { label: '光伏', value: 0, bg: '#e0f7fa', color: '#333' },
    { label: '医药', value: 0, bg: '#e1bee7', color: '#333' },
    { label: '金属', value: 0, bg: '#ffe082', color: '#333' },
    { label: '地产基建', value: 0, bg: '#bdbdbd', color: '#333' },
    { label: '军工', value: 0, bg: '#b0bec5', color: '#333' },
    { label: '氢能', value: 0, bg: '#b2dfdb', color: '#333' },
  ]
  // 统计各类数量
  stockData.value.forEach(item => {
    if (item.reason_type && item.reason_type.includes('泛金融')) stats[0].value++
    if (item.reason_type && item.reason_type.includes('稀土')) stats[1].value++
    if (item.reason_type && item.reason_type.includes('光伏')) stats[2].value++
    if (item.reason_type && item.reason_type.includes('医药')) stats[3].value++
    if (item.reason_type && item.reason_type.includes('金属')) stats[4].value++
    if (item.reason_type && item.reason_type.includes('地产基建')) stats[5].value++
    if (item.reason_type && item.reason_type.includes('军工')) stats[6].value++
    if (item.reason_type && item.reason_type.includes('氢能')) stats[7].value++
  })
  // 只显示有数量的标签
  return stats.filter(s => s.value > 0)
})

// 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    const startDate = '2025-07-11'
    const endDate = '2025-07-13'
    const response = await fetch(`https://www.wttiao.com/moni/ztpool/get?startDate=${startDate}&endDate=${endDate}`)
    const result = await response.json()
    if (result.code === 0) {
      // 标记一字板
      result.data.forEach(item => {
        item.yizi = item.yz_flag === 1 || (item.yz_flag === undefined && item.name && item.name.includes('一字'))
      })
      stockData.value = result.data || []
    }
  } catch (e) {
    // 错误处理
  } finally {
    loading.value = false
  }
}

// 分组
const groupedStocks = computed(() => {
  const groups = {}
  stockData.value.forEach(stock => {
    // 过滤连板：zttj_days 和 zttj_ct 相等表示连板，且排除首板（zttj_days > 1）
    if (stock.zttj_days === stock.zttj_ct && stock.zttj_days > 1) {
      const days = stock.zttj_days
      if (!groups[days]) {
        groups[days] = { zttj_days: days, stocks: [] }
      }
      groups[days].stocks.push(stock)
    }
  })
  return Object.values(groups).sort((a, b) => b.zttj_days - a.zttj_days)
})

// 解析涨停原因
const getReasons = (reasonType) => {
  if (!reasonType) return []
  return reasonType.split('+').filter(r => r.trim())
}

// 标签颜色
const getTagColor = (reason) => {
  const colorMap = {
    '泛金融': '#f56c6c',
    '稀土': '#ff9800',
    '光伏': '#7ec6f3',
    '医药': '#b388ff',
    '金属': '#ffd54f',
    '地产基建': '#bdbdbd',
    '军工': '#90a4ae',
    '氢能': '#80cbc4',
    '公告': '#e0e0e0',
    '一字': '#e040fb',
  }
  for (const [key, color] of Object.entries(colorMap)) {
    if (reason.includes(key)) return color
  }
  return '#e0e0e0'
}

// 时间格式
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const time = timeStr.toString()
  if (time.length === 5) {
    return `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4)}`
  }
  return timeStr
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.zt-tian-ti-new {
  padding: 16px 0;
  background: #f5f7fa;
  min-height: 100vh;
}
.zt-stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  justify-content: flex-start;
}
.zt-stat-tag {
  display: flex;
  align-items: center;
  border-radius: 12px;
  padding: 3px 12px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  min-width: 60px;
  justify-content: center;
}
.zt-stat-label {
  margin-right: 3px;
}
.zt-stat-value {
  font-size: 14px;
  font-weight: bold;
}
.zt-tian-ti-content-new {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
  padding: 0 0 16px 0;
}
.zt-loading, .zt-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #909399;
  font-size: 14px;
}
.zt-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e0e0e0;
  border-top: 3px solid #409eff;
  border-radius: 50%;
  animation: zt-spin 1s linear infinite;
  margin-bottom: 8px;
}
@keyframes zt-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.zt-tian-ti-table-new {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px 16px 0 16px;
}
.zt-tier-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.zt-tier-label {
  min-width: 50px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 16px;
  font-weight: bold;
  color: #409eff;
  margin-top: 4px;
}
.zt-tier-main {
  border-radius: 6px;
  background: #e3f2fd;
  padding: 4px 12px;
  font-size: 14px;
  color: #1976d2;
  font-weight: 700;
}
.zt-tier-stocks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex: 1;
}
.zt-stock-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  padding: 8px 12px 6px 12px;
  min-width: 130px;
  max-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  transition: box-shadow 0.2s, transform 0.2s;
  border: 1px solid #e3e3e3;
}
.zt-stock-card:hover {
  box-shadow: 0 2px 8px rgba(64,158,255,0.13);
  transform: translateY(-1px) scale(1.02);
  border-color: #90caf9;
}
.zt-stock-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.zt-stock-name {
  font-size: 14px;
  font-weight: 700;
  color: #222;
}
.zt-yizi-tag {
  background: #e040fb;
  color: #fff;
  border-radius: 4px;
  font-size: 10px;
  padding: 1px 5px;
  font-weight: 600;
  margin-left: 2px;
}
.zt-stock-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.zt-reason-tag {
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 10px;
  color: #fff;
  font-weight: 600;
  background: #bdbdbd;
}
.zt-stock-meta {
  display: flex;
  gap: 6px;
  font-size: 10px;
  color: #888;
}
.zt-stock-extra {
  margin-top: 1px;
}
.zt-stock-extra-label {
  font-size: 10px;
  color: #ff9800;
  font-weight: 600;
}
.zt-stock-yizi {
  border: 1.5px solid #e040fb;
}
@media (max-width: 900px) {
  .zt-tian-ti-table-new {
    padding: 8px 4px 0 4px;
  }
  .zt-tier-stocks {
    gap: 6px;
  }
  .zt-stock-card {
    min-width: 100px;
    max-width: 120px;
    padding: 6px 6px 4px 6px;
  }
  .zt-tier-label {
    font-size: 14px;
  }
}
@media (max-width: 600px) {
  .zt-tian-ti-new {
    padding: 6px 0;
  }
  .zt-stats-bar {
    gap: 4px;
    margin-bottom: 8px;
  }
  .zt-tian-ti-table-new {
    gap: 12px;
    padding: 4px 0 0 0;
  }
  .zt-tier-label {
    min-width: 35px;
    font-size: 12px;
  }
  .zt-tier-main {
    font-size: 12px;
    padding: 3px 6px;
  }
  .zt-stock-card {
    min-width: 80px;
    max-width: 100px;
    padding: 4px 3px 3px 3px;
  }
  .zt-stock-name {
    font-size: 11px;
  }
  .zt-reason-tag {
    font-size: 9px;
    padding: 1px 4px;
  }
}
</style> 