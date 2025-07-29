/**
 * 分时放量拉升买入策略信号
 * 
 * 策略逻辑：
 * 1. 检测分时图中的放量拉升形态
 * 2. 价格在短时间内快速上涨，同时成交量显著放大
 * 3. 结合均线系统确认趋势强度
 */

/**
 * 策略参数配置
 */
export const volumeBreakoutConfig = {
  // 价格拉升幅度阈值 (百分比)
  priceRiseThreshold: 2.0,
  
  // 成交量放大倍数阈值
  volumeRatioThreshold: 3.0,
  
  // 检测时间窗口 (分钟)
  timeWindow: 15,
  
  // 均线确认参数
  maShortPeriod: 5,
  maLongPeriod: 10,
  
  // 价格突破均线确认
  priceAboveMA: true,
  
  // 最小涨幅确认
  minRisePercent: 1.5,
  
  // 最大回撤限制
  maxPullbackPercent: 0.5
};

/**
 * 计算简单移动平均线
 * @param {Array} prices - 价格数组
 * @param {number} period - 周期
 * @returns {Array} 移动平均线数组
 */
function calculateMA(prices, period) {
  const ma = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ma.push(null);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / period);
    }
  }
  return ma;
}

/**
 * 计算平均成交量
 * @param {Array} volumes - 成交量数组
 * @param {number} period - 周期
 * @returns {number} 平均成交量
 */
function calculateAvgVolume(volumes, period) {
  if (volumes.length < period) return 0;
  const recentVolumes = volumes.slice(-period);
  return recentVolumes.reduce((a, b) => a + b, 0) / period;
}

/**
 * 检测分时放量拉升信号
 * @param {Object} stockData - 股票分时数据
 * @param {Object} config - 策略配置参数
 * @returns {Object} 信号结果
 */
export function detectVolumeBreakout(stockData, config = volumeBreakoutConfig) {
  if (!stockData || !stockData.minutes || stockData.minutes.length === 0) {
    return {
      hasSignal: false,
      reason: '数据不足'
    };
  }

  const { minutes } = stockData;
  const dataLength = minutes.length;
  
  // 确保数据足够
  if (dataLength < config.timeWindow + config.maLongPeriod) {
    return {
      hasSignal: false,
      reason: '数据长度不足'
    };
  }

  // 提取价格和成交量数据
  const prices = minutes.map(m => m.price);
  const volumes = minutes.map(m => m.volume);
  const times = minutes.map(m => m.time);

  // 计算移动平均线
  const maShort = calculateMA(prices, config.maShortPeriod);
  const maLong = calculateMA(prices, config.maLongPeriod);

  // 获取最新数据
  const currentPrice = prices[prices.length - 1];
  const currentVolume = volumes[volumes.length - 1];
  const currentTime = times[times.length - 1];

  // 计算时间窗口内的数据
  const windowStart = Math.max(0, dataLength - config.timeWindow);
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
  const priceChange = ((currentPrice - startPrice) / startPrice) * 100;

  // 计算平均成交量
  const avgVolume = calculateAvgVolume(volumes.slice(0, -config.timeWindow), 20);
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

  // 检查均线位置
  const currentMAShort = maShort[maShort.length - 1];
  const currentMALong = maLong[maLong.length - 1];

  // 信号条件判断
  const conditions = {
    priceRise: priceChange >= config.priceRiseThreshold,
    volumeSurge: volumeRatio >= config.volumeRatioThreshold,
    aboveMA: config.priceAboveMA ? currentPrice > currentMAShort : true,
    maBullish: currentMAShort > currentMALong,
    minRise: priceChange >= config.minRisePercent,
    maxPullback: true // TODO: 实现回撤检测
  };

  // 收集未满足的条件
  const unmetConditions = [];
  if (!conditions.priceRise) unmetConditions.push(`价格涨幅${priceChange.toFixed(2)}%未达到${config.priceRiseThreshold}%`);
  if (!conditions.volumeSurge) unmetConditions.push(`成交量放大${volumeRatio.toFixed(2)}倍未达到${config.volumeRatioThreshold}倍`);
  if (!conditions.aboveMA) unmetConditions.push('价格未站上短期均线');
  if (!conditions.maBullish) unmetConditions.push('短期均线未在长期均线之上');
  if (!conditions.minRise) unmetConditions.push(`最小涨幅${priceChange.toFixed(2)}%未达到${config.minRisePercent}%`);

  // 判断是否满足所有条件
  const hasSignal = Object.values(conditions).every(v => v === true);

  return {
    hasSignal,
    timestamp: currentTime,
    price: currentPrice,
    volume: currentVolume,
    priceChange,
    volumeRatio,
    conditions,
    reason: hasSignal ? '满足放量拉升条件' : unmetConditions.join('; '),
    strength: hasSignal ? calculateSignalStrength(priceChange, volumeRatio) : 0
  };
}

/**
 * 计算信号强度
 * @param {number} priceChange - 价格涨幅
 * @param {number} volumeRatio - 成交量放大倍数
 * @returns {number} 信号强度 (0-100)
 */
function calculateSignalStrength(priceChange, volumeRatio) {
  const priceScore = Math.min(priceChange / 5 * 50, 50); // 价格涨幅分数，最高50分
  const volumeScore = Math.min(volumeRatio / 5 * 50, 50); // 成交量分数，最高50分
  return Math.round(priceScore + volumeScore);
}

/**
 * 批量检测多只股票
 * @param {Array} stockList - 股票列表
 * @param {Object} config - 策略配置参数
 * @returns {Array} 信号结果列表
 */
export function scanVolumeBreakoutSignals(stockList, config = volumeBreakoutConfig) {
  return stockList.map(stock => {
    const signal = detectVolumeBreakout(stock, config);
    return {
      symbol: stock.symbol,
      name: stock.name,
      ...signal
    };
  }).filter(result => result.hasSignal);
}

/**
 * 获取策略描述
 * @returns {Object} 策略描述信息
 */
export function getStrategyDescription() {
  return {
    name: '分时放量拉升',
    description: '检测分时图中的放量拉升形态，当价格在短时间内快速上涨且成交量显著放大时发出买入信号',
    parameters: volumeBreakoutConfig,
    signals: [
      '价格快速拉升',
      '成交量显著放大',
      '均线多头排列',
      '趋势强度确认'
    ],
    timeframes: ['1分钟', '5分钟', '15分钟'],
    riskLevel: '中等',
    bestMarket: '牛市初期和震荡向上行情'
  };
}

// 导出默认配置
export default {
  config: volumeBreakoutConfig,
  detectVolumeBreakout,
  scanVolumeBreakoutSignals,
  getStrategyDescription
};