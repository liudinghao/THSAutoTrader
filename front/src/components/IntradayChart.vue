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

// 生成A股分时时间刻度，跳过午间休市时段（11:30-13:00）
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
  
  // 下午 13:01~15:00
  for (let h = 13, m = 1; h < 16;) {
    times.push(`${pad(h)}:${pad(m)}:00`)
    m++
    if (m === 60) { h++; m = 0 }
    if (h === 15 && m > 0) break
  }
  return times
}

const timeAxis = generateAStockTimeAxis()

// 处理分时数据，支持JUNJIA均线
const processStockData = (stock) => {
  if (!stock.minuteData || stock.minuteData.length === 0) {
    return {
      prices: [],
      volumes: [],
      avgPrice: [],
      change: [],
      changePercent: [],
      junjia: [],
      rawData: {}
    }
  }

  const preClose = parseFloat(stock.preClose) || 0
  
  // 如果是新的数据格式（包含原始分时数据）
  if (stock.rawData) {
    const prices = []
    const volumes = []
    const avgPrice = []
    const change = []
    const changePercent = []
    const junjia = []
    timeAxis.forEach(time => {
      const rawItem = stock.rawData[time]
      if (rawItem) {
        const newPrice = parseFloat(rawItem.NEW || 0)
        const junjiaPrice = parseFloat(rawItem.JUNJIA || newPrice)
        const volume = parseFloat(rawItem.VOL || 0)
        
        prices.push(newPrice)
        junjia.push(junjiaPrice)
        volumes.push(volume)
        
        if (preClose > 0) {
          const pct = ((newPrice - preClose) / preClose) * 100
          changePercent.push(parseFloat(pct.toFixed(2)))
          change.push(parseFloat((newPrice - preClose).toFixed(3)))
        } else {
          changePercent.push(0)
          change.push(0)
        }
      } else {
        prices.push(null)
        junjia.push(null)
        volumes.push(null)
        changePercent.push(null)
        change.push(null)
      }
    })
    return {
      prices,
      volumes,
      avgPrice,
      change,
      changePercent,
      junjia,
      rawData: stock.rawData
    }
  }
  
  // 原有数据格式: [timeStr, changePercent]
  const dataMap = new Map(stock.minuteData.map(item => [item[0], item[1]]))
  
  const prices = []
  const volumes = []
  const avgPrice = []
  const change = []
  const changePercent = []
  const junjia = []
  
  timeAxis.forEach((time, index) => {
    const changePct = dataMap.get(time)
    
    if (changePct !== undefined && changePct !== null) {
      const pctValue = parseFloat(changePct)
      changePercent.push(pctValue)
      
      // 根据涨跌幅反推价格
      const price = preClose > 0 ? preClose * (1 + pctValue / 100) : 0
      prices.push(parseFloat(price.toFixed(3)))
      change.push(parseFloat((price - preClose).toFixed(3)))
      junjia.push(parseFloat(price.toFixed(3))) // 简化的均线
      
      volumes.push(null) // 原数据没有成交量
    } else {
      prices.push(null)
      junjia.push(null)
      volumes.push(null)
      changePercent.push(null)
      change.push(null)
    }
  })
  
  return {
    prices,
    volumes,
    avgPrice,
    change,
    changePercent,
    junjia,
    rawData: {}
  }
}

// 处理多只股票的涨跌幅数据
const processMultiStockData = () => {
  if (!props.stockData || props.stockData.length === 0) {
    return {
      mainStock: null,
      otherStocks: []
    }
  }

  const mainStock = processStockData(props.stockData[0])
  const otherStocks = []

  // 处理其他股票的涨跌幅数据
  for (let i = 1; i < props.stockData.length; i++) {
    const stock = props.stockData[i]
    const processedData = processStockData(stock)
    
    otherStocks.push({
      stock: stock,
      changePercent: processedData.changePercent,
      name: stock.name,
      code: stock.code
    })
  }

  return {
    mainStock,
    otherStocks
  }
}

