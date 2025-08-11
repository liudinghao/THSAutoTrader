/**
 * 五天分时数据买入卖出策略分析
 * 基于最近五个交易日的分时数据进行买卖信号计算
 */

import { analyzeBuyPoints } from './volumeBreakoutBuyOptimized';
import { analyzeSellPoints } from './sellPointAnalysis';

/**
 * 分析五天分时数据的买入信号
 * @param {Array} fiveDayData - 五天分时数据数组，格式：[{date: '20250725', data: {...}}, ...]
 * @param {Object} stockInfo - 股票信息对象
 * @returns {Object} 五天买入信号分析结果
 */
export function analyzeFiveDayBuySignals(fiveDayData, stockInfo = {}) {
  const buyPoints = [];
  const summary = {
    riskLevel: 'low',
    buySignals: 0,
    recommendations: [],
    dailySignals: [],
    patternAnalysis: {}
  };

  if (!fiveDayData || !Array.isArray(fiveDayData) || fiveDayData.length === 0) {
    summary.recommendations.push('五天分时数据为空，无法进行分析');
    return { buyPoints, summary };
  }

  // 分析每一天的买入信号
  const dailySignals = [];
  let totalSignals = 0;

  fiveDayData.forEach((dayData, index) => {
    const { buyPoints: dayBuyPoints, summary: daySummary } = analyzeBuyPoints(
      dayData.data || {},
      stockInfo
    );

    dailySignals.push({
      date: dayData.date,
      buyPoints: dayBuyPoints,
      signalCount: daySummary.buySignals,
      riskLevel: daySummary.riskLevel,
      recommendations: daySummary.recommendations
    });

    totalSignals += daySummary.buySignals;
  });

  // 五天模式分析
  const patternAnalysis = analyzeFiveDayPatterns(dailySignals);

  // 生成五天综合分析
  const comprehensiveAnalysis = generateFiveDayRecommendations(dailySignals, patternAnalysis);

  summary.dailySignals = dailySignals;
  summary.patternAnalysis = patternAnalysis;
  summary.buySignals = totalSignals;
  summary.riskLevel = comprehensiveAnalysis.riskLevel;
  summary.recommendations = comprehensiveAnalysis.recommendations;

  // 合并所有买入点，按时间和信号强度排序
  buyPoints.push(...mergeBuyPointsFromFiveDays(dailySignals));

  return { buyPoints, summary };
}

/**
 * 分析五天分时数据的卖出信号
 * @param {Array} fiveDayData - 五天分时数据数组
 * @param {Object} stockInfo - 股票信息对象
 * @returns {Object} 五天卖出信号分析结果
 */
export function analyzeFiveDaySellSignals(fiveDayData, stockInfo = {}) {
  const sellPoints = [];
  const summary = {
    riskLevel: 'low',
    sellSignals: 0,
    recommendations: [],
    dailySignals: [],
    patternAnalysis: {}
  };

  if (!fiveDayData || !Array.isArray(fiveDayData) || fiveDayData.length === 0) {
    summary.recommendations.push('五天分时数据为空，无法进行分析');
    return { sellPoints, summary };
  }

  // 分析每一天的卖出信号
  const dailySignals = [];
  let totalSignals = 0;

  fiveDayData.forEach((dayData, index) => {
    const { sellPoints: daySellPoints, summary: daySummary } = analyzeSellPoints(
      dayData.data || {},
      stockInfo
    );

    dailySignals.push({
      date: dayData.date,
      sellPoints: daySellPoints,
      signalCount: daySummary.sellSignals,
      riskLevel: daySummary.riskLevel,
      recommendations: daySummary.recommendations
    });

    totalSignals += daySummary.sellSignals;
  });

  // 五天模式分析
  const patternAnalysis = analyzeFiveDaySellPatterns(dailySignals);

  // 生成五天综合分析
  const comprehensiveAnalysis = generateFiveDaySellRecommendations(dailySignals, patternAnalysis);

  summary.dailySignals = dailySignals;
  summary.patternAnalysis = patternAnalysis;
  summary.sellSignals = totalSignals;
  summary.riskLevel = comprehensiveAnalysis.riskLevel;
  summary.recommendations = comprehensiveAnalysis.recommendations;

  // 合并所有卖出点
  sellPoints.push(...mergeSellPointsFromFiveDays(dailySignals));

  return { sellPoints, summary };
}

