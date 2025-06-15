<template>
  <div ref="chartRef" class="kline-chart"></div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

export default {
  name: 'StockKLine',
  props: {
    code: {
      type: String,
      required: true
    },
    klineData: {
      type: Array,
      required: true
    }
  },
  setup(props) {
    const chartRef = ref(null)
    let chart = null

    const initChart = () => {
      if (chartRef.value) {
        chart = echarts.init(chartRef.value)
        window.addEventListener('resize', handleResize)
      }
    }

    const handleResize = () => {
      if (chart) {
        chart.resize()
      }
    }

    const updateChart = () => {
      if (!chart || !props.klineData.length) return

      const option = {
        animation: false,
        grid: {
          left: '3%',
          right: '3%',
          bottom: '3%',
          top: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: props.klineData.map(item => item.date),
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          axisLabel: { show: false },
        },
        yAxis: {
          scale: true,
          splitArea: {
            show: true
          },
          axisLabel: { show: false }
        },
        series: [{
          type: 'candlestick',
          data: props.klineData.map(item => item.value),
          itemStyle: {
            color: '#ec0000',
            color0: '#00da3c',
            borderColor: '#8A0000',
            borderColor0: '#008F28'
          }
        }]
      }
      
      chart.setOption(option)
    }

    watch(() => props.klineData, () => {
      updateChart()
    }, { deep: true })

    onMounted(() => {
      initChart()
      updateChart()
    })

    onUnmounted(() => {
      if (chart) {
        chart.dispose()
        window.removeEventListener('resize', handleResize)
      }
    })

    return {
      chartRef
    }
  }
}
</script>

<style scoped>
.kline-chart {
  width: 100%;
  height: 60px;
  min-width: 120px;
}
</style> 