<template>
  <div class="intraday-chart-container">
    <div v-if="loading" class="loading-overlay">
      <el-loading-spinner />
      <span>正在加载分时数据...</span>
    </div>
    <div ref="chartRef" class="intraday-chart" :style="{ height: height }"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  stockData: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  height: {
    type: [String, Number],
    default: '500px'
  }})

const emit = defineEmits(['chartUpdate', 'chartClick', 'dataPointClick'])

const chartRef = ref(null)
const chart = ref(null)

// 生成A股分时完整时间刻度（匹配原有数据格式 HH:mm:00）
const generateAStockTimeAxis = () => {
  const pad = n => n.toString().padStart(2, '0')
  const times = []
  
  // 上午 9:30~11:30
  for (let h = 9, m = 30; h < 12;) {
    times.push(`${pad(h)}:${pad(m)}:00`)
    m++
    if (m === 60) { h++; m = 0 }
    if (h === 11 && m > 30) break
  }
  
  // 下午 13:00~15:00
  for (let h = 13, m = 0; h < 16;) {
    times.push(`${pad(h)}:${pad(m)}:00`)
    m++
    if (m === 60) { h++; m = 0 }
    if (h === 15 && m > 0) break
  }
  return times
}

const timeAxis = generateAStockTimeAxis()

// 处理原有数据格式的分时数据
const processStockData = (stock) => {
  if (!stock.minuteData || stock.minuteData.length === 0) {
    return {
      prices: [],
      volumes: [],
      avgPrice: [],
      change: [],
      changePercent: []
    }
  }

  // 原有数据格式: [timeStr, changePercent]
  const dataMap = new Map(stock.minuteData.map(item => [item[0], item[1]]))
  
  const prices = []
  const volumes = []
  const avgPrice = []
  const change = []
  const changePercent = []
  
  const preClose = parseFloat(stock.preClose) || 0
  
  timeAxis.forEach((time, index) => {
    const changePct = dataMap.get(time)
    
    if (changePct !== undefined && changePct !== null) {
      const pctValue = parseFloat(changePct)
      changePercent.push(pctValue)
      
      // 根据涨跌幅反推价格
      const price = preClose > 0 ? preClose * (1 + pctValue / 100) : 0
      prices.push(price.toFixed(3))
      change.push((price - preClose).toFixed(3))
      
      // 简化的均价和成交量（由于原数据格式限制）
      avgPrice.push(price.toFixed(3))
      volumes.push(0) // 原数据没有成交量
    } else {
      prices.push(null)
      volumes.push(0)
      avgPrice.push(null)
      changePercent.push(null)
      change.push(null)
    }
  })
  
  return {
    prices: prices.map(p => p !== null ? parseFloat(p) : null),
    volumes,
    avgPrice: avgPrice.map(p => p !== null ? parseFloat(p) : null),
    change: change.map(c => c !== null ? parseFloat(c) : null),
    changePercent: changePercent.map(c => c !== null ? parseFloat(c) : null)
  }
}

// 计算价格范围
const calculatePriceRange = (prices, preClose) => {
  const validPrices = prices.filter(p => p !== null)
  if (validPrices.length === 0) return { min: preClose - 1, max: preClose + 1 }
  
  const minPrice = Math.min(...validPrices)
  const maxPrice = Math.max(...validPrices)
  
  // 添加边距
  const range = maxPrice - minPrice
  const padding = range * 0.1 || 0.1
  
  return {
    min: Math.max(0, minPrice - padding),
    max: maxPrice + padding,
    center: preClose
  }
}

// 计算成交量范围
const calculateVolumeRange = (volumes) => {
  const validVolumes = volumes.filter(v => v > 0)
  if (validVolumes.length === 0) return { min: 0, max: 1000 }
  
  const maxVolume = Math.max(...validVolumes)
  return {
    min: 0,
    max: maxVolume * 1.2 // 20% 的上边距
  }
}