// 计算价格范围，确保与涨跌幅轴对齐
const calculatePriceRange = (prices, preClose) => {
  const validPrices = prices.filter(p => p !== null)
  if (validPrices.length === 0) {
    // 默认范围：昨收价上下5%
    return { 
      min: preClose * 0.95, 
      max: preClose * 1.05,
      center: preClose
    }
  }
  
  const minPrice = Math.min(...validPrices)
  const maxPrice = Math.max(...validPrices)
  
  // 计算相对于昨收价的涨跌幅
  const minChange = preClose > 0 ? ((minPrice - preClose) / preClose) * 100 : -5
  const maxChange = preClose > 0 ? ((maxPrice - preClose) / preClose) * 100 : 5
  
  // 取最大绝对值，确保对称
  const maxAbsChange = Math.max(Math.abs(minChange), Math.abs(maxChange), 1) // 至少1%
  const padding = maxAbsChange * 0.1
  const finalMaxChange = maxAbsChange + padding
  
  // 根据涨跌幅反推价格范围
  const minPriceAligned = preClose * (1 - finalMaxChange / 100)
  const maxPriceAligned = preClose * (1 + finalMaxChange / 100)
  
  return {
    min: Math.max(0, minPriceAligned),
    max: maxPriceAligned,
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

// 计算多股票涨跌幅范围 - 与价格轴同步
const calculateMultiStockChangeRange = (mainStock, otherStocks) => {
  let allChanges = []
  
  // 添加主股票的涨跌幅
  if (mainStock) {
    allChanges = allChanges.concat(mainStock.changePercent.filter(c => c !== null))
  }
  
  // 添加其他股票的涨跌幅
  otherStocks.forEach(stockData => {
    allChanges = allChanges.concat(stockData.changePercent.filter(c => c !== null))
  })
  
  if (allChanges.length === 0) {
    return { min: -5, max: 5 }
  }
  
  const maxChange = Math.max(...allChanges)
  const minChange = Math.min(...allChanges)
  
  // 取最大绝对值，确保对称，保证0轴居中
  const maxAbsChange = Math.max(Math.abs(maxChange), Math.abs(minChange), 1) // 至少1%
  const changePadding = maxAbsChange * 0.1
  const finalMaxChange = maxAbsChange + changePadding
  
  return {
    min: -finalMaxChange,
    max: finalMaxChange
  }
}

// 生成股票颜色
const generateStockColors = (count) => {
  const colors = [
    '#1890ff', '#f56c6c', '#67c23a', '#e6a23c', '#909399',
    '#ff7875', '#95de64', '#ffc53d', '#b37feb', '#ff85c0'
  ]
  
  const result = []
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length])
  }
  return result
}

