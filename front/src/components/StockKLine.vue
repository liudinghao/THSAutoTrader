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
    }
  },
  setup(props) {
    const chartRef = ref(null)
    let chart = null

    const getSecid = (code) => {
      return code.startsWith('6') ? `1.${code}` : `0.${code}`
    }

    const getCurrentDate = () => {
      const date = new Date()
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }

    const initChart = () => {
      if (chartRef.value) {
        chart = echarts.init(chartRef.value)
      }
    }

    const fetchKLineData = async () => {
      try {
        const secid = getSecid(props.code)
        const endDate = getCurrentDate()
        const response = await fetch(
          `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1%2Cf2%2Cf3%2Cf4%2Cf5%2Cf6&fields2=f51%2Cf52%2Cf53%2Cf54%2Cf55%2Cf56%2Cf57%2Cf58%2Cf59%2Cf60%2Cf61&klt=101&fqt=1&end=${endDate}&lmt=30`
        )
        const result = await response.json()
        
        if (result.rc === 0 && result.data.klines) {
          const data = result.data.klines.map(item => {
            const [date, open, close, high, low] = item.split(',')
            return {
              date,
              value: [parseFloat(open), parseFloat(close), parseFloat(low), parseFloat(high)]
            }
          })
          
          const option = {
            grid: {
              left: '3%',
              right: '3%',
              bottom: '3%',
              top: '3%',
              containLabel: true
            },
            xAxis: {
              type: 'category',
              data: data.map(item => item.date),
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
              data: data.map(item => item.value),
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
      } catch (error) {
        console.error('获取K线数据失败:', error)
      }
    }

    watch(() => props.code, () => {
      fetchKLineData()
    })

    onMounted(() => {
      initChart()
      fetchKLineData()
    })

    onUnmounted(() => {
      if (chart) {
        chart.dispose()
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
  width: 200px;
  height: 100px;
}
</style> 