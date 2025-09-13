import { sendLLMMessage } from '../../../services/llmService.js'
import { fetchHistoryData, isTradingDay } from '../../../utils/quoteApi.js'

/**
 * 大盘分析服务
 * 专门用于处理市场整体分析和交易建议
 */

// 主要指数代码配置
const INDEX_CODES = {
  sh_index: '16:1A0001',    // 上证指数
  sz_index: '32:399001',    // 深证成指
  gem_index: '32:399006',   // 创业板指
  microcap_index: '48:883418' // 微盘股指数
}

/**
 * 获取指数K线数据
 * @param {number} days 获取天数，默认30天
 * @returns {Promise<Object>} 指数K线数据
 */
export async function getIndexKLineData(days = 30) {
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const formatDate = (date) =>
      date.toISOString().slice(0, 10).replace(/-/g, '')
    
    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)

    // 获取所有主要指数的K线数据
    const indexCodes = Object.values(INDEX_CODES)
    
    const klineData = await fetchHistoryData(
      indexCodes,
      startDateStr,
      endDateStr
    )

    return {
      success: true,
      data: klineData,
      period: `${days}天`,
      startDate: startDateStr,
      endDate: endDateStr
    }
  } catch (error) {
    console.error('获取指数K线数据失败:', error)
    return {
      success: false,
      error: error.message,
      data: null
    }
  }
}

/**
 * 分析指数K线数据，生成技术面描述
 * @param {Object} klineData K线数据
 * @returns {string} 技术面分析文本
 */
function analyzeIndexTechnical(klineData) {
  if (!klineData || !klineData.success || !klineData.data) {
    return '指数K线数据获取失败，无法进行技术分析'
  }

  let analysis = []
  
  try {
    // 这里可以添加更复杂的技术分析逻辑
    // 目前先返回基础信息
    const period = klineData.period || '30天'
    analysis.push(`基于${period}K线数据的技术分析：`)
    
    // 可以根据K线数据分析趋势、支撑阻力等
    // 暂时返回数据获取成功的提示
    analysis.push('- 成功获取指数历史数据')
    analysis.push('- 可进行趋势分析和技术指标计算')
    
  } catch (error) {
    analysis.push('技术分析处理异常')
  }

  return analysis.join('\n')
}

/**
 * 基础规则分析 - 根据市场数据生成基础建议
 * @param {Object} marketStats 市场统计数据
 * @returns {Array} 基础建议数组
 */
export function generateBasicSuggestions(marketStats) {
  const suggestions = []
  const { rising = 0, falling = 0, limit_up = 0, limit_down = 0, sh_index = {} } = marketStats
  
  // 买入建议
  if (falling > 4000) {
    suggestions.push({
      type: 'warning',
      icon: '🚫',
      action: '今日禁止买入操作',
      reason: `下跌家数${falling}家，市场恐慌`
    })
  } else if (limit_up > 100 && falling < 2000) {
    suggestions.push({
      type: 'success',
      icon: '✅',
      action: '可适当买入',
      reason: `涨停${limit_up}家，市场活跃`
    })
  } else if (falling > rising * 1.5) {
    suggestions.push({
      type: 'warning', 
      icon: '⚠️',
      action: '谨慎买入',
      reason: `下跌家数占优，观望为主`
    })
  }
  
  // 卖出建议
  if (sh_index.change_percent && sh_index.change_percent < -2) {
    suggestions.push({
      type: 'info',
      icon: '📈',
      action: '可考虑减仓',
      reason: `大盘跌幅${Math.abs(sh_index.change_percent).toFixed(2)}%，逢高减持`
    })
  } else if (limit_down > 30) {
    suggestions.push({
      type: 'warning',
      icon: '🔴',
      action: '建议止损',
      reason: `跌停${limit_down}家，及时止损`
    })
  }
  
  // 仓位建议
  if (falling > 4000) {
    suggestions.push({
      type: 'info',
      icon: '💰',
      action: '保持现金仓位',
      reason: '市场恐慌时段，现金为王'
    })
  }
  
  return suggestions
}

/**
 * 计算市场状态
 * @param {Object} marketStats 市场统计数据
 * @returns {Object} 市场状态信息
 */
export function calculateMarketStatus(marketStats) {
  const { rising = 0, falling = 0 } = marketStats
  const total = rising + falling
  
  if (total === 0) {
    return {
      text: '数据加载中',
      type: 'info'
    }
  }
  
  const risingRatio = rising / total
  
  if (risingRatio > 0.6) {
    return {
      text: '强势上涨',
      type: 'success'
    }
  }
  
  if (risingRatio > 0.4) {
    return {
      text: '震荡整理',
      type: 'warning'
    }
  }
  
  return {
    text: '弱势下跌',
    type: 'danger'
  }
}

/**
 * 计算风险等级
 * @param {Object} marketStats 市场统计数据
 * @returns {Object} 风险等级信息
 */
