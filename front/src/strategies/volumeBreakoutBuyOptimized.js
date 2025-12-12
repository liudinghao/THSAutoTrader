/**
 * 股票分时数据分析工具 - 买入点检测（放量拉升策略优化版）
 * 基于量价关系逻辑：低位放量突破、突破确认、拉升加速
 * 数据格式与卖出策略保持一致
 */

/**
 * 主分析函数 - 检测股票买入点
 * @param {Object} stockData 股票分时数据对象，格式：{ "HH:mm:00": { NEW: 价格, VOL: 成交量, money: 成交额, preClose: 昨收价 } }
 * @param {Object} stockInfo 股票信息对象
 *   - limitUpPrice: 涨停价
 *   - limitDownPrice: 跌停价
 *   - name: 股票名称
 *   - code: 股票代码
 *   - preClose: 昨收价
 *   - changePercent: 涨跌幅百分比
 * @param {Array} conceptPeersData 同板块其他股票的分时数据对象数组（可选）
 * @returns {Object} 分析结果 { buyPoints, summary }
 */
export function analyzeBuyPoints(
  stockData,
  stockInfo = {},
  conceptPeersData = []
) {
  const buyPoints = []; // 买入点数组
  const summary = {
    // 综合分析
    riskLevel: 'low', // 风险等级: low, medium, high
    buySignals: 0, // 买入信号数量
    recommendations: [], // 建议列表
  };

  if (!stockData || typeof stockData !== 'object' || Array.isArray(stockData)) {
    summary.recommendations.push('数据格式错误，需要对象格式');
    return { buyPoints, summary };
  }

  // 对象格式转换为数组格式，与卖出策略保持一致
  const dataArray = Object.entries(stockData).map(([timestamp, data]) => ({
    [timestamp]: data,
  }));

  if (dataArray.length === 0) {
    summary.recommendations.push('数据为空，无法进行分析');
    return { buyPoints, summary };
  }

  // --- 跌停价判断入口 ---
  const { limitDownPrice } = stockInfo;
  if (limitDownPrice !== undefined) {
    // 检查是否长时间处于跌停价
    const allAtLimitDown = dataArray.every((item) => {
      const price = parseFloat(item[Object.keys(item)[0]].NEW);
      return Math.abs(price - limitDownPrice) < 0.01;
    });
    if (allAtLimitDown) {
      summary.recommendations.push('当前为跌停状态，不宜买入');
      summary.riskLevel = '高';
      return { buyPoints, summary };
    }
  }

  // --- 1. 低位放量突破检测 ---
  const breakoutBuyPoint = detectVolumeBreakout(
    stockData,
    stockInfo,
    conceptPeersData
  );
  if (breakoutBuyPoint) {
    buyPoints.push(breakoutBuyPoint);
    summary.buySignals++;
    summary.recommendations.push('低位放量突破，建议买入');
  }

  // --- 2. 拉升加速检测 ---
  const accelerationBuyPoint = detectAcceleration(
    stockData,
    stockInfo
  );
  if (accelerationBuyPoint) {
    buyPoints.push(accelerationBuyPoint);
    summary.buySignals++;
    summary.recommendations.push('拉升加速，可追涨买入');
  }

  // --- 3. 分时放量拉升检测 ---
  const volumeSurgeBuyPoint = detectVolumeSurge(
    stockData,
    stockInfo
  );
  if (volumeSurgeBuyPoint) {
    buyPoints.push(volumeSurgeBuyPoint);
    summary.buySignals++;
    summary.recommendations.push('分时放量拉升，短线机会');
  }

  // --- 4. 尾盘抢筹检测 ---
  const endRushBuyPoint = detectEndRush(
    stockData,
    stockInfo
  );
  if (endRushBuyPoint) {
    buyPoints.push(endRushBuyPoint);
    summary.buySignals++;
    summary.recommendations.push('尾盘抢筹，次日高开预期');
  }

  // --- 综合分析风险等级 ---
  if (summary.buySignals >= 3) {
    summary.riskLevel = '高';
    summary.recommendations.push('多个买入信号叠加，强势买入');
  } else if (summary.buySignals >= 2) {
    summary.riskLevel = '中';
    summary.recommendations.push('多个买入信号，建议积极参与');
  } else if (summary.buySignals >= 1) {
    summary.riskLevel = '低';
    summary.recommendations.push('单个买入信号，可适当参与');
  } else {
    summary.recommendations.push('未检测到明显买入信号，观望为主');
  }

  return { buyPoints, summary };
}

