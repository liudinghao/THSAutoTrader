/**
 * 网络搜索服务
 * 用于股票负面消息搜索
 */

/**
 * 网络搜索类
 */
export class WebSearch {
  constructor() {
    this.cache = new Map()
    this.cacheTimeout = 10 * 60 * 1000 // 10分钟缓存
    this.configKey = 'web_search_config' // localStorage配置键
    this.config = this.loadConfig()
  }

  /**
   * 搜索股票负面消息
   * @param {string} stockCode 股票代码
   * @param {string} stockName 股票名称
   * @param {number} monthsBack 搜索时间范围（月）
   * @returns {Promise<Object>} 搜索结果
   */
  async searchNegativeNews(stockCode, stockName, monthsBack = 1) {
    const cacheKey = `negative_news_${stockCode}_${monthsBack}`
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`使用缓存的负面消息数据: ${stockName}(${stockCode})`)
        return cached.data
      }
    }

    try {
      console.log(`开始搜索 ${stockName}(${stockCode}) 的负面消息...`)
      
      // 构造搜索关键词
      const searchQueries = this.generateSearchQueries(stockCode, stockName, monthsBack)
      
      // 执行多个搜索查询
      const searchResults = []
      for (const query of searchQueries) {
        try {
          const result = await this.performWebSearch(query)
          if (result && result.length > 0) {
            searchResults.push(...result)
          }
          // 添加延迟避免请求过快
          await this.delay(500)
        } catch (error) {
          console.warn(`搜索查询失败: ${query}`, error)
        }
      }

      // 处理和过滤搜索结果
      const processedNews = this.processSearchResults(searchResults, stockCode, stockName, monthsBack)
      
      // 缓存结果
      const result = {
        stockCode,
        stockName,
        monthsBack,
        totalResults: processedNews.length,
        negativeNews: processedNews,
        searchTime: new Date().toISOString(),
        summary: this.generateSummary(processedNews)
      }

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      })

      console.log(`${stockName}(${stockCode}) 负面消息搜索完成: 找到 ${processedNews.length} 条相关消息`)
      return result

    } catch (error) {
      console.error(`搜索 ${stockName}(${stockCode}) 负面消息失败:`, error)
      return {
        stockCode,
        stockName,
        monthsBack,
        totalResults: 0,
        negativeNews: [],
        searchTime: new Date().toISOString(),
        summary: '搜索失败：无法获取负面消息信息',
        error: error.message
      }
    }
  }

  /**
   * 生成搜索关键词
   */
  generateSearchQueries(stockCode, stockName, monthsBack) {
    const timeFilter = this.getTimeFilter(monthsBack)
    const queries = [
      `${stockName} 负面消息 问题 风险 ${timeFilter}`,
      `${stockName} ${stockCode} 违规 处罚 调查 ${timeFilter}`,
      `${stockName} 业绩 下滑 亏损 危机 ${timeFilter}`,
      `${stockName} 诉讼 纠纷 争议 ${timeFilter}`,
      `${stockName} 停牌 退市 警示 ${timeFilter}`,
    ]
    return queries
  }

  /**
   * 获取时间过滤器
   */
  getTimeFilter(monthsBack) {
    const now = new Date()
    const pastDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate())
    
    if (monthsBack === 1) {
      return '最近一个月'
    } else if (monthsBack === 3) {
      return '最近三个月'
    } else {
      return `${pastDate.getFullYear()}年${pastDate.getMonth() + 1}月以来`
    }
  }

  /**
   * 执行网络搜索
   * 使用 Moonshot API 进行联网搜索
   */
  async performWebSearch(query) {
    try {
      console.log(`执行搜索: ${query}`)
      
      // 使用 Moonshot API 进行联网搜索
      const searchResults = await this.performRealWebSearch(query)
      if (searchResults && searchResults.length > 0) {
        return searchResults
      }
      
      // 如果搜索失败，返回空结果
      console.log('Moonshot API 搜索未返回结果')
      return []
      
    } catch (error) {
      console.error('网络搜索执行失败:', error)
      return []
    }
  }

  /**
   * 使用 Moonshot API 进行网络搜索
   */
  async performRealWebSearch(query) {
    try {
      console.log(`使用 Moonshot API 搜索: ${query}`)
      
      // 使用 Moonshot API 进行联网搜索
      const searchResult = await this.searchWithMoonshot(query)
      
      if (searchResult && searchResult.length > 0) {
        return searchResult
      }
      
      console.warn('Moonshot 搜索未返回结果')
      return []
      
    } catch (error) {
      console.warn('Moonshot API 搜索失败:', error)
      return []
    }
  }

  /**
   * 使用 Moonshot API 进行联网搜索
   */
  async searchWithMoonshot(query) {
    try {
      // 从配置中获取 API Key
      const apiKey = this.config.moonshotApiKey
      
      if (!apiKey || apiKey === 'sk-your-moonshot-api-key' || apiKey === '') {
        console.warn('Moonshot API Key 未配置，跳过联网搜索')
        return []
      }

      const messages = [
        { 
          "role": "system", 
          "content": "你是专业的财经信息搜索助手。请搜索用户指定的股票负面消息，并以JSON格式返回结果。每条消息包含title、content、url、source、publishTime、relevance字段。" 
        },
        { 
          "role": "user", 
          "content": `请搜索关于"${query}"的负面消息和风险信息，返回最新的3-5条相关新闻` 
        }
      ]

      const tools = [
        {
          "type": "builtin_function",
          "function": {
            "name": "$web_search"
          }
        }
      ]

      let finishReason = null
      let searchResults = []

      // 循环处理工具调用
      while (finishReason === null || finishReason === "tool_calls") {
        const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "kimi-k2-0905-preview",
            messages: messages,
            temperature: 0.3,
            tools: tools
          })
        })

        if (!response.ok) {
          throw new Error(`Moonshot API 请求失败: ${response.status}`)
        }

        const completion = await response.json()
        const choice = completion.choices[0]
        finishReason = choice.finish_reason

        if (finishReason === "tool_calls") {
          messages.push(choice.message)
          
          for (const toolCall of choice.message.tool_calls) {
            const toolCallName = toolCall.function.name
            const toolCallArguments = JSON.parse(toolCall.function.arguments)
            
            let toolResult = {}
            if (toolCallName === "$web_search") {
              // Moonshot 内置的联网搜索工具会自动执行
              toolResult = toolCallArguments
            } else {
              toolResult = { error: 'no tool found' }
            }

            messages.push({
              "role": "tool",
              "tool_call_id": toolCall.id,
              "name": toolCallName,
              "content": JSON.stringify(toolResult)
            })
          }
        } else {
          // 处理最终回复，提取搜索结果
          const content = choice.message.content
          console.log('Moonshot 搜索结果:', content)
          
          // 尝试从回复中提取结构化的搜索结果
          searchResults = this.parseSearchResultsFromAI(content, query)
          break
        }
      }

      return searchResults

    } catch (error) {
      console.error('Moonshot API 调用失败:', error)
      return []
    }
  }

  /**
   * 从 AI 回复中解析搜索结果
   */
  parseSearchResultsFromAI(content, query) {
    try {
      // 尝试提取 JSON 格式的结果
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0])
        return this.convertAISearchResults(results)
      }
      
      // 如果没有JSON格式，则创建基于文本内容的结果
      const stockName = query.split(' ')[0]
      return [{
        title: `${stockName}相关信息搜索结果`,
        content: content.substring(0, 500),
        url: '',
        source: 'Moonshot AI 搜索',
        publishTime: new Date().toISOString(),
        relevance: 0.8
      }]

    } catch (error) {
      console.warn('解析 AI 搜索结果失败:', error)
      return []
    }
  }

  /**
   * 转换 AI 搜索结果格式
   */
  convertAISearchResults(results) {
    if (!Array.isArray(results)) {
      return []
    }

    return results.map(item => ({
      title: item.title || '',
      content: item.content || item.description || '',
      url: item.url || '',
      source: item.source || 'AI搜索',
      publishTime: item.publishTime || item.date || new Date().toISOString(),
      relevance: item.relevance || 0.7
    }))
  }


  /**
   * 处理搜索结果
   */
  processSearchResults(results, stockCode, stockName, monthsBack = 1) {
    if (!results || results.length === 0) {
      return []
    }

    return results
      .filter(item => item && item.title && item.content)
      .filter(item => this.isRelevantNews(item, stockCode, stockName))
      .filter(item => this.isNegativeNews(item))
      .filter(item => this.isWithinTimeRange(item, monthsBack)) // 添加时间范围过滤
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      .slice(0, 10) // 最多返回10条最相关的负面消息
      .map(item => ({
        title: item.title,
        summary: item.content.substring(0, 200) + (item.content.length > 200 ? '...' : ''),
        url: item.url,
        publishTime: item.publishTime,
        source: item.source,
        relevance: item.relevance,
        negativeKeywords: this.extractNegativeKeywords(item.content)
      }))
  }

  /**
   * 判断新闻是否在时间范围内
   */
  isWithinTimeRange(item, monthsBack) {
    try {
      if (!item.publishTime) {
        // 如果没有发布时间，默认认为是最近的消息
        return true
      }

      const publishDate = this.parsePublishTime(item.publishTime)
      const now = new Date()
      const cutoffDate = new Date()
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack)

      // 检查日期是否有效
      if (isNaN(publishDate.getTime())) {
        console.warn('无效的发布时间:', item.publishTime)
        return true // 无效时间默认通过
      }

      const isWithinRange = publishDate >= cutoffDate && publishDate <= now
      
      if (!isWithinRange) {
        console.log(`消息超出时间范围: ${item.title} - 发布时间: ${item.publishTime}`)
      }
      
      return isWithinRange
    } catch (error) {
      console.warn('时间范围检查失败:', error, item.publishTime)
      return true // 出错时默认通过
    }
  }

  /**
   * 解析发布时间，支持多种格式
   */
  parsePublishTime(publishTime) {
    if (!publishTime) {
      return new Date()
    }

    // 尝试直接解析ISO格式和标准格式
    let date = new Date(publishTime)
    if (!isNaN(date.getTime())) {
      return date
    }

    // 尝试解析中文格式：YYYY年MM月DD日
    const chineseDateMatch = publishTime.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
    if (chineseDateMatch) {
      const [, year, month, day] = chineseDateMatch
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      if (!isNaN(date.getTime())) {
        return date
      }
    }

    // 尝试解析 YYYY-MM-DD 格式
    const dashDateMatch = publishTime.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (dashDateMatch) {
      const [, year, month, day] = dashDateMatch
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      if (!isNaN(date.getTime())) {
        return date
      }
    }

    // 尝试解析 MM/DD/YYYY 格式
    const slashDateMatch = publishTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (slashDateMatch) {
      const [, month, day, year] = slashDateMatch
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      if (!isNaN(date.getTime())) {
        return date
      }
    }

    // 如果都解析失败，返回当前时间
    console.warn('无法解析发布时间格式:', publishTime)
    return new Date()
  }

  /**
   * 判断新闻是否相关
   */
  isRelevantNews(item, stockCode, stockName) {
    const content = (item.title + ' ' + item.content).toLowerCase()
    return content.includes(stockName) || content.includes(stockCode)
  }

  /**
   * 判断是否为负面消息
   */
  isNegativeNews(item) {
    const negativeKeywords = [
      '负面', '问题', '风险', '危机', '亏损', '下滑', '违规', '处罚', 
      '调查', '诉讼', '纠纷', '争议', '停牌', '退市', '警示', '减持',
      '业绩下滑', '财务危机', '债务危机', '经营困难', '监管处罚'
    ]
    
    const content = (item.title + ' ' + item.content).toLowerCase()
    return negativeKeywords.some(keyword => content.includes(keyword))
  }

  /**
   * 提取负面关键词
   */
  extractNegativeKeywords(content) {
    const negativeKeywords = [
      '负面', '问题', '风险', '危机', '亏损', '下滑', '违规', '处罚', 
      '调查', '诉讼', '纠纷', '争议', '停牌', '退市', '警示', '减持'
    ]
    
    return negativeKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    )
  }

  /**
   * 生成摘要
   */
  generateSummary(negativeNews) {
    if (!negativeNews || negativeNews.length === 0) {
      return '未发现明显负面消息'
    }

    const totalNews = negativeNews.length
    const majorKeywords = {}
    
    negativeNews.forEach(news => {
      if (news.negativeKeywords) {
        news.negativeKeywords.forEach(keyword => {
          majorKeywords[keyword] = (majorKeywords[keyword] || 0) + 1
        })
      }
    })

    const topKeywords = Object.entries(majorKeywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([keyword]) => keyword)

    return `发现 ${totalNews} 条负面消息，主要涉及：${topKeywords.join('、')}`
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear()
    console.log('负面消息搜索缓存已清除')
  }


  /**
   * 加载配置
   */
  loadConfig() {
    // 直接返回默认配置，不从localStorage读取
    return {
      moonshotApiKey: 'sk-hvcN0sJH0SHc1LdJmrbpkBlSokVy0GwuPLA8BdLUBtJH5FGq',
      enableMoonshotSearch: true,
      searchTimeout: 30000 // 30秒超时
    }
  }

  /**
   * 获取 Moonshot API Key（脱敏显示）
   */
  getMoonshotApiKey(masked = true) {
    const apiKey = this.config.moonshotApiKey || ''
    if (masked && apiKey.length > 8) {
      return apiKey.substring(0, 8) + '***'
    }
    return apiKey
  }

  /**
   * 测试 Moonshot API 连接
   */
  async testMoonshotConnection() {
    try {
      const apiKey = this.config.moonshotApiKey
      
      if (!apiKey) {
        throw new Error('API Key 未配置')
      }

      const response = await fetch('https://api.moonshot.cn/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Moonshot API 连接测试成功:', data)
        return { success: true, message: 'API 连接正常' }
      } else {
        throw new Error(`API 响应错误: ${response.status}`)
      }
    } catch (error) {
      console.error('Moonshot API 连接测试失败:', error)
      return { success: false, message: error.message }
    }
  }

}

// 创建全局实例
export const webSearchService = new WebSearch()

// 默认导出
export default webSearchService