// 更新专业分时图 - 支持多股票叠加
const updateProfessionalChart = () => {
  if (!chart.value || !props.stockData?.length) return

  const multiStockData = processMultiStockData()
  const { mainStock, otherStocks } = multiStockData
  
  if (!mainStock) return

  const stock = props.stockData[0]
  const preClose = parseFloat(stock.preClose) || 0
  
  // 计算价格范围
  const priceRange = calculatePriceRange(mainStock.prices, preClose)
  
  // 计算多股票涨跌幅范围
  const changeRange = calculateMultiStockChangeRange(mainStock, otherStocks)

  // 计算成交量范围
  const validVolumes = mainStock.volumes.filter(v => v !== null && v > 0)
  const maxVolume = validVolumes.length > 0 ? Math.max(...validVolumes) : 0
  const volumeRange = {
    max: maxVolume > 0 ? maxVolume * 1.2 : 1000
  }

  // 生成标记线 - 零轴线和昨收价线
  const markLine = {
    silent: true,
    symbol: 'none',
    label: {
      show: false
    },
    lineStyle: {
      color: '#000000',
      width: 1,
      type: 'solid'
    },
    data: [
      {
        yAxis: preClose,
        lineStyle: { color: '#000000', width: 1 }
      }
    ]
  }

  // 生成系列数据
  const series = []
  const stockColors = generateStockColors(1 + otherStocks.length)
  
  // 主股票的价格线
  series.push({
    name: `${stock.name}(${stock.code})`,
    type: 'line',
    data: mainStock.prices,
    smooth: false,
    symbol: 'none',
    lineStyle: {
      color: stockColors[0],
      width: 2
    },
    markLine: markLine
  })
  
  // 主股票的均价线（不显示在图例中）
  series.push({
    name: `${stock.name}(${stock.code}) 均价`,
    type: 'line',
    data: mainStock.junjia,
    smooth: false,
    symbol: 'none',
    lineStyle: {
      color: '#FFB400',
      width: 1,
      type: 'solid'
    },
    legendHoverLink: false
  })
  
  // 主股票的成交量（不显示在图例中）
  series.push({
    name: `${stock.name}(${stock.code}) 成交量`,
    type: 'bar',
    xAxisIndex: 1,
    yAxisIndex: 2,
    data: mainStock.volumes.map(v => v !== null ? v : 0),
    itemStyle: {
      color: function(params) {
        const priceChange = mainStock.changePercent[params.dataIndex] || 0
        return priceChange >= 0 ? '#f56c6c' : '#67c23a'
      }
    },
    barWidth: '60%',
    legendHoverLink: false
  })
  
  // 其他股票的涨跌幅线
  otherStocks.forEach((stockData, index) => {
    series.push({
      name: `${stockData.name}(${stockData.code})`,
      type: 'line',
      yAxisIndex: 1, // 使用右侧Y轴（涨跌幅轴）
      data: stockData.changePercent,
      smooth: false,
      symbol: 'none',
      lineStyle: {
        color: stockColors[index + 1],
        width: 1
      }
    })
  })

  const option = {
    animation: false,
    title: {
      show: false,
      text: `${stock.name}(${stock.code}) 分时图${otherStocks.length > 0 ? ` + ${otherStocks.length}只股票对比` : ''}`,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      show:false
    },
    legend: {
      data: [
        `${stock.name}(${stock.code})`,
        ...otherStocks.map(s => `${s.name}(${s.code})`)
      ],
      top: 30,
      textStyle: {
        fontSize: 12
      }
    },
    axisPointer: {
      link: [
        {
          xAxisIndex: 'all'
        }
      ],
      label: {
        backgroundColor: '#777'
      }
    },
    grid: [
      {
        left: '10%',
        right: '8%',
        height: '60%',
        top: '15%'
      },
      {
        left: '10%',
        right: '8%',
        top: '80%',
        height: '15%'
      }
    ],
    xAxis: [
      {
        type: 'category',
        data: timeAxis,
        boundaryGap: false,
        axisLine: {
          onZero: false,
          lineStyle: { color: '#333' }
        },
        splitLine: {
          show: true,
          lineStyle: { color: '#f5f5f5' }
        },
        axisLabel: {
          interval: function(index, value) {
            // 在关键时间点显示标签
            const time = value.substring(0, 5)
            return ['09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00'].includes(time)
          },
          formatter: function(value) {
            return value.substring(0, 5)
          },
          color: '#666'
        },
        axisTick: {
          alignWithLabel: true
        },
        axisPointer: {
          z: 100
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(250,250,250,0.3)', 'rgba(245,245,245,0.3)']
          }
        }
      },
      {
        type: 'category',
        gridIndex: 1,
        data: timeAxis,
        boundaryGap: false,
        axisLine: {
          onZero: false,
          lineStyle: { color: '#333' }
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          show: false
        }
      }
    ],
    yAxis: [
      {
        type: 'value',
        name: '价格',
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
            return value.toFixed(3)
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
      },
      {
        type: 'value',
        name: '成交量',
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: {
          show: false
        },
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        min: 0,
        max: volumeRange.max,
        scale: true
      }
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        start: 0,
        end: 100
      }
    ],
    series: series
  }

  chart.value.setOption(option, true)
  emit('chartUpdate', { 
    option, 
    stockData: props.stockData, 
    processedData: multiStockData 
  })
}



const updateChart = () => {
  updateProfessionalChart()
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

watch(() => props.stockData, (newVal, oldVal) => {
  console.log('IntradayChart stockData 发生变化:', {
    newLength: newVal?.length,
    oldLength: oldVal?.length,
    hasMinuteData: newVal?.some(stock => stock.minuteData && stock.minuteData.length > 0)
  })
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