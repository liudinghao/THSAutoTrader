/**
 * 股票排序服务
 * 根据综合权重对监控股票进行智能排序
 */

import { fetchHistoryData } from '../../../utils/quoteApi.js'

/**
 * 股票排序服务类
 */
export class StockRankingService {
  constructor() {
    this.isRanking = false
  }

  /**
   * 对股票列表进行智能排序
   * @param {Array} stocks - 监控股票列表
   * @param {Object} conceptRanking - 概念排行数据 {topRisers: [], topFallers: []}
   * @returns {Promise<Array>} 排序后的股票列表，带权重信息
   */
  async rankStocks(stocks, conceptRanking) {
    if (this.isRanking) {
      throw new Error('正在排序中，请稍后再试')
    }

    if (!stocks || stocks.length === 0) {
      throw new Error('监控股票列表为空')
    }

    try {
      this.isRanking = true
      console.log('开始股票智能排序，股票数量:', stocks.length)

      // 1. 收集所有股票的详细数据
      const stocksWithData = await this.collectStockData(stocks, conceptRanking)

      // 2. 计算每只股票的权重分数
      const stocksWithScores = this.calculateScores(stocksWithData)

      // 3. 按分数排序
      const sortedStocks = this.sortByScore(stocksWithScores)
      return sortedStocks

    } finally {
      this.isRanking = false
    }
  }

  /**
   * 收集股票数据
   */
  async collectStockData(stocks, conceptRanking) {
    console.log('开始收集股票数据...')
    
    // 获取60日期间：今日往前推60天
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 60)
    