/**
 * 检测低位放量突破
 * @param {Object} stockData - 分时数据对象
 * @param {Object} stockInfo - 股票信息对象
 * @param {Array} conceptPeersData - 同板块数据
 * @returns {Object|null} - 买入点对象或null
 */
function detectVolumeBreakout(stockData, stockInfo, conceptPeersData = []) {
  const times = Object.keys(stockData).sort(); // 时间升序
  const group5min = [];
  for (let i = 0; i < times.length; i += 5) {
    const group = times.slice(i, i + 5);
    if (group.length === 5) group5min.push(group);
  }
  if (group5min.length < 4) return null; // 至少4个5分钟区间

  // 计算每个5分钟区间的统计
  const stats5min = group5min.map((group) => {
    const prices = group.map((t) => parseFloat(stockData[t].NEW));
    const vols = group.map((t) => parseFloat(stockData[t].VOL));
    const moneys = group.map((t) => parseFloat(stockData[t].money));
    return {
      high: Math.max(...prices),
      low: Math.min(...prices),
      open: prices[0],
      close: prices[4],
      volume: vols.reduce((a, b) => a + b, 0),
      money: moneys.reduce((a, b) => a + b, 0),
      avgAmountPerTrade: moneys.reduce((a, b) => a + b, 0) / (vols.reduce((a, b) => a + b, 0) || 1),
      startTime: group[0],
      endTime: group[4],
    };
  });

  // 计算5分钟均量
  const avg5minVol = stats5min.reduce((a, b) => a + b.volume, 0) / stats5min.length;

  // 检查最近3个5分钟区间
  for (let i = 2; i < stats5min.length; i++) {
    // 价格突破条件
    const isEarly = stats5min[i].endTime <= '11:00:00'; // 早盘突破
    const priceCond = [i, i-1, i-2].every((idx) => {
      const s = stats5min[idx];
      return s.close > s.open; // 连续上涨
    });

    // 计算突破幅度
    const prevHigh = Math.max(stats5min[i-1].high, stats5min[i-2].high);
    const breakoutRatio = (stats5min[i].close - prevHigh) / prevHigh;

    // 成交量放大条件
    const volMultiplier = isEarly ? 2.0 : 1.5;
    const volCond = stats5min[i].volume >= avg5minVol * volMultiplier;

    // 成交额递增
    const moneyCond = 
      stats5min[i].money > stats5min[i-1].money &&
      stats5min[i-1].money > stats5min[i-2].money;

    // 均额递增
    const avgAmtCond =
      stats5min[i].avgAmountPerTrade > stats5min[i-1].avgAmountPerTrade * 0.95 &&
      stats5min[i-1].avgAmountPerTrade > stats5min[i-2].avgAmountPerTrade * 0.95;

    // 突破幅度要求
    const breakoutThreshold = isEarly ? 0.008 : 0.005; // 0.8%或0.5%
    const strongBreakout = breakoutRatio >= breakoutThreshold;

    if (priceCond && volCond && moneyCond && avgAmtCond && strongBreakout) {
      return {
        ...BUY_POINT_META['低位放量突破'],
        type: '低位放量突破',
        time: stats5min[i].endTime,
        price: stats5min[i].close,
        volume: stats5min[i].volume,
        description: `放量突破前高${(breakoutRatio * 100).toFixed(2)}%，主力进场`,
        signal: 'strong',
        index: i,
      };
    }
  }
  return null;
}

