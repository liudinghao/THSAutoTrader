/**
 * 交易决策引擎
 * 基于技术分析结果和市场数据生成交易信号
 */

import { strategyManager, STRATEGY_TYPES } from '@/strategies/index.js'

// 交易信号类型
export const SIGNAL_TYPES = {
  BUY: 'buy',
  SELL: 'sell',
  HOLD: 'hold',
  STRONG_BUY: 'strong_buy',
  STRONG_SELL: 'strong_sell'
}

// 信号强度
export const SIGNAL_STRENGTH = {
  WEAK: 1,
  MEDIUM: 2,
  STRONG: 3,
  VERY_STRONG: 4
}

/**
 * 交易决策引擎类
 */
export class TradingDecisionEngine {
  constructor(options = {}) {
    this.strategies = options.strategies || []
    this.riskLevel = options.riskLevel || 'medium'
    this.marketConditions = options.marketConditions || {}
    this.signalHistory = []
  }

  /**
   * 生成交易信号
   * @param {Object} stockData - 股票数据
   * @param {Object} analysisResult - 分析结果
   * @param {Object} marketContext - 市场环境
   * @returns {Object} 交易信号
   */
  generateTradingSignal(stockData, analysisResult, marketContext = {}) {
    try {
      const signals = []
      
      // 1. 基于技术分析结果生成信号
      if (analysisResult?.analysis) {
        const technicalSignal = this.evaluateTechnicalAnalysis(analysisResult.analysis)
        if (technicalSignal) signals.push(technicalSignal)
      }

      // 2. 基于市场环境生成信号
      const marketSignal = this.evaluateMarketConditions(marketContext)
      if (marketSignal) signals.push(marketSignal)

      // 3. 基于策略结果生成信号
      if (this.strategies.length > 0) {
        const strategySignals = this.evaluateStrategies(stockData)
        signals.push(...strategySignals)
      }

      // 4. 综合信号并计算强度
      const finalSignal = this.combineSignals(signals, stockData)
      
      // 5. 记录信号历史
      this.recordSignal(stockData.code, finalSignal)
      
      return finalSignal
    } catch (error) {
      console.error('生成交易信号失败:', error)
      return {
        type: SIGNAL_TYPES.HOLD,
        strength: SIGNAL_STRENGTH.WEAK,
        confidence: 0,
        reason: '分析异常',
        error: error.message
      }
    }
  }

