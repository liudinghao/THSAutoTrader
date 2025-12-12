/**
 * 股票排序服务
 * 根据综合权重对监控股票进行智能排序
 */

import { fetchHistoryData, fetchMinuteData, getPreTradeDate } from '../../../utils/quoteApi.js'
import { sendLLMMessage } from '../../../services/llmService.js'

/**
 * 股票排序服务类
 */
export class StockRankingService {
  constructor() {
    this.isRanking = false
    this.conceptMatchCache = new Map() // 概念匹配缓存
    this.cacheExpireTime = 30 * 60 * 1000 // 缓存30分钟过期
  }

  /**
   * 对股票列表进行智能排序
   * @param {Array} stocks - 监控股票列表
   * @param {Object} conceptRanking - 概念排行数据 {topRisers: [], topFallers: []}
   * @param {Boolean} forceRefresh - 是否强制刷新（跳过缓存）
   * @returns {Promise<Array>} 排序后的股票列表，带权重信息
   */
  async rankStocks(stocks, conceptRanking, forceRefresh = false) {
    if (this.isRanking) {
      throw new Error('正在排序中，请稍后再试')
    }

    if (!stocks || stocks.length === 0) {
      throw new Error('监控股票列表为空')
    }

    try {
      this.isRanking = true

      // 1. 收集所有股票的详细数据
      const stocksWithData = await this.collectStockData(stocks, conceptRanking, forceRefresh)

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
   * @param {Boolean} forceRefresh - 是否强制刷新（跳过缓存）
   */
  async collectStockData(stocks, conceptRanking, forceRefresh = false) {

    // 获取60日期间：今日往前推60天
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 60)

    const formatDate = (date) => date.toISOString().slice(0, 10).replace(/-/g, '')
    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)

    const stockCodes = stocks.map(stock => stock.code)

    try {
      const allKlineResponse = await fetchHistoryData(stockCodes, startDateStr, endDateStr)
      const preTradeDate = await getPreTradeDate()

      let allMinuteDataResponse = null
      try {
        allMinuteDataResponse = await fetchMinuteData(stockCodes, preTradeDate)
      } catch (minuteError) {
        console.warn(`[StockRanking] 获取分时数据失败:`, minuteError)
      }

      const stocksWithData = stocks.map(stock => {
        try {
          const klineData = this.parseKlineData(stock.code, allKlineResponse)
          const minuteData = this.parseMinuteData(stock.code, allMinuteDataResponse)
          const ztReason = this.parseZtReason(stock.limitUpReason)

          return {
            ...stock,
            klineData,
            minuteData,
            ztReason,
            dataCollectedAt: new Date().toISOString()
          }

        } catch (error) {
          console.error(`[StockRanking] 处理股票数据失败: ${stock.code}`, error)
          return {
            ...stock,
            klineData: null,
            minuteData: null,
            ztReason: null,
            error: error.message,
            dataCollectedAt: new Date().toISOString()
          }
        }
      })

      const stocksWithConceptMatch = await this.batchAnalyzeConceptMatch(stocksWithData, conceptRanking.topRisers, forceRefresh)
      return stocksWithConceptMatch

    } catch (error) {
      console.error(`[StockRanking] 批量获取K线数据失败`, error)

      const stocksWithData = []
      const preTradeDate = await getPreTradeDate()

      for (const stock of stocks) {
        try {
          const klineData = await this.getKlineData(stock.code, startDateStr, endDateStr)

          let minuteData = null
          try {
            const minuteDataResponse = await fetchMinuteData([stock.code], preTradeDate)
            minuteData = this.parseMinuteData(stock.code, minuteDataResponse)
          } catch (minuteError) {
            console.warn(`[StockRanking] 获取${stock.code}分时数据失败:`, minuteError)
          }

          const ztReason = this.parseZtReason(stock.limitUpReason)

          stocksWithData.push({
            ...stock,
            klineData,
            minuteData,
            ztReason,
            dataCollectedAt: new Date().toISOString()
          })

        } catch (error) {
          stocksWithData.push({
            ...stock,
            klineData: null,
            minuteData: null,
            ztReason: null,
            error: error.message,
            dataCollectedAt: new Date().toISOString()
          })
        }
      }

      const stocksWithConceptMatch = await this.batchAnalyzeConceptMatch(stocksWithData, conceptRanking.topRisers, forceRefresh)
      return stocksWithConceptMatch
    }
  }

