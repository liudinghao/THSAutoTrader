/**
 * 风险管理服务
 * 负责仓位控制、止损止盈、资金管理等风险控制功能
 */

// 风险等级
export const RISK_LEVELS = {
  CONSERVATIVE: 'conservative',  // 保守
  BALANCED: 'balanced',         // 平衡  
  AGGRESSIVE: 'aggressive'      // 激进
}

// 止损类型
export const STOP_LOSS_TYPES = {
  FIXED_PERCENT: 'fixed_percent',    // 固定比例
  FIXED_AMOUNT: 'fixed_amount',      // 固定金额
  TRAILING: 'trailing',              // 跟踪止损
  TECHNICAL: 'technical'             // 技术止损
}

/**
 * 风险管理器类
 */
export class RiskManager {
  constructor(options = {}) {
    // 风险配置
    this.config = {
      riskLevel: options.riskLevel || RISK_LEVELS.BALANCED,
      maxPositionSize: options.maxPositionSize || 0.2,      // 单只股票最大仓位
      maxTotalRisk: options.maxTotalRisk || 0.8,           // 最大总风险敞口
      stopLossPercent: options.stopLossPercent || 0.08,    // 默认止损比例
      takeProfitPercent: options.takeProfitPercent || 0.15, // 默认止盈比例
      maxDailyLoss: options.maxDailyLoss || 0.05,          // 最大日亏损
      emergencyStopLoss: options.emergencyStopLoss || 0.15  // 紧急止损
    }
    
    // 持仓风险跟踪
    this.positionRisks = new Map()
    this.dailyPnL = 0
    this.alertHistory = []
  }

  /**
   * 验证订单是否符合风险管理要求
   * @param {Object} order - 订单信息
   * @param {Object} portfolio - 投资组合信息
   * @param {number} availableFunds - 可用资金
   * @returns {Object} 验证结果
   */
  validateOrder(order, portfolio, availableFunds) {
    const validation = {
      valid: true,
      warnings: [],
      errors: [],
      suggestedSize: order.quantity,
      riskScore: 0
    }

    try {
      // 1. 检查可用资金
      const orderValue = order.quantity * order.price
      if (orderValue > availableFunds) {
        validation.valid = false
        validation.errors.push(`资金不足: 需要${orderValue.toFixed(2)}元，可用${availableFunds.toFixed(2)}元`)
      }

      // 2. 检查单只股票仓位限制
      const currentPosition = this.getCurrentPosition(order.stockCode, portfolio)
      const newPositionValue = (currentPosition?.marketValue || 0) + orderValue
      const portfolioValue = this.getPortfolioValue(portfolio)
      const newPositionRatio = newPositionValue / portfolioValue

      if (newPositionRatio > this.config.maxPositionSize) {
        validation.valid = false
        validation.errors.push(
          `超过单只股票最大仓位限制: ${(newPositionRatio * 100).toFixed(1)}% > ${(this.config.maxPositionSize * 100).toFixed(1)}%`
        )
        // 建议调整仓位
        validation.suggestedSize = Math.floor(
          (portfolioValue * this.config.maxPositionSize - (currentPosition?.marketValue || 0)) / order.price
        )
      }

      // 3. 检查总风险敞口
      const totalRiskExposure = this.calculateTotalRiskExposure(portfolio, order)
      if (totalRiskExposure > this.config.maxTotalRisk) {
        validation.warnings.push(`总风险敞口较高: ${(totalRiskExposure * 100).toFixed(1)}%`)
        validation.riskScore += 2
      }

      // 4. 检查日亏损限制
      if (Math.abs(this.dailyPnL) / portfolioValue > this.config.maxDailyLoss) {
        validation.valid = false
        validation.errors.push(`已达到日最大亏损限制: ${(Math.abs(this.dailyPnL) / portfolioValue * 100).toFixed(1)}%`)
      }

      // 5. 根据风险等级评估
      const riskAdjustment = this.assessOrderRiskByLevel(order, validation.riskScore)
      validation.warnings.push(...riskAdjustment.warnings)
      validation.riskScore += riskAdjustment.score

      return validation
    } catch (error) {
      console.error('订单验证失败:', error)
      return {
        valid: false,
        errors: [`验证过程异常: ${error.message}`],
        warnings: [],
        suggestedSize: 0,
        riskScore: 10
      }
    }
  }