  /**
   * 评估技术分析结果
   * @param {string} analysisText - 分析文本
   * @returns {Object|null} 技术分析信号
   */
  evaluateTechnicalAnalysis(analysisText) {
    if (!analysisText || typeof analysisText !== 'string') return null

    const text = analysisText.toLowerCase()
    let score = 0
    let reasons = []

    // 买入信号关键词
    const buyKeywords = [
      '建议买入', '推荐买入', '强烈推荐', '上涨空间', '突破压力',
      '量价配合', '技术面向好', '趋势向上', '支撑有效'
    ]
    
    // 卖出信号关键词
    const sellKeywords = [
      '建议卖出', '推荐减仓', '风险较大', '下跌风险', '跌破支撑',
      '量价背离', '技术面恶化', '趋势向下', '压力较强'
    ]

    // 检查买入信号
    buyKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 1
        reasons.push(keyword)
      }
    })

    // 检查卖出信号
    sellKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        score -= 1
        reasons.push(keyword)
      }
    })

    // 生成信号
    if (Math.abs(score) === 0) return null

    return {
      source: 'technical_analysis',
      type: score > 0 ? SIGNAL_TYPES.BUY : SIGNAL_TYPES.SELL,
      strength: Math.min(Math.abs(score), SIGNAL_STRENGTH.VERY_STRONG),
      reasons: reasons,
      confidence: Math.min(Math.abs(score) * 0.3, 1)
    }
  }

  /**
   * 评估市场条件
   * @param {Object} marketContext - 市场环境数据
   * @returns {Object|null} 市场信号
   */
  evaluateMarketConditions(marketContext) {
    if (!marketContext || Object.keys(marketContext).length === 0) return null

    let score = 0
    const reasons = []

    // 评估大盘指数
    const indices = ['sh_index', 'sz_index', 'gem_index']
    indices.forEach(index => {
      if (marketContext[index]) {
        const changePercent = parseFloat(marketContext[index].change_percent || 0)
        if (changePercent > 1) {
          score += 0.5
          reasons.push(`${index}上涨${changePercent}%`)
        } else if (changePercent < -1) {
          score -= 0.5
          reasons.push(`${index}下跌${Math.abs(changePercent)}%`)
        }
      }
    })

    // 评估市场情绪
    if (marketContext.rising && marketContext.falling) {
      const risingRatio = marketContext.rising / (marketContext.rising + marketContext.falling)
      if (risingRatio > 0.6) {
        score += 0.3
        reasons.push(`上涨股票占比${(risingRatio * 100).toFixed(1)}%`)
      } else if (risingRatio < 0.4) {
        score -= 0.3
        reasons.push(`下跌股票占比${((1 - risingRatio) * 100).toFixed(1)}%`)
      }
    }

    if (Math.abs(score) < 0.1) return null

    return {
      source: 'market_conditions',
      type: score > 0 ? SIGNAL_TYPES.BUY : SIGNAL_TYPES.SELL,
      strength: Math.min(Math.ceil(Math.abs(score)), SIGNAL_STRENGTH.STRONG),
      reasons: reasons,
      confidence: Math.min(Math.abs(score) * 0.5, 1)
    }
  }

  /**
   * 评估策略结果
   * @param {Object} stockData - 股票数据
   * @returns {Array} 策略信号数组
   */
  evaluateStrategies(stockData) {
    const signals = []
    
    try {
      // 执行卖出点分析策略
      if (this.strategies.includes(STRATEGY_TYPES.SELL_POINT_ANALYSIS)) {
        const result = strategyManager.executeStrategy(
          STRATEGY_TYPES.SELL_POINT_ANALYSIS,
          stockData
        )
        
        if (result && result.summary) {
          const signal = this.convertSellAnalysisToSignal(result.summary)
          if (signal) signals.push(signal)
        }
      }

      // 可以添加更多策略...
      
    } catch (error) {
      console.error('策略评估失败:', error)
    }

    return signals
  }

  /**
   * 将卖出点分析结果转换为交易信号
   * @param {Object} summary - 分析汇总
   * @returns {Object|null} 交易信号
   */
  convertSellAnalysisToSignal(summary) {
    if (!summary) return null

    const { riskLevel, sellSignals = 0, recommendations = [] } = summary

    let signalType = SIGNAL_TYPES.HOLD
    let strength = SIGNAL_STRENGTH.WEAK
    
    // 根据风险等级和卖出信号数量判断
    if (riskLevel === 'high' || sellSignals >= 3) {
      signalType = SIGNAL_TYPES.STRONG_SELL
      strength = SIGNAL_STRENGTH.VERY_STRONG
    } else if (riskLevel === 'medium' || sellSignals >= 2) {
      signalType = SIGNAL_TYPES.SELL
      strength = SIGNAL_STRENGTH.STRONG
    } else if (sellSignals >= 1) {
      signalType = SIGNAL_TYPES.SELL
      strength = SIGNAL_STRENGTH.MEDIUM
    }

    if (signalType === SIGNAL_TYPES.HOLD) return null

    return {
      source: 'sell_point_analysis',
      type: signalType,
      strength: strength,
      reasons: recommendations,
      confidence: sellSignals * 0.2
    }
  }

  /**
   * 综合多个信号
   * @param {Array} signals - 信号数组
   * @param {Object} stockData - 股票数据
   * @returns {Object} 最终信号
   */
  combineSignals(signals, stockData) {
    if (signals.length === 0) {
      return {
        type: SIGNAL_TYPES.HOLD,
        strength: SIGNAL_STRENGTH.WEAK,
        confidence: 0,
        reason: '无明确信号',
        sources: []
      }
    }

    // 计算信号权重
    let buyScore = 0
    let sellScore = 0
    const allReasons = []
    const sources = []

    signals.forEach(signal => {
      const weight = signal.strength * signal.confidence
      sources.push(signal.source)
      
      if (signal.reasons) {
        allReasons.push(...signal.reasons)
      }

      if (signal.type === SIGNAL_TYPES.BUY || signal.type === SIGNAL_TYPES.STRONG_BUY) {
        buyScore += weight * (signal.type === SIGNAL_TYPES.STRONG_BUY ? 1.5 : 1)
      } else if (signal.type === SIGNAL_TYPES.SELL || signal.type === SIGNAL_TYPES.STRONG_SELL) {
        sellScore += weight * (signal.type === SIGNAL_TYPES.STRONG_SELL ? 1.5 : 1)
      }
    })

    // 确定最终信号
    let finalType = SIGNAL_TYPES.HOLD
    let finalStrength = SIGNAL_STRENGTH.WEAK
    let confidence = 0

    if (buyScore > sellScore && buyScore > 1) {
      finalType = buyScore > 3 ? SIGNAL_TYPES.STRONG_BUY : SIGNAL_TYPES.BUY
      finalStrength = Math.min(Math.ceil(buyScore), SIGNAL_STRENGTH.VERY_STRONG)
      confidence = Math.min(buyScore / 4, 1)
    } else if (sellScore > buyScore && sellScore > 1) {
      finalType = sellScore > 3 ? SIGNAL_TYPES.STRONG_SELL : SIGNAL_TYPES.SELL
      finalStrength = Math.min(Math.ceil(sellScore), SIGNAL_STRENGTH.VERY_STRONG)
      confidence = Math.min(sellScore / 4, 1)
    }

    return {
      type: finalType,
      strength: finalStrength,
      confidence: confidence,
      reason: this.generateReasonText(finalType, allReasons),
      sources: [...new Set(sources)], // 去重
      stockCode: stockData.code,
      stockName: stockData.name,
      timestamp: new Date().toISOString(),
      buyScore,
      sellScore,
      signalCount: signals.length
    }
  }

  /**
   * 生成信号原因文本
   * @param {string} signalType - 信号类型
   * @param {Array} reasons - 原因数组
   * @returns {string} 原因描述
   */
  generateReasonText(signalType, reasons) {
    if (reasons.length === 0) {
      return '基于综合分析'
    }

    const uniqueReasons = [...new Set(reasons)]
    const reasonText = uniqueReasons.slice(0, 3).join('、')
    
    const prefix = {
      [SIGNAL_TYPES.STRONG_BUY]: '强烈推荐买入：',
      [SIGNAL_TYPES.BUY]: '建议买入：',
      [SIGNAL_TYPES.STRONG_SELL]: '强烈推荐卖出：',
      [SIGNAL_TYPES.SELL]: '建议卖出：',
      [SIGNAL_TYPES.HOLD]: '持有观望：'
    }

    return `${prefix[signalType] || ''}${reasonText}`
  }

  /**
   * 记录信号历史
   * @param {string} stockCode - 股票代码
   * @param {Object} signal - 信号对象
   */
  recordSignal(stockCode, signal) {
    this.signalHistory.push({
      stockCode,
      signal: { ...signal },
      timestamp: new Date().toISOString()
    })

    // 保留最近100条记录
    if (this.signalHistory.length > 100) {
      this.signalHistory.shift()
    }
  }

  /**
   * 获取股票的历史信号
   * @param {string} stockCode - 股票代码
   * @param {number} limit - 限制条数
   * @returns {Array} 历史信号
   */
  getSignalHistory(stockCode, limit = 10) {
    return this.signalHistory
      .filter(item => item.stockCode === stockCode)
      .slice(-limit)
  }

  /**
   * 清理历史信号
   * @param {number} daysToKeep - 保留天数
   */
  cleanHistory(daysToKeep = 7) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    this.signalHistory = this.signalHistory.filter(
      item => new Date(item.timestamp) > cutoffDate
    )
  }
}

// 创建默认实例
export const defaultDecisionEngine = new TradingDecisionEngine()

// 辅助函数
export const getSignalColor = (signalType) => {
  const colors = {
    [SIGNAL_TYPES.STRONG_BUY]: '#f56c6c',
    [SIGNAL_TYPES.BUY]: '#e6a23c', 
    [SIGNAL_TYPES.HOLD]: '#909399',
    [SIGNAL_TYPES.SELL]: '#67c23a',
    [SIGNAL_TYPES.STRONG_SELL]: '#409eff'
  }
  return colors[signalType] || '#909399'
}

export const getSignalText = (signalType) => {
  const texts = {
    [SIGNAL_TYPES.STRONG_BUY]: '强烈买入',
    [SIGNAL_TYPES.BUY]: '建议买入',
    [SIGNAL_TYPES.HOLD]: '持有观望', 
    [SIGNAL_TYPES.SELL]: '建议卖出',
    [SIGNAL_TYPES.STRONG_SELL]: '强烈卖出'
  }
  return texts[signalType] || '未知'
}