  /**
   * 从批量响应中解析单个股票的K线数据
   * @param {string} stockCode - 股票代码
   * @param {Object} allKlineResponse - 批量K线数据响应
   * @returns {Array|null} K线数组
   */
  parseKlineData(stockCode, allKlineResponse) {
    if (!allKlineResponse) {
      return null
    }

    let stockData = null

    if (allKlineResponse[stockCode]) {
      stockData = allKlineResponse[stockCode]
    } else {
      for (const key of Object.keys(allKlineResponse)) {
        if (key.endsWith(`:${stockCode}`) || key === stockCode) {
          stockData = allKlineResponse[key]
          break
        }
      }
    }

    if (!stockData) {
      console.warn(`[StockRanking] 未找到K线数据: ${stockCode}`)
      return null
    }

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

    klineArray.sort((a, b) => a.date.localeCompare(b.date))
    return klineArray
  }

  /**
   * 从批量响应中解析单个股票的分时数据
   * @param {string} stockCode - 股票代码
   * @param {Object} allMinuteResponse - 批量分时数据响应
   * @returns {Object|null} 分时数据对象 {times: [], prices: [], volumes: []}
   */
  parseMinuteData(stockCode, allMinuteResponse) {
    if (!allMinuteResponse) {
      return null
    }

    let stockData = null

    if (allMinuteResponse[stockCode]) {
      stockData = allMinuteResponse[stockCode]
    } else {
      for (const key of Object.keys(allMinuteResponse)) {
        if (key.endsWith(`:${stockCode}`) || key === stockCode) {
          stockData = allMinuteResponse[key]
          break
        }
      }
    }

    if (!stockData) {
      console.warn(`[StockRanking] 未找到分时数据: ${stockCode}`)
      return null
    }

    const times = []
    const prices = []
    const volumes = []

    for (const [time, minuteData] of Object.entries(stockData)) {
      times.push(time)
      const price = parseFloat(minuteData.NEW || minuteData.CLOSE || 0)
      const volume = parseFloat(minuteData.VOL || 0)
      prices.push(price)
      volumes.push(volume)
    }

    return {
      times,
      prices,
      volumes
    }
  }

  /**
   * 获取K线数据
   */
  async getKlineData(stockCode, startDate, endDate) {
    try {
      const response = await fetchHistoryData([stockCode], startDate, endDate)

      let stockData = null

      if (response && response[stockCode]) {
        stockData = response[stockCode]
      } else if (response) {
        for (const key of Object.keys(response)) {
          if (key.endsWith(`:${stockCode}`) || key === stockCode) {
            stockData = response[key]
            break
          }
        }
      }

      if (!stockData) {
        console.warn(`[StockRanking] 未找到股票K线数据: ${stockCode}`)
        return null
      }

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

      klineArray.sort((a, b) => a.date.localeCompare(b.date))
      return klineArray

    } catch (error) {
      console.error(`[StockRanking] 获取K线数据异常: ${stockCode}`, error)
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
   * 生成缓存键
   * @param {Array} stockReasons - 股票涨停原因列表
   * @param {Array} topConcepts - 热门概念列表
   * @returns {string} 缓存键
   */
  generateCacheKey(stockReasons, topConcepts) {
    // 使用股票涨停原因和概念的组合生成唯一键
    const stocksKey = stockReasons.map(reason => reason.trim()).sort().join('|')
    // 只使用概念名称，忽略变化的涨跌幅数据
    const conceptsKey = topConcepts.map(c => (c.name || c.platename || '').trim()).sort().join('|')

    // 简单哈希函数生成短键
    const combined = stocksKey + '###' + conceptsKey
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    const finalKey = `concept_match_${Math.abs(hash)}`

    return finalKey
  }

  /**
   * 获取缓存的分析结果
   * @param {string} cacheKey - 缓存键
   * @returns {Object|null} 缓存的结果或null
   */
  getCachedResult(cacheKey) {

    const cached = this.conceptMatchCache.get(cacheKey)
    if (!cached) {
      return null
    }

    // 检查是否过期
    const age = Date.now() - cached.timestamp
    if (age > this.cacheExpireTime) {
      this.conceptMatchCache.delete(cacheKey)
      return null
    }

    return cached.result
  }

  /**
   * 缓存分析结果
   * @param {string} cacheKey - 缓存键
   * @param {Object} result - 分析结果
   */
  setCachedResult(cacheKey, result) {
    this.conceptMatchCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    })
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now()
    for (const [key, cached] of this.conceptMatchCache.entries()) {
      if (now - cached.timestamp > this.cacheExpireTime) {
        this.conceptMatchCache.delete(key)
      }
    }
  }