    const formatDate = (date) => date.toISOString().slice(0, 10).replace(/-/g, '')
    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)

    const stocksWithData = []

    for (const stock of stocks) {
      try {
        // 获取K线数据
        const klineData = await this.getKlineData(stock.code, startDateStr, endDateStr)

        // 获取涨停原因（直接使用股票对象中的数据）
        const ztReason = this.parseZtReason(stock.limitUpReason)

        // 检查概念匹配
        const conceptMatch = this.checkConceptMatch(ztReason, conceptRanking.topRisers)

        stocksWithData.push({
          ...stock,
          klineData,
          ztReason,
          conceptMatch,
          dataCollectedAt: new Date().toISOString()
        })

      } catch (error) {
        console.error(`收集 ${stock.name} 数据失败:`, error)
        // 即使数据收集失败，也保留基本信息
        stocksWithData.push({
          ...stock,
          klineData: null,
          ztReason: null,
          conceptMatch: false,
          error: error.message,
          dataCollectedAt: new Date().toISOString()
        })
      }
    }

    return stocksWithData
  }

  /**
   * 获取K线数据
   */
  async getKlineData(stockCode, startDate, endDate) {
    try {
      const response = await fetchHistoryData([stockCode], startDate, endDate)
      
      if (response && response[stockCode]) {
        const stockData = response[stockCode]
        
        // 数据格式：{date: {CLOSE, OPEN, PRE, VOL, money}}
        // 转换为数组格式：[{date, close, open, pre_close, volume, amount}]
        const klineArray = []
        
        for (const [date, dayData] of Object.entries(stockData)) {
          klineArray.push({
            date: date,
            close: parseFloat(dayData.CLOSE || 0),
            open: parseFloat(dayData.OPEN || 0),
            pre_close: parseFloat(dayData.PRE || 0),
            volume: parseFloat(dayData.VOL || 0),
            amount: parseFloat(dayData.money || 0),
            change_percent: dayData.PRE ? ((parseFloat(dayData.CLOSE) - parseFloat(dayData.PRE)) / parseFloat(dayData.PRE) * 100).toFixed(2) : 0
          })
        }
        
        // 按日期排序（从早到晚）
        klineArray.sort((a, b) => a.date.localeCompare(b.date))
        
        console.log(`${stockCode} 转换后的K线数据长度:`, klineArray.length)
        return klineArray
      }
      
      console.warn(`${stockCode} 没有返回数据`)
      return null
    } catch (error) {
      console.error(`获取 ${stockCode} K线数据失败:`, error)
      return null
    }
  }

  /**
   * 解析涨停原因数据
   * @param {string} limitUpReason - 涨停原因字符串
   * @returns {Object|null} 解析后的涨停原因对象
   */
  parseZtReason(limitUpReason) {
    if (!limitUpReason || limitUpReason === '--' || limitUpReason.trim() === '') {
      return null
    }

    try {
      // 解析涨停原因，提取概念关键词
      // 常见格式：如 "人工智能+芯片概念" 或 "新能源汽车" 等
      const conceptKeywords = this.extractConcepts(limitUpReason)

      return {
        reason: limitUpReason,
        concepts: conceptKeywords,
        date: new Date().toISOString().slice(0, 10).replace(/-/g, '')
      }
    } catch (error) {
      console.error(`解析涨停原因失败:`, error)
      return null
    }
  }

  /**
   * 从涨停原因中提取概念关键词
   * @param {string} reason - 涨停原因字符串
   * @returns {Array} 概念关键词数组
   */
  extractConcepts(reason) {
    if (!reason) return []

    // 常见概念关键词列表（可根据需要扩展）
    const conceptKeywords = [
      '人工智能', 'AI', '芯片', '半导体', '新能源', '汽车', '电池', '光伏',
      '风电', '储能', '医药', '生物', '疫苗', '医疗', '军工', '航天',
      '5G', '通信', '云计算', '数据中心', '互联网', '游戏', '传媒',
      '房地产', '建筑', '基建', '钢铁', '有色', '化工', '农业',
      '食品', '白酒', '消费', '零售', '旅游', '航空', '银行',
      '保险', '券商', '金融', '科技', '创新', '数字经济', '元宇宙',
      '区块链', '虚拟现实', 'VR', 'AR', '物联网', '大数据'
    ]

    // 在涨停原因中查找匹配的概念
    const foundConcepts = conceptKeywords.filter(concept =>
      reason.includes(concept)
    )

    // 如果没有找到预定义概念，尝试提取可能的概念词汇
    if (foundConcepts.length === 0) {
      // 简单的概念词提取：去掉常见的非概念词汇
      const cleanReason = reason.replace(/[+\-()（）、，。]/g, ' ')
      const words = cleanReason.split(/\s+/).filter(word =>
        word.length >= 2 && !['概念', '板块', '题材', '热点', '相关'].includes(word)
      )
      return words.slice(0, 3) // 最多返回3个词
    }

    return foundConcepts
  }

  /**
   * 检查概念匹配
   */
  checkConceptMatch(ztReason, topRisingConcepts) {
    if (!ztReason || !ztReason.concepts || !topRisingConcepts) {
      return false
    }

    // 检查涨停原因中的概念是否在今日涨幅前十概念中
    const topConceptNames = topRisingConcepts.map(concept => concept.name)
    
    return ztReason.concepts.some(concept => 
      topConceptNames.some(topConcept => 
        topConcept.includes(concept) || concept.includes(topConcept)
      )
    )
  }

  /**
   * 计算股票权重分数
   */
  calculateScores(stocksWithData) {
    return stocksWithData.map(stock => {
      let score = 0
      const scoreDetails = []

      // 1. 概念匹配（权重+1）
      if (stock.conceptMatch) {
        score += 1
        scoreDetails.push('概念匹配(+1)')
      }

      // 2. 向上趋势（权重+1）
      if (this.isUpTrend(stock.klineData)) {
        score += 1
        scoreDetails.push('向上趋势(+1)')
      }

      // 3. 龙回头二波启动（权重+2）
      if (this.isLongTouSecondWave(stock.klineData)) {
        score += 2
        scoreDetails.push('龙回头二波(+2)')
      }

      // 4. 60天内无跌停（权重+1）
      if (this.hasNoLimitDown(stock.klineData)) {
        score += 1
        scoreDetails.push('无跌停历史(+1)')
      }

      return {
        ...stock,
        score,
        scoreDetails,
        maxScore: 5
      }
    })
  }

  /**
   * 判断是否为向上趋势
   */
  isUpTrend(klineData) {
    if (!klineData || !Array.isArray(klineData) || klineData.length < 20) {
      return false
    }

    // 简单趋势判断：比较最近20天和前20天的平均价格
    const recent20 = klineData.slice(-20)
    const previous20 = klineData.slice(-40, -20)

    if (previous20.length < 20) {
      return false
    }

    const recentAvg = recent20.reduce((sum, day) => sum + parseFloat(day.close), 0) / 20
    const previousAvg = previous20.reduce((sum, day) => sum + parseFloat(day.close), 0) / 20

    return recentAvg > previousAvg * 1.02 // 至少上涨2%
  }

  /**
   * 判断是否为龙回头二波启动形态
   */
  isLongTouSecondWave(klineData) {
    if (!klineData || !Array.isArray(klineData) || klineData.length < 30) {
      return false
    }

    // 龙回头二波启动形态特征：
    // 1. 前期有明显高点
    // 2. 回调幅度适中（10-30%）
    // 3. 近期开始反弹
    
    const data = klineData.slice(-30) // 最近30天
    const prices = data.map(d => parseFloat(d.close))
    
    // 找到最高点
    const maxPrice = Math.max(...prices)
    const maxIndex = prices.indexOf(maxPrice)
    
    // 找到最高点后的最低点
    const afterMaxPrices = prices.slice(maxIndex)
    const minPriceAfterMax = Math.min(...afterMaxPrices)
    const minIndex = maxIndex + afterMaxPrices.indexOf(minPriceAfterMax)
    
    // 计算回调幅度
    const pullbackRatio = (maxPrice - minPriceAfterMax) / maxPrice
    
    // 检查最近价格是否开始反弹
    const currentPrice = prices[prices.length - 1]
    const recentLow = Math.min(...prices.slice(-5))
    const reboundRatio = (currentPrice - recentLow) / recentLow
    
    // 龙回头二波条件：
    // 1. 回调幅度在10%-30%之间
    // 2. 最近有反弹迹象（5%以上）
    // 3. 最低点不是最近3天
    return pullbackRatio >= 0.1 && 
           pullbackRatio <= 0.3 && 
           reboundRatio >= 0.05 && 
           minIndex < prices.length - 3
  }

  /**
   * 判断60天内是否无跌停
   */
  hasNoLimitDown(klineData) {
    if (!klineData || !Array.isArray(klineData) || klineData.length === 0) {
      return false
    }

    // 检查60天内是否有跌停（跌幅超过9.8%）
    return !klineData.some(day => {
      const changePercent = parseFloat(day.change_percent || 0)
      return changePercent <= -9.8
    })
  }

  /**
   * 按分数排序
   */
  sortByScore(stocksWithScores) {
    return stocksWithScores.sort((a, b) => {
      // 按分数降序排列
      if (b.score !== a.score) {
        return b.score - a.score
      }
      
      // 分数相同时按涨幅排序
      const aChange = parseFloat(a.change_percent || 0)
      const bChange = parseFloat(b.change_percent || 0)
      return bChange - aChange
    })
  }
}

// 创建服务实例
export const stockRankingService = new StockRankingService()