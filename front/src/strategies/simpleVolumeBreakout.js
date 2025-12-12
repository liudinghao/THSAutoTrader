/**
 * 简化的分时放量拉升买入策略信号
 * 降低阈值以便更容易触发
 */

/**
 * 简化策略参数配置
 */
export const simpleVolumeBreakoutConfig = {
  // 价格拉升幅度阈值 (百分比) - 降低到0.5%
  priceRiseThreshold: 0.5,
  
  // 成交量放大倍数阈值 - 降低到1.5倍
  volumeRatioThreshold: 1.5,
  
  // 检测时间窗口 (分钟) - 降低到5分钟
  timeWindow: 5,
  
  // 均线确认参数
  maShortPeriod: 3,
  maLongPeriod: 5,
  
  // 价格突破均线确认
  priceAboveMA: false, // 降低要求
  
  // 最小涨幅确认 - 降低到0.3%
  minRisePercent: 0.3,
  
  // 最大回撤限制 - 暂时忽略
  maxPullbackPercent: 1.0
};

/**
 * 检测简化版分时放量拉升信号
 * @param {Object} stockData - 股票分时数据
 * @param {Object} config - 策略配置参数
 * @returns {Object} 信号结果
 */
export function detectSimpleVolumeBreakout(stockData, config = simpleVolumeBreakoutConfig) {
  try {
    if (!stockData || !stockData.minutes || stockData.minutes.length === 0) {
      return {
        hasSignal: false,
        reason: '数据不足'
      };
    }

    const { minutes } = stockData;
    const dataLength = minutes.length;
    
    // 降低数据要求
    if (dataLength < config.timeWindow) {
      return {
        hasSignal: false,
        reason: `数据长度${dataLength}不足，需要${config.timeWindow}`
      };
    }

    // 提取价格和成交量数据
    const prices = minutes.map(m => m.price || 0).filter(p => p > 0);
    const volumes = minutes.map(m => m.volume || 0).filter(v => v > 0);
    
    if (prices.length === 0 || volumes.length === 0) {
      return {
        hasSignal: false,
        reason: '价格或成交量数据为空'
      };
    }

    // 获取最新数据
    const currentPrice = prices[prices.length - 1];
    const currentVolume = volumes[volumes.length - 1];

    // 计算时间窗口内的数据
    const windowStart = Math.max(0, prices.length - config.timeWindow);
    const windowPrices = prices.slice(windowStart);
    const windowVolumes = volumes.slice(windowStart);

    if (windowPrices.length < 2) {
      return {
        hasSignal: false,
        reason: '时间窗口数据不足'
      };
    }

    // 计算窗口内的价格变化
    const startPrice = windowPrices[0];
    const priceChange = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

    // 计算平均成交量（简化计算）
    const avgVolume = windowVolumes.slice(0, -1).reduce((a, b) => a + b, 0) / Math.max(1, windowVolumes.length - 1);
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

    // 简化条件判断
    const conditions = {
      priceRise: priceChange >= config.priceRiseThreshold,
      volumeSurge: volumeRatio >= config.volumeRatioThreshold,
      minRise: priceChange >= config.minRisePercent
    };

    // 判断是否满足主要条件
    const hasSignal = conditions.priceRise && conditions.volumeSurge;

    // 收集未满足的条件
    const unmetConditions = [];
    if (!conditions.priceRise) unmetConditions.push(`价格涨幅${priceChange.toFixed(2)}%未达到${config.priceRiseThreshold}%`);
    if (!conditions.volumeSurge) unmetConditions.push(`成交量放大${volumeRatio.toFixed(2)}倍未达到${config.volumeRatioThreshold}倍`);

    return {
      hasSignal,
      timestamp: minutes[minutes.length - 1]?.time || new Date().toISOString(),
      price: currentPrice,
      volume: currentVolume,
      priceChange,
      volumeRatio,
      conditions,
      reason: hasSignal ? '满足简化放量拉升条件' : unmetConditions.join('; '),
      strength: hasSignal ? Math.round(Math.min(priceChange * 10, 50) + Math.min(volumeRatio * 10, 50)) : 0
    };
  } catch (error) {
    console.error('检测买入信号时出错:', error);
    return {
      hasSignal: false,
      reason: '检测过程中发生错误'
    };
  }
}

/**
 * 批量检测多只股票（简化版）
 * @param {Array} stockList - 股票列表
 * @param {Object} config - 策略配置参数
 * @returns {Array} 信号结果列表
 */
export function scanSimpleVolumeBreakoutSignals(stockList, config = simpleVolumeBreakoutConfig) {
  if (!stockList || stockList.length === 0) return [];
  
  return stockList
    .map(stock => {
      const signal = detectSimpleVolumeBreakout(stock, config);
      return {
        symbol: stock.symbol,
        name: stock.name,
        ...signal
      };
    })
    .filter(result => result.hasSignal);
}

/**
 * 获取简化策略描述
 * @returns {Object} 策略描述信息
 */
export function getSimpleStrategyDescription() {
  return {
    name: '简化分时放量拉升',
    description: '检测分时图中的放量拉升形态，降低阈值以便更容易触发信号',
    parameters: simpleVolumeBreakoutConfig,
    signals: [
      '价格小幅拉升',
      '成交量放大',
      '简化条件检测'
    ],
    timeframes: ['1分钟', '5分钟'],
    riskLevel: '低',
    bestMarket: '活跃交易时段'
  };
}