  /**
   * 计算建议的仓位大小
   * @param {string} stockCode - 股票代码
   * @param {number} price - 股票价格
   * @param {Object} portfolio - 投资组合
   * @param {number} availableFunds - 可用资金
   * @param {number} confidence - 信号置信度
   * @returns {Object} 仓位建议
   */
  calculatePositionSize(stockCode, price, portfolio, availableFunds, confidence = 0.5) {
    try {
      const portfolioValue = this.getPortfolioValue(portfolio)
      const basePositionSize = portfolioValue * this.getBasePositionRatio()
      
      // 根据置信度调整
      const confidenceAdjustment = this.getConfidenceAdjustment(confidence)
      const adjustedPositionSize = basePositionSize * confidenceAdjustment
      
      // 考虑现有仓位
      const currentPosition = this.getCurrentPosition(stockCode, portfolio)
      const maxAllowedPosition = portfolioValue * this.config.maxPositionSize
      const availablePositionSize = maxAllowedPosition - (currentPosition?.marketValue || 0)
      
      // 取最小值
      const finalPositionSize = Math.min(
        adjustedPositionSize,
        availablePositionSize,
        availableFunds * 0.9 // 保留10%缓冲
      )
      
      const quantity = Math.floor(finalPositionSize / price)
      
      return {
        quantity: Math.max(0, quantity),
        value: quantity * price,
        positionRatio: (quantity * price) / portfolioValue,
        confidenceUsed: confidence,
        adjustment: confidenceAdjustment,
        riskLevel: this.assessPositionRisk(quantity * price, portfolioValue)
      }
    } catch (error) {
      console.error('计算仓位大小失败:', error)
      return {
        quantity: 0,
        value: 0,
        positionRatio: 0,
        error: error.message
      }
    }
  }

  /**
   * 检查止损条件
   * @param {Array} positions - 持仓列表
   * @param {Object} currentPrices - 当前价格
   * @returns {Array} 需要止损的持仓
   */
  checkStopLoss(positions, currentPrices) {
    const stopLossAlerts = []
    
    try {
      positions.forEach(position => {
        const stockCode = position.证券代码 || position.stockCode
        const costPrice = parseFloat(position.成本价 || position.costPrice || 0)
        const currentPrice = parseFloat(currentPrices[stockCode]?.NEW || position.市价 || position.currentPrice || 0)
        const quantity = parseInt(position.实际数量 || position.quantity || 0)
        
        if (costPrice > 0 && currentPrice > 0) {
          const lossPercent = (costPrice - currentPrice) / costPrice
          
          // 检查不同类型的止损
          const stopLossChecks = this.performStopLossChecks(
            stockCode, 
            costPrice, 
            currentPrice, 
            quantity, 
            lossPercent
          )
          
          if (stopLossChecks.length > 0) {
            stopLossAlerts.push({
              stockCode,
              stockName: position.证券名称 || position.stockName || stockCode,
              costPrice,
              currentPrice,
              quantity,
              lossPercent: (lossPercent * 100).toFixed(2),
              lossAmount: (costPrice - currentPrice) * quantity,
              alerts: stopLossChecks,
              timestamp: new Date().toISOString()
            })
          }
        }
      })
      
      return stopLossAlerts
    } catch (error) {
      console.error('检查止损失败:', error)
      return []
    }
  }

  /**
   * 执行止损检查
   * @param {string} stockCode - 股票代码
   * @param {number} costPrice - 成本价
   * @param {number} currentPrice - 当前价
   * @param {number} quantity - 数量
   * @param {number} lossPercent - 亏损比例
   * @returns {Array} 止损警告
   */
  performStopLossChecks(stockCode, costPrice, currentPrice, quantity, lossPercent) {
    const alerts = []
    
    // 1. 固定比例止损
    if (lossPercent > this.config.stopLossPercent) {
      alerts.push({
        type: STOP_LOSS_TYPES.FIXED_PERCENT,
        severity: 'high',
        message: `亏损${(lossPercent * 100).toFixed(2)}%，超过止损线${(this.config.stopLossPercent * 100).toFixed(2)}%`,
        action: 'sell',
        urgency: lossPercent > this.config.emergencyStopLoss ? 'emergency' : 'normal'
      })
    }
    
    // 2. 紧急止损
    if (lossPercent > this.config.emergencyStopLoss) {
      alerts.push({
        type: STOP_LOSS_TYPES.FIXED_PERCENT,
        severity: 'critical',
        message: `紧急止损：亏损${(lossPercent * 100).toFixed(2)}%`,
        action: 'emergency_sell',
        urgency: 'emergency'
      })
    }
    
    // 3. 跟踪止损（如果有设置）
    const trailingStopAlert = this.checkTrailingStop(stockCode, currentPrice)
    if (trailingStopAlert) {
      alerts.push(trailingStopAlert)
    }
    
    return alerts
  }

