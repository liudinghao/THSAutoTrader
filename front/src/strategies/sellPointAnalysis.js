/**
 * 股票分时数据分析工具 - 卖出点检测
 * 基于量价关系逻辑：高位放量滞涨、首次回调、反弹乏力、尾盘破位
 */

// 导入时间转换工具函数
import { timestampToDateTime } from '../utils/quoteApi.js';

/**
 * 时间戳转换函数（保持向后兼容）
 * @param {number} timestamp 时间戳
 * @returns {string} 格式化的时间字符串
 */
export function timestampToTime(timestamp) {
  return timestampToDateTime(timestamp);
}

/**
 * 主分析函数 - 检测股票卖出点
 * @param {Array} stockData 股票分时数据数组
 * @returns {Object} 分析结果对象
 */
export function analyzeSellPoints(stockData) {
  const results = {
    peakVolumeStagnation: null, // 高位放量滞涨
    firstPullback: null, // 首次回调
    weakRebound: null, // 反弹乏力
    endBreakdown: null, // 尾盘破位
    summary: {
      // 综合分析
      riskLevel: 'low', // 风险等级: low, medium, high
      sellSignals: 0, // 卖出信号数量
      recommendations: [], // 建议列表
    },
  };

  if (!stockData || stockData.length === 0) {
    results.summary.recommendations.push('数据为空，无法进行分析');
    return results;
  }

  // 1. 查找最高价点（可能的主力出货点）
  let maxPrice = 0;
  let maxPriceTime = 0;
  let maxPriceIndex = 0;

  stockData.forEach((item, index) => {
    const price = parseFloat(item.NEW);
    if (price > maxPrice) {
      maxPrice = price;
      maxPriceTime = parseInt(Object.keys(item)[0]);
      maxPriceIndex = index;
    }
  });

  // 2. 高位放量滞涨检测（最高价附近成交量放大但价格停滞）
  if (maxPriceIndex > 0) {
    const peakData = stockData[maxPriceIndex];
    const prevData = stockData[maxPriceIndex - 1];

    if (
      parseFloat(peakData.VOL) > parseFloat(prevData.VOL) * 1.2 &&
      parseFloat(peakData.NEW) <= maxPrice * 1.005
    ) {
      results.peakVolumeStagnation = {
        time: timestampToTime(maxPriceTime),
        price: maxPrice,
        volume: peakData.VOL,
        description: '高位放量但价格停滞，主力可能出货',
        signal: 'strong',
      };
      results.summary.sellSignals++;
      results.summary.recommendations.push('检测到高位放量滞涨，建议减仓');
    }
  }

  // 3. 首次回调检测（从最高点回落1%以上）
  for (let i = maxPriceIndex + 1; i < stockData.length; i++) {
    const currentData = stockData[i];
    const currentPrice = parseFloat(currentData.NEW);

    if (currentPrice < maxPrice * 0.99) {
      // 回落1%
      results.firstPullback = {
        time: timestampToTime(parseInt(Object.keys(currentData)[0])),
        price: currentPrice,
        volume: currentData.VOL,
        description: `从最高点${maxPrice}回落超过1%，短期见顶信号`,
        signal: 'medium',
      };
      results.summary.sellSignals++;
      results.summary.recommendations.push('检测到首次回调，注意风险');
      break;
    }
  }

  // 4. 反弹乏力检测（反弹时成交量低于前高）
  if (results.firstPullback) {
    const reboundThreshold = maxPrice * 0.98; // 从最高点回落2%后观察反弹

    for (let i = maxPriceIndex; i < stockData.length; i++) {
      const currentData = stockData[i];
      const currentPrice = parseFloat(currentData.NEW);

      if (currentPrice < reboundThreshold) {
        // 寻找之后的反弹
        for (let j = i + 1; j < stockData.length; j++) {
          const reboundData = stockData[j];
          const reboundPrice = parseFloat(reboundData.NEW);

          if (
            reboundPrice > currentPrice * 1.01 && // 反弹1%以上
            parseFloat(reboundData.VOL) <
              parseFloat(stockData[maxPriceIndex].VOL)
          ) {
            results.weakRebound = {
              time: timestampToTime(parseInt(Object.keys(reboundData)[0])),
              price: reboundPrice,
              volume: reboundData.VOL,
              description: '反弹但成交量不足，买盘乏力',
              signal: 'strong',
            };
            results.summary.sellSignals++;
            results.summary.recommendations.push('反弹乏力，建议卖出');
            break;
          }
        }
        break;
      }
    }
  }

  // 5. 尾盘破位检测（最后30分钟放量下跌）
  const lastHourData = stockData.slice(-30); // 假设每分钟1条数据
  if (lastHourData.length > 0) {
    const lastHourPrices = lastHourData.map((item) => parseFloat(item.NEW));
    const lastHourVolumes = lastHourData.map((item) => parseFloat(item.VOL));

    const avgLastHourPrice =
      lastHourPrices.reduce((a, b) => a + b, 0) / lastHourPrices.length;
    const avgLastHourVolume =
      lastHourVolumes.reduce((a, b) => a + b, 0) / lastHourVolumes.length;

    // 检测尾盘放量下跌
    for (let i = lastHourData.length - 1; i >= 0; i--) {
      const currentData = lastHourData[i];
      const currentPrice = parseFloat(currentData.NEW);
      const currentVolume = parseFloat(currentData.VOL);

      if (
        currentPrice < avgLastHourPrice * 0.99 && // 跌破平均价1%
        currentVolume > avgLastHourVolume * 1.2
      ) {
        // 成交量放大20%
        results.endBreakdown = {
          time: timestampToTime(parseInt(Object.keys(currentData)[0])),
          price: currentPrice,
          volume: currentVolume,
          description: '尾盘放量破位，趋势转弱',
          signal: 'strong',
        };
        results.summary.sellSignals++;
        results.summary.recommendations.push('尾盘破位，明日可能继续下跌');
        break;
      }
    }
  }

  // 6. 综合分析风险等级
  if (results.summary.sellSignals >= 3) {
    results.summary.riskLevel = 'high';
    results.summary.recommendations.push(
      '多个卖出信号叠加，强烈建议减仓或清仓'
    );
  } else if (results.summary.sellSignals >= 2) {
    results.summary.riskLevel = 'medium';
    results.summary.recommendations.push('多个卖出信号，建议谨慎操作');
  } else if (results.summary.sellSignals >= 1) {
    results.summary.riskLevel = 'low';
    results.summary.recommendations.push('单个卖出信号，注意观察');
  } else {
    results.summary.recommendations.push('未检测到明显卖出信号，可继续持有');
  }

  return results;
}