/**
 * 检测拉升加速
 * @param {Object} stockData - 分时数据对象
 * @param {Object} stockInfo - 股票信息对象
 * @returns {Object|null} - 买入点对象或null
 */
function detectAcceleration(stockData, stockInfo) {
  const times = Object.keys(stockData).sort();
  if (times.length < 30) return null; // 至少30分钟数据

  // 计算20分钟均线
  const prices = times.map(t => parseFloat(stockData[t].NEW));
  const volumes = times.map(t => parseFloat(stockData[t].VOL));

  // 找到最近5分钟的拉升
  for (let i = Math.max(5, times.length - 5); i < times.length; i++) {
    const currentPrice = prices[i];
    const prevPrice = prices[i-1];
    const currentVolume = volumes[i];
    const avgVolume5 = calcMAFromArray(volumes, i-1, 5);

    // 价格加速上涨
    const priceRise = (currentPrice - prevPrice) / prevPrice;
    const prevRise = (prices[i-1] - prices[i-2]) / prices[i-2];
    
    // 加速条件
    const acceleration = priceRise > prevRise * 1.5 && priceRise >= 0.003;
    const volumeSurge = currentVolume > avgVolume5 * 1.8;

    if (acceleration && volumeSurge) {
      return {
        ...BUY_POINT_META['拉升加速'],
        type: '拉升加速',
        time: times[i],
        price: currentPrice,
        volume: currentVolume,
        description: `拉升加速，涨幅${(priceRise * 100).toFixed(2)}%，量能放大`,
        signal: 'medium',
        index: i,
      };
    }
  }
  return null;
}

/**
 * 检测分时放量拉升
 * @param {Object} stockData - 分时数据对象
 * @param {Object} stockInfo - 股票信息对象
 * @returns {Object|null} - 买入点对象或null
 */
function detectVolumeSurge(stockData, stockInfo) {
  const times = Object.keys(stockData).sort();
  if (times.length < 15) return null;

  // 检查10分钟内的拉升
  const windowSize = 10;
  for (let i = windowSize; i < times.length; i++) {
    const startPrice = parseFloat(stockData[times[i-windowSize]].NEW);
    const endPrice = parseFloat(stockData[times[i]].NEW);
    
    // 计算窗口内成交量
    let totalVolume = 0;
    let avgVolume = 0;
    for (let j = i-windowSize; j <= i; j++) {
      totalVolume += parseFloat(stockData[times[j]].VOL);
    }
    avgVolume = totalVolume / (windowSize + 1);

    // 计算历史均量（前20分钟）
    let historicalVolume = 0;
    let count = 0;
    for (let j = Math.max(0, i-30); j < i-windowSize; j++) {
      historicalVolume += parseFloat(stockData[times[j]].VOL);
      count++;
    }
    const historicalAvgVolume = count > 0 ? historicalVolume / count : avgVolume;

    // 拉升条件
    const priceRise = (endPrice - startPrice) / startPrice;
    const volumeRatio = avgVolume / Math.max(historicalAvgVolume, avgVolume * 0.1);
    
    if (priceRise >= 0.008 && volumeRatio >= 2.0) { // 0.8%涨幅，2倍放量
      return {
        ...BUY_POINT_META['分时放量拉升'],
        type: '分时放量拉升',
        time: times[i],
        price: endPrice,
        volume: totalVolume,
        description: `10分钟拉升${(priceRise * 100).toFixed(2)}%，放量${volumeRatio.toFixed(1)}倍`,
        signal: 'medium',
        index: i,
      };
    }
  }
  return null;
}

/**
 * 检测尾盘抢筹
 * @param {Object} stockData - 分时数据对象
 * @param {Object} stockInfo - 股票信息对象
 * @returns {Object|null} - 买入点对象或null
 */