  /**
   * 检查跟踪止损
   * @param {string} stockCode - 股票代码
   * @param {number} currentPrice - 当前价格
   * @returns {Object|null} 跟踪止损警告
   */
  checkTrailingStop(stockCode, currentPrice) {
    const positionRisk = this.positionRisks.get(stockCode)
    if (!positionRisk || !positionRisk.trailingStop) {
      return null
    }
    
    // 更新最高价
    if (currentPrice > positionRisk.highestPrice) {
      positionRisk.highestPrice = currentPrice
      positionRisk.trailingStopPrice = currentPrice * (1 - positionRisk.trailingPercent)
    }
    
    // 检查是否触发跟踪止损
    if (currentPrice < positionRisk.trailingStopPrice) {
      return {
        type: STOP_LOSS_TYPES.TRAILING,
        severity: 'high',
        message: `跟踪止损触发：当前价${currentPrice}低于止损价${positionRisk.trailingStopPrice.toFixed(2)}`,
        action: 'sell',
        urgency: 'normal'
      }
    }
    
    return null
  }

  /**
   * 设置跟踪止损
   * @param {string} stockCode - 股票代码
   * @param {number} currentPrice - 当前价格
   * @param {number} trailingPercent - 跟踪止损比例
   */
  setTrailingStop(stockCode, currentPrice, trailingPercent = 0.05) {
    this.positionRisks.set(stockCode, {
      ...this.positionRisks.get(stockCode),
      trailingStop: true,
      trailingPercent,
      highestPrice: currentPrice,
      trailingStopPrice: currentPrice * (1 - trailingPercent),
      createdAt: new Date().toISOString()
    })
  }

  /**
   * 检查止盈条件
   * @param {Array} positions - 持仓列表
   * @param {Object} currentPrices - 当前价格
   * @returns {Array} 止盈建议
   */
  checkTakeProfit(positions, currentPrices) {
    const takeProfitAlerts = []
    
    try {
      positions.forEach(position => {
        const stockCode = position.证券代码 || position.stockCode
        const costPrice = parseFloat(position.成本价 || position.costPrice || 0)
        const currentPrice = parseFloat(currentPrices[stockCode]?.NEW || position.市价 || position.currentPrice || 0)
        const quantity = parseInt(position.实际数量 || position.quantity || 0)
        
        if (costPrice > 0 && currentPrice > 0) {
          const profitPercent = (currentPrice - costPrice) / costPrice
          
          if (profitPercent > this.config.takeProfitPercent) {
            takeProfitAlerts.push({
              stockCode,
              stockName: position.证券名称 || position.stockName || stockCode,
              costPrice,
              currentPrice,
              quantity,
              profitPercent: (profitPercent * 100).toFixed(2),
              profitAmount: (currentPrice - costPrice) * quantity,
              message: `盈利${(profitPercent * 100).toFixed(2)}%，考虑止盈`,
              timestamp: new Date().toISOString()
            })
          }
        }
      })
      
      return takeProfitAlerts
    } catch (error) {
      console.error('检查止盈失败:', error)
      return []
    }
  }

  /**
   * 更新每日盈亏
   * @param {number} pnl - 当日盈亏
   */
  updateDailyPnL(pnl) {
    this.dailyPnL = pnl
  }