// 更新双Y轴分时图 - 左轴价格，右轴涨跌幅
const updateProfessionalChart = () => {
  if (!chart.value || !props.stockData?.length) return

  const stock = props.stockData[0]
  if (!stock) return

  const processedData = processStockData(stock)
  const preClose = parseFloat(stock.preClose) || 0
  
  // 计算价格范围
  const priceRange = calculatePriceRange(processedData.prices, preClose)
  
  // 计算涨跌幅范围（±5%的边界）
  const maxChange = Math.max(...processedData.changePercent.filter(c => c !== null))
  const minChange = Math.min(...processedData.changePercent.filter(c => c !== null))
  const changePadding = Math.max(Math.abs(maxChange), Math.abs(minChange)) * 0.1
  const changeRange = {
    min: Math.min(-changePadding, minChange - changePadding),
    max: Math.max(changePadding, maxChange + changePadding)
  }

  const option = {
    animation: false,
    title: {
      text: `${stock.name}(${stock.code}) 分时图`,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: '#999',
          width: 1,
          type: 'dashed'
        }
      },
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      borderColor: '#333',
      borderWidth: 1,
      textStyle: {
        color: '#fff',
        fontSize: 12
      },
      formatter: function(params) {
        const time = params[0]?.axisValue
        const changePct = params[0]?.value
        if (changePct === null || changePct === undefined) return ''
        
        const price = preClose > 0 ? preClose * (1 + changePct / 100) : 0
        
        return `<div style="font-weight: bold; margin-bottom: 5px">${time}</div>
                <div style="color: ${changePct >= 0 ? '#f56c6c' : '#67c23a'};">价格: ¥${price.toFixed(3)}</div>
                <div style="color: ${changePct >= 0 ? '#f56c6c' : '#67c23a'};">涨跌幅: ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%</div>`
      }
    },
    grid: {
      left: '15%',
      right: '15%',
      top: '15%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: timeAxis,
      boundaryGap: false,
      axisLine: { onZero: false },
      splitLine: { show: false },
      axisLabel: {
        interval: 29,
        formatter: function(value) {
          return value.endsWith(':00:00') ? value.substring(0, 5) : ''
        }
      },
      min: 'dataMin',
      max: 'dataMax'
    },
    yAxis: [
      {
        type: 'value',
        name: '价格',
        position: 'left',
        axisLine: {
          show: true,
          lineStyle: { color: '#777' }
        },
        splitLine: { 
          show: true, 
          lineStyle: { color: '#eee', type: 'dashed' } 
        },
        axisLabel: {
          formatter: function(value) {
            return '¥' + value.toFixed(3)
          },
          color: '#333'
        },
        min: priceRange.min,
        max: priceRange.max,
        scale: true
      },
      {
        type: 'value',
        name: '涨跌幅',
        position: 'right',
        axisLine: {
          show: true,
          lineStyle: { color: '#777' }
        },
        splitLine: { show: false },
        axisLabel: {
          formatter: function(value) {
            return value.toFixed(2) + '%'
          },
          color: function(value) {
            return value > 0 ? '#f56c6c' : (value < 0 ? '#67c23a' : '#666')
          }
        },
        min: changeRange.min,
        max: changeRange.max,
        scale: true
      }
    ],
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      }
    ],
    series: [
      {
        name: '价格',
        type: 'line',
        yAxisIndex: 0,
        data: processedData.prices,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: '#1890ff',
          width: 2
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
          ])
        }
      }
    ]
  }

  chart.value.setOption(option, true)
  emit('chartUpdate', { 
    option, 
    stockData: props.stockData, 
    processedData 
  })
}

// 更新多股票对比图
const updateComparisonChart = () => {
  if (!chart.value || !props.stockData?.length) return

  const series = props.stockData.map((stock, index) => {
    const processedData = processStockData(stock)
    return {
      name: stock.name,
      type: 'line',
      data: processedData.changePercent,
      smooth: true,
      symbol: 'none',
      lineStyle: {
        color: stock.color,
        width: index === 0 ? 2 : 1
      },
      itemStyle: {
        color: stock.color
      }
    }
  })

  const option = {
    animation: false,
    title: {
      text: '多品种涨跌幅对比',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: function(params) {
        const time = params[0]?.axisValue
        let result = `<div style="font-weight: bold; margin-bottom: 5px">${time}</div>`
        
        params.forEach(param => {
          if (param.value !== null) {
            const color = param.color
            const value = param.value
            result += `<div style="color: ${color}; margin: 2px 0">
              ${param.seriesName}: ${value > 0 ? '+' : ''}${value}%
            </div>`
          }
        })
        
        return result
      }
    },
    legend: {
      data: props.stockData.map(stock => stock.name),
      top: 30
    },
    grid: {
      left: '10%',
      right: '8%',
      top: '15%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: timeAxis,
      boundaryGap: false,
      axisLabel: {
        interval: 29,
        formatter: function(value) {
          return value.endsWith(':00:00') ? value.substring(0, 5) : ''
        }
      }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: {
        formatter: function(value) {
          return value.toFixed(2) + '%'
        }
      },
      splitLine: {
        lineStyle: {
          color: '#eee'
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      }
    ],
    series: series
  }

  chart.value.setOption(option, true)
  emit('chartUpdate', { option, stockData: props.stockData })
}

const updateChart = () => {
  if (props.stockData.length === 1) {
    updateProfessionalChart()
  } else {
    updateComparisonChart()
  }
}

const resizeChart = () => {
  if (chart.value) {
    chart.value.resize()
  }
}

onMounted(() => {
  if (chartRef.value) {
    chart.value = echarts.init(chartRef.value)
    
    chart.value.on('click', (params) => {
      emit('chartClick', params)
    })
    
    chart.value.on('mouseover', (params) => {
      emit('dataPointClick', params)
    })
    
    updateChart()
  }
  
  window.addEventListener('resize', resizeChart)
})

onUnmounted(() => {
  if (chart.value) {
    chart.value.dispose()
  }
  window.removeEventListener('resize', resizeChart)
})

watch(() => props.stockData, () => {
  updateChart()
}, { deep: true })

watch(() => props.height, () => {
  resizeChart()
})

defineExpose({
  updateChart,
  resizeChart,
  getChartInstance: () => chart.value
})
</script>

<style scoped>
.intraday-chart-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.intraday-chart {
  width: 100%;
  height: 100%;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #fafafa;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  border-radius: 4px;
}
</style>