/**
 * 分析五天买入模式
 * @param {Array} dailySignals - 每日信号数据
 * @returns {Object} 模式分析结果
 */
function analyzeFiveDayPatterns(dailySignals) {
  const patterns = {
    consecutiveSignals: 0,
    signalFrequency: 0,
    trendStrength: 'neutral',
    volumeConsistency: 'medium',
    bestEntryDay: null,
    riskDistribution: []
  };

  // 计算连续信号天数
  let consecutiveDays = 0;
  let maxConsecutive = 0;
  
  dailySignals.forEach(signal => {
    if (signal.signalCount > 0) {
      consecutiveDays++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
    } else {
      consecutiveDays = 0;
    }
  });
  
  patterns.consecutiveSignals = maxConsecutive;

  // 计算信号频率
  const daysWithSignals = dailySignals.filter(s => s.signalCount > 0).length;
  patterns.signalFrequency = daysWithSignals / dailySignals.length;

  // 分析趋势强度
  const recentSignals = dailySignals.slice(-3).filter(s => s.signalCount > 0).length;
  if (recentSignals >= 2) {
    patterns.trendStrength = 'strong';
  } else if (recentSignals === 1) {
    patterns.trendStrength = 'moderate';
  } else {
    patterns.trendStrength = 'weak';
  }

  // 确定最佳入场日
  const signalCounts = dailySignals.map(s => s.signalCount);
  const maxSignalDayIndex = signalCounts.indexOf(Math.max(...signalCounts));
  if (maxSignalDayIndex >= 0) {
    patterns.bestEntryDay = dailySignals[maxSignalDayIndex].date;
  }

  return patterns;
}

/**
 * 分析五天卖出模式
 * @param {Array} dailySignals - 每日信号数据
 * @returns {Object} 模式分析结果
 */
function analyzeFiveDaySellPatterns(dailySignals) {
  const patterns = {
    consecutiveSellSignals: 0,
    sellFrequency: 0,
    dangerLevel: 'low',
    patternType: 'normal',
    urgentSellDay: null
  };

  // 计算连续卖出信号天数
  let consecutiveDays = 0;
  let maxConsecutive = 0;
  
  dailySignals.forEach(signal => {
    if (signal.signalCount > 0) {
      consecutiveDays++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
    } else {
      consecutiveDays = 0;
    }
  });
  
  patterns.consecutiveSellSignals = maxConsecutive;

  // 计算卖出信号频率
  const daysWithSellSignals = dailySignals.filter(s => s.signalCount > 0).length;
  patterns.sellFrequency = daysWithSellSignals / dailySignals.length;

  // 分析危险等级
  if (patterns.sellFrequency >= 0.8) {
    patterns.dangerLevel = 'high';
    patterns.patternType = 'continuous_sell';
  } else if (patterns.sellFrequency >= 0.6) {
    patterns.dangerLevel = 'medium';
    patterns.patternType = 'frequent_sell';
  } else if (patterns.sellFrequency >= 0.4) {
    patterns.dangerLevel = 'low';
    patterns.patternType = 'occasional_sell';
  } else {
    patterns.dangerLevel = 'minimal';
    patterns.patternType = 'normal';
  }

  // 确定紧急卖出日
  const sellSignalCounts = dailySignals.map(s => s.signalCount);
  const maxSellSignalDayIndex = sellSignalCounts.indexOf(Math.max(...sellSignalCounts));
  if (maxSellSignalDayIndex >= 0 && dailySignals[maxSellSignalDayIndex].signalCount > 0) {
    patterns.urgentSellDay = dailySignals[maxSellSignalDayIndex].date;
  }

  return patterns;
}

/**
 * 生成五天买入建议
 * @param {Array} dailySignals - 每日信号数据
 * @param {Object} patterns - 模式分析结果
 * @returns {Object} 综合建议
 */