  /**
   * 清空所有缓存
   */
  clearAllCache() {
    this.conceptMatchCache.clear()
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const now = Date.now()
    const total = this.conceptMatchCache.size
    let expired = 0
    for (const [, cached] of this.conceptMatchCache.entries()) {
      if (now - cached.timestamp > this.cacheExpireTime) {
        expired++
      }
    }
    return {
      total,
      expired,
      valid: total - expired,
      cacheExpireTime: this.cacheExpireTime
    }
  }

  /**
   * 批量分析概念匹配
   * 使用 deepseek 大模型智能分析涨停原因与热门概念的匹配度
   * @param {Array} stocksWithData - 带数据的股票列表
   * @param {Array} topRisingConcepts - 今日涨幅前十概念
   * @param {Boolean} forceRefresh - 是否强制刷新（跳过缓存）
   * @returns {Promise<Array>} 带概念匹配结果的股票列表
   */
  async batchAnalyzeConceptMatch(stocksWithData, topRisingConcepts, forceRefresh = false) {
    try {
      // 清理过期缓存
      this.cleanExpiredCache()

      // 准备批量分析的数据
      const validStocks = stocksWithData.filter(stock =>
        stock.ztReason && stock.ztReason.reason && stock.ztReason.reason !== '--'
      )

      if (validStocks.length === 0) {
        // 如果没有有效的涨停原因数据，都设为0分
        return stocksWithData.map(stock => ({
          ...stock,
          score: 0,
          scoreReason: '无涨停原因数据',
          matchedConcepts: []
        }))
      }

      // 生成缓存键
      const stockReasons = validStocks.map(stock => stock.ztReason.reason)
      const cacheKey = this.generateCacheKey(stockReasons, topRisingConcepts)


      // 尝试从缓存获取结果（强制刷新时跳过缓存）
      if (!forceRefresh) {
        const cachedResult = this.getCachedResult(cacheKey)
        if (cachedResult) {
          console.log('[StockRanking] 使用缓存的AI评分结果')
          // 应用缓存结果到股票数据
          return stocksWithData.map(stock => {
            const stockResult = cachedResult[stock.code]
            return {
              ...stock,
              // 使用AI的综合评分（0-100分）
              score: stockResult ? stockResult.score : 0,
              scoreReason: stockResult ? stockResult.reason : '未评分',
              matchedConcepts: stockResult ? stockResult.concepts || [] : [],
              fromCache: true // 标记来自缓存
            }
          })
        }
      } else {
        console.log('[StockRanking] 强制刷新，跳过缓存，重新调用AI分析')
      }

      // 1. 提取概念名称列表（优化：简化数据，只传递概念名称）
      const conceptNames = topRisingConcepts.slice(0, 10).map(concept =>
        concept.name || concept.platename
      ).filter(Boolean) // 过滤掉空值

      // 2. 构造股票分析数据（包含涨停原因、K线数据和分时数据）
      const stockAnalysisData = validStocks.map(stock => {
        const klineText = this.formatKlineForAI(stock.klineData, 30)
        const minuteText = this.formatMinuteDataForAI(stock.minuteData)

        return {
          name: stock.name,
          code: stock.code,
          reason: stock.ztReason.reason,
          klineText,
          minuteText
        }
      })

      // 3. 格式化股票数据文本
      const stockDataText = stockAnalysisData.map(stock =>
        `${stock.name}(${stock.code}):\n涨停原因: ${stock.reason}\n\n最近30日K线:\n${stock.klineText}\n\n上一交易日分时特征:\n${stock.minuteText}`
      ).join('\n\n' + '='.repeat(60) + '\n\n')

      // 4. 构造优化后的prompt（AI完全接管评分）
      const prompt = `
你是一位经验丰富的超短线交易员，精通量价分析。请综合分析以下股票，给出0-100分的评分。

【交易风格】超短线（持仓1-3天），重点关注：
- 概念热度和题材匹配度
- 资金流向和主力动向
- 短期量价配合
- 出货信号识别

【今日涨幅前十概念】
${conceptNames.join('、')}

【股票分析数据】
${stockDataText}

【评分标准（0-100分）】

📊 概念匹配度（0-40分）：
- 完全匹配今日热门概念：30-40分
- 部分匹配或相关概念：15-30分
- 概念较冷门或不相关：0-15分

📈 量价健康度（0-40分）：
⚠️ 重点分析上一交易日的完整分时走势，这对集合竞价买入决策至关重要！

【K线维度评分】（20分）
高分（15-20分）：
- 放量上涨：价格上涨且成交量明显放大（较前几日增加30%以上）
- 缩量回调：小幅回调但成交量明显萎缩，筹码稳定
- 突破放量：突破前期高点时伴随成交量放大
- 连续阳线：近期连续收阳，成交量温和放大

中等（8-15分）：量价平衡、横盘整理、温和上涨

低分（0-8分）：上涨缩量、下跌放量、冲高回落、量价背离、巨量滞涨

【分时维度评分】（20分）- 基于上一交易日完整分时数据
⚠️ 你需要自己分析完整的分时数据，识别以下关键模式：

高分模式（15-20分）：
- 尾盘封板/强势拉升（14:30后）：资金强势，次日容易高开
- 全天强势：价格持续在高位，振幅小，筹码锁定好
- 午后放量上攻：13:00后成交量放大且价格上涨，主力进场
- 分时平稳上行：价格稳步抬升，无大幅回调

中等模式（8-15分）：
- 震荡整理：全天窄幅震荡，成交量平稳
- 盘中回调后企稳：有回调但收盘企稳

⚠️ 低分/出货模式（0-8分）- 这些是致命信号，必须严格扣分！
- 尾盘跳水（14:30后大跌）：主力出货，次日大概率低开
- 冲高回落：开盘拉高后持续走低，诱多出货
- 炸板：涨停后打开且未再封，承接力弱
- 巨量震荡：振幅大（>5%）且成交量异常放大
- 高开低走：开盘高开但全天走低
- 盘中跳水：任何时段突然大幅下跌（跌幅>3%）

【分析方法】：
1. 观察开盘走势（9:30-10:00）：是否强势还是弱势
2. 观察午盘走势（13:00-14:00）：是否有主力资金介入
3. ⚠️ 重点观察尾盘（14:30-15:00）：这是最关键的时段
4. 观察全天量价配合：价升量增是健康，价升量缩或价跌量增是危险信号
5. 识别异常波动：突然跳水、巨量对倒等

⚡ 技术形态加分（0-20分）：
- 龙回头二波启动：+10分
- 突破平台整理：+8分
- 缩量洗盘后启动：+6分
- 连续缩量阴线后反弹：+5分
- 其他健康形态：0-5分

⚠️ 风险减分项（可直接从总分扣除）：
- 近期有跌停板（5日内）：-15分
- 连续跌停或多次跌停：-30分
- 高位巨量换手后下跌：-20分
- 破位下跌（跌破重要支撑）：-15分
- 阴跌不止（连续5天以上阴线）：-10分
- 成交量异常萎缩（地量）：-8分
- ST或*ST股票：-20分

【输出格式】严格按照JSON格式，不要包含任何其他内容。
⚠️ 重要：JSON的key必须是纯股票代码（不要包含股票名称），例如"605196"而不是"华通线缆(605196)"
{
  "605196": {
    "score": 85,
    "reason": "概念匹配(35分) + K线健康度(18分) + 分时健康度(20分) + 技术形态加分(12分)",
    "concepts": ["游戏", "人工智能"]
  },
  "603069": {
    "score": 25,
    "reason": "概念匹配(5分) + K线健康度(10分) + 分时健康度(10分) + 技术形态加分(0分)",
    "concepts": []
  },
  "000993": {
    "score": 20,
    "reason": "概念匹配(20分) + K线健康度(15分) + 分时健康度(10分) + 技术形态加分(0分) + 近期跌停(-15分) + 破位下跌(-10分)",
    "concepts": ["半导体"]
  }
}

【注意事项】
- 只输出JSON，不要有任何解释文字
- score必须是0-100之间的整数，可以为负数（存在严重风险时）
- reason格式要求：
  * 所有项都用 + 连接（包括减分项）
  * 减分项的分数带负号，如：近期跌停(-15分)
  * 不要写"无风险减分"这类0分项
  * 标准格式：概念匹配(XX分) + K线健康度(XX分) + 分时健康度(XX分) + 技术形态加分(XX分) + 风险项1(-XX分) + 风险项2(-XX分)
- 概念匹配支持模糊匹配和相关性判断
- ⚠️ **分时数据分析是核心**：
  * 你会看到完整的分时价格和成交量数据（采样后约40-60个时间点）
  * 必须仔细分析尾盘走势（14:30-15:00），这是最关键的判断依据
  * 尾盘跳水、炸板、巨量震荡等出货信号必须严格扣分
  * 尾盘封板、强势拉升等强势信号可以加分
- 重点识别资金出货信号，发现出货迹象果断给低分
- 严格执行减分项：跌停板、破位、阴跌等风险必须扣分
- 超短线交易风险优先：宁可错过，不要接盘高风险股票
`


      // 调用 deepseek 模型（使用新的 LLM 服务）
      const response = await sendLLMMessage(
        [{ role: 'user', content: prompt }],
        {
          provider: 'deepseek',
          model: 'deepseek-chat',
          temperature: 0.1, // 低温度，确保输出格式稳定
          maxTokens: 2000
        }
      )


      let analysisResult = {}
      try {
        const responseContent = response.content || response.message || ''
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const rawResult = JSON.parse(jsonMatch[0])

          analysisResult = {}
          for (const [key, value] of Object.entries(rawResult)) {
            const codeMatch = key.match(/\((\d{6})\)/) || key.match(/^(\d{6})$/)
            if (codeMatch) {
              const pureCode = codeMatch[1]
              analysisResult[pureCode] = value
            } else {
              console.warn(`[StockRanking] 无法解析股票代码: "${key}"`)
            }
          }
        } else {
          console.error('[StockRanking] AI返回内容中未找到JSON')
        }
      } catch (parseError) {
        console.error('[StockRanking] JSON解析失败:', parseError)
      }

      this.setCachedResult(cacheKey, analysisResult)

      return stocksWithData.map(stock => {
        const stockResult = analysisResult[stock.code]
        if (!stockResult) {
          console.warn(`[StockRanking] 未找到股票 ${stock.code}(${stock.name}) 的评分结果`)
        }
        return {
          ...stock,
          score: stockResult ? stockResult.score : 0,
          scoreReason: stockResult ? stockResult.reason : '未评分',
          matchedConcepts: stockResult ? stockResult.concepts || [] : [],
          fromCache: false
        }
      })

    } catch (error) {
      console.error('[StockRanking] AI分析失败:', error)
      // 发生错误时，所有股票评分设为0
      return stocksWithData.map(stock => ({
        ...stock,
        score: 0,
        scoreReason: `AI分析失败: ${error.message}`,
        matchedConcepts: [],
        conceptAnalysisError: error.message
      }))
    }
  }

  /**
   * 格式化K线数据为文本（用于传递给AI）
   * @param {Array} klineData - K线数据数组
   * @param {number} maxDays - 最多取最近几天，默认30天
   * @returns {string} 格式化的K线数据文本
   */
  formatKlineForAI(klineData, maxDays = 30) {
    if (!klineData || !Array.isArray(klineData) || klineData.length === 0) {
      return '无K线数据'
    }

    // 取最近的N天数据
    const recentData = klineData.slice(-maxDays)

    // 格式化为表格文本（包含量价关系）
    const lines = ['日期       开盘    收盘    涨跌幅   成交量(万手)']
    recentData.forEach(day => {
      // 成交量转换为万手（原始单位可能是手）
      const volumeWan = (day.volume / 10000).toFixed(2)
      const line = `${day.date} ${day.open.toFixed(2).padStart(7)} ${day.close.toFixed(2).padStart(7)} ${String(day.change_percent).padStart(6)}% ${String(volumeWan).padStart(10)}`
      lines.push(line)
    })

    return lines.join('\n')
  }

  /**
   * 格式化分时数据为文本（用于传递给AI）
   * @param {Object} minuteData - 分时数据对象 {times: [], prices: [], volumes: []}
   * @returns {string} 格式化的分时数据文本
   */
  formatMinuteDataForAI(minuteData) {
    if (!minuteData || !minuteData.times || minuteData.times.length === 0) {
      return '无分时数据'
    }

    const { times, prices, volumes } = minuteData
    const lines = ['时间     价格    成交量(万手)']

    for (let i = 0; i < times.length; i++) {
      const time = times[i]
      const isKeyTime = (time >= '09:30:00' && time <= '10:00:00') ||
                        (time >= '14:30:00' && time <= '15:00:00')

      const minute = parseInt(time.split(':')[1])
      const isSamplePoint = minute % 5 === 0 || minute === 0

      if (isKeyTime || isSamplePoint || i === 0 || i === times.length - 1) {
        const price = prices[i].toFixed(2)
        const volume = (volumes[i] / 10000).toFixed(2)
        lines.push(`${time} ${price.padStart(7)} ${volume.padStart(12)}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * 计算股票权重分数 - 直接使用AI评分
   */
  calculateScores(stocksWithData) {
    return stocksWithData.map(stock => ({
      ...stock,
      score: stock.score || 0,
      scoreReason: stock.scoreReason || '未评分',
      maxScore: 100,
      matchedConcepts: stock.matchedConcepts || []
    }))
  }

  /**
   * 按分数排序
   */
  sortByScore(stocksWithScores) {
    return stocksWithScores.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }

      const aChange = parseFloat(a.change_percent || 0)
      const bChange = parseFloat(b.change_percent || 0)
      return bChange - aChange
    })
  }
}

// 创建服务实例
export const stockRankingService = new StockRankingService()