  /**
   * 获取风险报告
   * @param {Object} portfolio - 投资组合
   * @returns {Object} 风险报告
   */
  getRiskReport(portfolio) {
    try {
      const portfolioValue = this.getPortfolioValue(portfolio)
      const positions = Array.isArray(portfolio) ? portfolio : Object.values(portfolio)
      
      return {
        portfolioValue,
        totalRisk: this.calculateTotalRiskExposure(portfolio),
        dailyPnLPercent: (this.dailyPnL / portfolioValue * 100).toFixed(2),
        positionCount: positions.length,
        largestPosition: this.findLargestPosition(positions),
        riskLevel: this.assessOverallRisk(portfolio),
        recommendations: this.generateRiskRecommendations(portfolio),
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('生成风险报告失败:', error)
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }

  // 私有辅助方法
  getCurrentPosition(stockCode, portfolio) {
    const positions = Array.isArray(portfolio) ? portfolio : Object.values(portfolio)
    return positions.find(p => (p.证券代码 || p.stockCode) === stockCode)
  }

  getPortfolioValue(portfolio) {
    if (!portfolio) return 0
    
    const positions = Array.isArray(portfolio) ? portfolio : Object.values(portfolio)
    return positions.reduce((total, position) => {
      const marketValue = parseFloat(position.市值 || position.marketValue || 0)
      return total + marketValue
    }, 0)
  }

  getBasePositionRatio() {
    const ratios = {
      [RISK_LEVELS.CONSERVATIVE]: 0.05,
      [RISK_LEVELS.BALANCED]: 0.1,
      [RISK_LEVELS.AGGRESSIVE]: 0.15
    }
    return ratios[this.config.riskLevel] || 0.1
  }

  getConfidenceAdjustment(confidence) {
    // 根据信号置信度调整仓位大小
    if (confidence >= 0.8) return 1.2
    if (confidence >= 0.6) return 1.0
    if (confidence >= 0.4) return 0.8
    return 0.6
  }

  calculateTotalRiskExposure(portfolio, newOrder = null) {
    const portfolioValue = this.getPortfolioValue(portfolio)
    let totalExposure = portfolioValue
    
    if (newOrder) {
      totalExposure += newOrder.quantity * newOrder.price
    }
    
    return Math.min(totalExposure / portfolioValue, 1)
  }

  assessOrderRiskByLevel(order, currentRiskScore) {
    const warnings = []
    let score = currentRiskScore
    
    // 根据风险等级给出不同的建议
    if (this.config.riskLevel === RISK_LEVELS.CONSERVATIVE && currentRiskScore > 3) {
      warnings.push('当前风险等级为保守，建议降低仓位')
      score += 1
    } else if (this.config.riskLevel === RISK_LEVELS.AGGRESSIVE && currentRiskScore < 2) {
      warnings.push('当前风险等级为激进，可以考虑增加仓位')
      score -= 0.5
    }
    
    return { warnings, score }
  }

  assessPositionRisk(positionValue, portfolioValue) {
    const ratio = positionValue / portfolioValue
    if (ratio > 0.15) return 'high'
    if (ratio > 0.1) return 'medium'
    return 'low'
  }

  findLargestPosition(positions) {
    return positions.reduce((largest, current) => {
      const currentValue = parseFloat(current.市值 || current.marketValue || 0)
      const largestValue = parseFloat(largest?.市值 || largest?.marketValue || 0)
      return currentValue > largestValue ? current : largest
    }, positions[0])
  }

  assessOverallRisk(portfolio) {
    const riskScore = this.calculateTotalRiskExposure(portfolio)
    if (riskScore > 0.8) return 'high'
    if (riskScore > 0.6) return 'medium'
    return 'low'
  }

  generateRiskRecommendations(portfolio) {
    const recommendations = []
    const totalRisk = this.calculateTotalRiskExposure(portfolio)
    
    if (totalRisk > 0.8) {
      recommendations.push('总风险敞口过高，建议减仓')
    }
    
    if (Math.abs(this.dailyPnL / this.getPortfolioValue(portfolio)) > this.config.maxDailyLoss * 0.8) {
      recommendations.push('接近日最大亏损限制，请谨慎操作')
    }
    
    return recommendations
  }
}

// 创建默认实例
export const defaultRiskManager = new RiskManager()

// 工具函数
export const formatRiskLevel = (level) => {
  const texts = {
    [RISK_LEVELS.CONSERVATIVE]: '保守',
    [RISK_LEVELS.BALANCED]: '平衡',
    [RISK_LEVELS.AGGRESSIVE]: '激进'
  }
  return texts[level] || '未知'
}

export const getRiskColor = (level) => {
  const colors = {
    low: '#67c23a',
    medium: '#e6a23c',
    high: '#f56c6c'
  }
  return colors[level] || '#909399'
}