function generateFiveDayRecommendations(dailySignals, patterns) {
  const recommendations = [];
  let riskLevel = 'low';

  // 基于模式分析生成建议
  if (patterns.consecutiveSignals >= 3) {
    recommendations.push('连续三天出现买入信号，趋势强劲，可积极跟进');
    riskLevel = 'low';
  } else if (patterns.consecutiveSignals >= 2) {
    recommendations.push('连续两天出现买入信号，趋势向好，建议参与');
    riskLevel = 'low';
  } else if (patterns.signalFrequency >= 0.6) {
    recommendations.push('近五天内有60%以上交易日出现买入信号，关注度高');
    riskLevel = 'medium';
  } else if (patterns.signalFrequency >= 0.4) {
    recommendations.push('近五天内有40%以上交易日出现买入信号，可适度关注');
    riskLevel = 'medium';
  } else {
    recommendations.push('买入信号较少，建议观望');
    riskLevel = 'high';
  }

  if (patterns.bestEntryDay) {
    recommendations.push(`最佳入场时机：${patterns.bestEntryDay}`);
  }

  if (patterns.trendStrength === 'strong') {
    recommendations.push('近期趋势强劲，可考虑加仓');
  }

  return { riskLevel, recommendations };
}

/**
 * 生成五天卖出建议
 * @param {Array} dailySignals - 每日信号数据
 * @param {Object} patterns - 模式分析结果
 * @returns {Object} 综合建议
 */
function generateFiveDaySellRecommendations(dailySignals, patterns) {
  const recommendations = [];
  let riskLevel = 'low';

  // 基于模式分析生成建议
  if (patterns.consecutiveSellSignals >= 3) {
    recommendations.push('连续三天出现卖出信号，危险级别高，建议立即减仓');
    riskLevel = 'high';
  } else if (patterns.consecutiveSellSignals >= 2) {
    recommendations.push('连续两天出现卖出信号，风险加大，建议减仓');
    riskLevel = 'high';
  } else if (patterns.sellFrequency >= 0.8) {
    recommendations.push('近五天内频繁出现卖出信号，建议清仓观望');
    riskLevel = 'high';
  } else if (patterns.sellFrequency >= 0.6) {
    recommendations.push('卖出信号较多，建议适当减仓');
    riskLevel = 'medium';
  } else if (patterns.sellFrequency >= 0.4) {
    recommendations.push('卖出信号一般，可保持观望');
    riskLevel = 'medium';
  } else {
    recommendations.push('卖出信号较少，可继续持有');
    riskLevel = 'low';
  }

  if (patterns.urgentSellDay) {
    recommendations.push(`危险信号最强日：${patterns.urgentSellDay}，可考虑减仓`);
  }

  return { riskLevel, recommendations };
}

/**
 * 合并五天的买入点
 * @param {Array} dailySignals - 每日信号数据
 * @returns {Array} 合并后的买入点
 */
function mergeBuyPointsFromFiveDays(dailySignals) {
  const allBuyPoints = [];
  
  dailySignals.forEach(daySignal => {
    daySignal.buyPoints.forEach(buyPoint => {
      allBuyPoints.push({
        ...buyPoint,
        date: String(daySignal.date), // 确保日期是字符串
        dayIndex: dailySignals.indexOf(daySignal)
      });
    });
  });

  // 按日期和时间排序
  allBuyPoints.sort((a, b) => {
    const dateA = String(a.date);
    const dateB = String(b.date);
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA); // 日期降序
    }
    return String(a.time).localeCompare(String(b.time)); // 时间升序
  });

  return allBuyPoints;
}

/**
 * 合并五天的卖出点
 * @param {Array} dailySignals - 每日信号数据
 * @returns {Array} 合并后的卖出点
 */
function mergeSellPointsFromFiveDays(dailySignals) {
  const allSellPoints = [];
  
  dailySignals.forEach(daySignal => {
    daySignal.sellPoints.forEach(sellPoint => {
      allSellPoints.push({
        ...sellPoint,
        date: String(daySignal.date), // 确保日期是字符串
        dayIndex: dailySignals.indexOf(daySignal)
      });
    });
  });

  // 按日期和时间排序
  allSellPoints.sort((a, b) => {
    const dateA = String(a.date);
    const dateB = String(b.date);
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA); // 日期降序
    }
    return String(a.time).localeCompare(String(b.time)); // 时间升序
  });

  return allSellPoints;
}

/**
 * 获取五天分析策略描述
 * @returns {Object} 策略描述信息
 */
export function getFiveDayStrategyDescription() {
  return {
    name: '五天分时数据综合分析',
    description: '基于最近五个交易日的分时数据，综合分析买入卖出信号，提供更准确的交易建议',
    signals: [
      '五天买入信号模式分析',
      '五天卖出信号模式分析',
      '趋势强度评估',
      '风险等级评定'
    ],
    timeframes: ['5天分时数据'],
    riskLevel: '中',
    bestMarket: '趋势明显的行情'
  };
}