function detectEndRush(stockData, stockInfo) {
  const times = Object.keys(stockData).sort();
  const last30Times = times.slice(-30); // 最后30分钟

  if (last30Times.length < 20) return null;

  // 计算尾盘数据
  const last30Prices = last30Times.map(t => parseFloat(stockData[t].NEW));
  const last30Volumes = last30Times.map(t => parseFloat(stockData[t].VOL));

  // 尾盘均价和均量
  const avgEndPrice = last30Prices.reduce((a, b) => a + b, 0) / last30Prices.length;
  const avgEndVolume = last30Volumes.reduce((a, b) => a + b, 0) / last30Volumes.length;

  // 检查尾盘抢筹
  for (let i = Math.max(0, last30Times.length - 5); i < last30Times.length; i++) {
    const currentPrice = last30Prices[i];
    const currentVolume = last30Volumes[i];
    
    // 抢筹条件
    const priceRise = (currentPrice - avgEndPrice) / avgEndPrice;
    const volumeSurge = currentVolume > avgEndVolume * 2;
    const timeCond = last30Times[i] >= '14:30:00'; // 14:30后

    if (priceRise >= 0.005 && volumeSurge && timeCond) {
      return {
        ...BUY_POINT_META['尾盘抢筹'],
        type: '尾盘抢筹',
        time: last30Times[i],
        price: currentPrice,
        volume: currentVolume,
        description: `尾盘抢筹，涨幅${(priceRise * 100).toFixed(2)}%，次日高开预期`,
        signal: 'weak',
        index: times.indexOf(last30Times[i]),
      };
    }
  }
  return null;
}

/**
 * 从数组计算移动平均
 * @param {Array} arr - 数据数组
 * @param {number} idx - 当前索引
 * @param {number} period - 周期
 * @param {string} key - 数据键名
 * @returns {number} 移动平均值
 */
function calcMAFromArray(arr, idx, period) {
  let sum = 0;
  let count = 0;
  for (let i = Math.max(0, idx - period + 1); i <= idx; i++) {
    sum += arr[i];
    count++;
  }
  return count > 0 ? sum / count : 0;
}

// 买入点类型可视化属性映射表
export const BUY_POINT_META = {
  低位放量突破: {
    symbol: 'arrow',
    symbolRotate: 0,
    color: '#ff4d4f',
    label: '低位突破',
  },
  拉升加速: {
    symbol: 'arrow',
    symbolRotate: 0,
    color: '#ff4d4f',
    label: '拉升加速',
  },
  分时放量拉升: {
    symbol: 'arrow',
    symbolRotate: 0,
    color: '#ff4d4f',
    label: '分时拉升',
  },
  尾盘抢筹: {
    symbol: 'arrow',
    symbolRotate: 0,
    color: '#ff4d4f',
    label: '尾盘抢筹',
  },
  default: {
    symbol: 'arrow',
    symbolRotate: 0,
    color: '#ff4d4f',
    label: '买点',
  },
};

/**
 * 批量分析多只股票
 * @param {Array} stockDataList - 股票数据列表
 * @returns {Array} 分析结果列表
 */
export function scanBuyPoints(stockDataList) {
  return stockDataList.map(stock => {
    const { buyPoints, summary } = analyzeBuyPoints(stock.rawData || stock.data || {}, {
      name: stock.name,
      code: stock.code,
      preClose: stock.preClose,
      limitUpPrice: stock.limitUpPrice,
      limitDownPrice: stock.limitDownPrice,
      changePercent: stock.changePercent
    });
    return {
      symbol: stock.code,
      name: stock.name,
      buyPoints,
      summary
    };
  }).filter(result => result.buyPoints.length > 0);
}

/**
 * 获取策略描述
 * @returns {Object} 策略描述信息
 */
export function getStrategyDescription() {
  return {
    name: '分时放量拉升买入',
    description: '基于分时量价关系，检测低位放量突破、拉升加速、尾盘抢筹等买入信号',
    signals: [
      '低位放量突破',
      '拉升加速',
      '分时放量拉升',
      '尾盘抢筹'
    ],
    timeframes: ['5分钟', '15分钟', '30分钟'],
    riskLevel: '中',
    bestMarket: '震荡向上或牛市行情'
  };
}