export function calculateRiskLevel(marketStats) {
  const { falling = 0, limit_down = 0, sh_index = {} } = marketStats
  
  if (falling > 4000 || limit_down > 50 || (sh_index.change_percent && sh_index.change_percent < -3)) {
    return {
      text: '高风险',
      type: 'danger'
    }
  }
  
  if (falling > 2500 || limit_down > 20 || (sh_index.change_percent && sh_index.change_percent < -1.5)) {
    return {
      text: '中风险',
      type: 'warning'
    }
  }
  
  return {
    text: '低风险',
    type: 'success'
  }
}

/**
 * 构建AI分析的Prompt
 * @param {Object} marketStats 市场统计数据
 * @param {Array} positionData 持仓数据（大盘分析时不使用）
 * @param {Array} monitorStocks 监控股票数据
 * @param {Object} currentPrices 当前股价数据
 * @param {Object} indexKLineData 指数K线数据（可选）
 * @returns {string} 构建好的prompt
 */
export function buildMarketAnalysisPrompt(marketStats, positionData, monitorStocks, currentPrices, indexKLineData = null) {
  const { sh_index = {}, sz_index = {}, gem_index = {}, limit_up = 0, limit_down = 0, rising = 0, falling = 0 } = marketStats
  
  let prompt = `请分析当前A股市场整体情况并给出交易建议：

## 市场概况数据
- 上证指数: ${sh_index.price} (${sh_index.change_percent}%)
- 深证成指: ${sz_index.price} (${sz_index.change_percent}%)
- 创业板指: ${gem_index.price} (${gem_index.change_percent}%)
- 涨停家数: ${limit_up}
- 跌停家数: ${limit_down}
- 上涨家数: ${rising}
- 下跌家数: ${falling}
`

  // 添加K线技术分析数据
  if (indexKLineData) {
    const technicalAnalysis = analyzeIndexTechnical(indexKLineData)
    prompt += `\n## 技术分析数据\n${technicalAnalysis}\n`
  }

  // 只添加关注股票作为参考
  if (monitorStocks.length > 0) {
    prompt += '\n## 市场热点股票参考\n'
    monitorStocks.forEach(stock => {
      prompt += `- ${stock.name}(${stock.code}): ${stock.price} (${stock.changePercent}%)\n`
    })
  }
  
  prompt += `
请基于以上数据进行大盘分析：
1. 当前市场整体状况和趋势判断
2. 市场情绪和资金流向分析
3. 今日/明日操作策略建议（买入时机、卖出时机、观望策略）
4. 重点关注的板块和个股方向
5. 风险提示和注意事项

请用简洁明了的语言回答，重点突出市场分析和可执行的操作建议。
`
  
  return prompt
}

/**
 * 执行AI市场分析
 * @param {Object} marketStats 市场统计数据
 * @param {Array} positionData 持仓数据
 * @param {Array} monitorStocks 监控股票数据
 * @param {Object} currentPrices 当前股价数据
 * @returns {Promise<Object>} 分析结果
 */
export async function performAIMarketAnalysis(marketStats, positionData, monitorStocks, currentPrices) {
  try {
    // 先获取指数K线数据
    const indexKLineData = await getIndexKLineData(30) // 获取30天K线数据
    
    const prompt = buildMarketAnalysisPrompt(marketStats, positionData, monitorStocks, currentPrices, indexKLineData)
    
    // 构建消息
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的股票市场分析师，请根据提供的市场数据进行分析并给出具体的操作建议。回答要简洁明了，重点突出可执行的操作建议。'
      },
      {
        role: 'user', 
        content: prompt
      }
    ]
    
    // 调用LLM API
    const result = await sendLLMMessage(messages, { temperature: 0.7 })
    
    if (result && result.content) {
      return {
        success: true,
        analysis: result.content,
        timestamp: new Date().toISOString(),
        usage: result.usage,
        model: result.model,
        provider: result.provider
      }
    } else {
      throw new Error('AI分析返回结果为空')
    }
  } catch (error) {
    console.error('AI市场分析失败:', error)
    return {
      success: false,
      error: error.message || 'AI分析失败'
    }
  }
}

/**
 * 生成市场摘要信息
 * @param {Object} marketStats 市场统计数据
 * @returns {Object} 市场摘要
 */
export function generateMarketSummary(marketStats) {
  const { rising = 0, falling = 0, limit_up = 0, limit_down = 0, sh_index = {} } = marketStats
  const total = rising + falling
  
  return {
    totalStocks: total,
    risingCount: rising,
    fallingCount: falling,
    limitUpCount: limit_up,
    limitDownCount: limit_down,
    risingRatio: total > 0 ? (rising / total * 100).toFixed(1) : 0,
    fallingRatio: total > 0 ? (falling / total * 100).toFixed(1) : 0,
    shIndexChange: sh_index.change_percent || 0,
    marketTrend: rising > falling ? '上涨' : falling > rising ? '下跌' : '平衡'
  }
}