/**
 * 示例数据转换（将原始数据转换为数组形式）
 * @param {Object} rawData 原始数据对象
 * @returns {Array} 转换后的数据数组
 */
export function convertRawData(rawData) {
  if (!rawData || typeof rawData !== 'object') {
    return [];
  }

  return Object.entries(rawData).map(([timestamp, data]) => ({
    [timestamp]: data,
  }));
}

/**
 * 格式化分析结果用于显示
 * @param {Object} analysisResults 分析结果
 * @returns {Object} 格式化后的结果
 */
export function formatAnalysisResults(analysisResults) {
  const formatted = {
    signals: [],
    summary: analysisResults.summary,
  };

  // 格式化各个信号
  if (analysisResults.peakVolumeStagnation) {
    formatted.signals.push({
      type: '高位放量滞涨',
      ...analysisResults.peakVolumeStagnation,
    });
  }

  if (analysisResults.firstPullback) {
    formatted.signals.push({
      type: '首次回调',
      ...analysisResults.firstPullback,
    });
  }

  if (analysisResults.weakRebound) {
    formatted.signals.push({
      type: '反弹乏力',
      ...analysisResults.weakRebound,
    });
  }

  if (analysisResults.endBreakdown) {
    formatted.signals.push({
      type: '尾盘破位',
      ...analysisResults.endBreakdown,
    });
  }

  return formatted;
}
