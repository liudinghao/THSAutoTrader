/**
 * 股票分时数据分析工具 - 卖出点检测
 * 基于量价关系逻辑：高位放量滞涨、首次回调、反弹乏力、尾盘破位
 */

/**
 * 主分析函数 - 检测股票卖出点
 * @param {Object} stockData 股票分时数据对象
 * @param {Object} stockInfo 股票信息对象（如涨停价、跌停价、名称、代码等）
 *   - limitUpPrice: 涨停价
 *   - limitDownPrice: 跌停价
 *   - name: 股票名称（可选）
 *   - code: 股票代码（可选）
 *   - preClose: 昨收价（可选）
 *   - ...（可扩展更多字段）
 * @returns {Array} 分析结果数组
 */
export function analyzeSellPoints(
  stockData,
  stockInfo = {},
  conceptPeersData = []
) {
  const sellPoints = []; // 卖出点数组
  const summary = {
    // 综合分析
    riskLevel: 'low', // 风险等级: low, medium, high
    sellSignals: 0, // 卖出信号数量
    recommendations: [], // 建议列表
  };

  if (!stockData || typeof stockData !== 'object' || Array.isArray(stockData)) {
    summary.recommendations.push('数据格式错误，需要对象格式');
    return sellPoints;
  }

  // 对象格式转换为数组格式
  const dataArray = Object.entries(stockData).map(([timestamp, data]) => ({
    [timestamp]: data,
  }));

  if (dataArray.length === 0) {
    summary.recommendations.push('数据为空，无法进行分析');
    return sellPoints;
  }

  // --- 涨停价判断入口（可扩展） ---
  const { limitUpPrice, limitDownPrice } = stockInfo;
  if (limitUpPrice !== undefined) {
    // 检查是否长时间处于涨停价，可在此处扩展特殊逻辑
    const allAtLimitUp = dataArray.every((item) => {
      const price = parseFloat(item[Object.keys(item)[0]].NEW);
      return Math.abs(price - limitUpPrice) < 0.01;
    });
    if (allAtLimitUp) {
      summary.recommendations.push('当前为涨停状态，常规卖出信号不适用');
      summary.riskLevel = '低';
      return { sellPoints, summary };
    }
  }

  // --- 高位放量滞涨三维度检测 ---
  const stagnationSellPoint = detectStagnation(
    stockData,
    stockInfo,
    conceptPeersData
  );
  if (stagnationSellPoint) {
    sellPoints.push(stagnationSellPoint);
    summary.sellSignals++;
    summary.recommendations.push('高位放量滞涨，建议全仓卖出');
  }

  // 1. 查找最高价点（可能的主力出货点）
  let maxPrice = 0;
  let maxPriceTime = 0;
  let maxPriceIndex = 0;

  dataArray.forEach((item, index) => {
    const timestamp = Object.keys(item)[0];
    const data = item[timestamp];
    const price = parseFloat(data.NEW);
    if (price > maxPrice) {
      maxPrice = price;
      maxPriceTime = parseInt(timestamp);
      maxPriceIndex = index;
    }
  });

  // 2. 高位放量滞涨检测（最高价附近成交量放大但价格停滞）
  // 已由 detectStagnation 替代

  // 3. 首次回调检测（从最高点回落1%以上）
  for (let i = maxPriceIndex + 1; i < dataArray.length; i++) {
    const currentTimestamp = Object.keys(dataArray[i])[0];
    const currentData = dataArray[i][currentTimestamp];
    const currentPrice = parseFloat(currentData.NEW);

    if (currentPrice < maxPrice * 0.99) {
      // 回落1%
      sellPoints.push({
        ...SELL_POINT_META['首次回调'],
        type: '首次回调',
        time: currentTimestamp,
        price: currentPrice,
        volume: currentData.VOL,
        description: `从最高点${maxPrice}回落超过1%，短期见顶信号`,
        signal: 'medium',
        index: i,
      });
      summary.sellSignals++;
      summary.recommendations.push('检测到首次回调，注意风险');
      break;
    }
  }

  // 4. 反弹乏力检测（反弹时成交量低于前高，动态窗口，最低点后首次反弹）
  const hasFirstPullback = sellPoints.some(
    (point) => point.type === '首次回调'
  );
  if (hasFirstPullback) {
    const firstPullback = sellPoints.find((point) => point.type === '首次回调');
    const firstPullbackIndex = firstPullback.index;
    let minPrice = parseFloat(
      dataArray[firstPullbackIndex][
        Object.keys(dataArray[firstPullbackIndex])[0]
      ].NEW
    );
    let minIndex = firstPullbackIndex;
    // 1. 找到首次回调后的最低点
    for (let i = firstPullbackIndex + 1; i < dataArray.length; i++) {
      const price = parseFloat(dataArray[i][Object.keys(dataArray[i])[0]].NEW);
      if (price < minPrice) {
        minPrice = price;
        minIndex = i;
      }
    }
    // 2. 从最低点后，寻找首次反弹1%以上
    for (let i = minIndex + 1; i < dataArray.length; i++) {
      const price = parseFloat(dataArray[i][Object.keys(dataArray[i])[0]].NEW);
      if (price >= minPrice * 1.01) {
        // 反弹1%以上
        const volume = parseFloat(
          dataArray[i][Object.keys(dataArray[i])[0]].VOL
        );
        const baseVolume = parseFloat(
          dataArray[maxPriceIndex][Object.keys(dataArray[maxPriceIndex])[0]].VOL
        );
        if (volume < baseVolume) {
          sellPoints.push({
            ...SELL_POINT_META['反弹乏力'],
            type: '反弹乏力',
            time: Object.keys(dataArray[i])[0],
            price,
            volume,
            description: '反弹但成交量不足，买盘乏力',
            signal: 'strong',
            index: i,
          });
          summary.sellSignals++;
          summary.recommendations.push('反弹乏力，建议卖出');
        }
        break; // 只检测一次
      }
    }
  }

  // 5. 尾盘破位检测（最后30分钟放量下跌）
  const lastHourData = dataArray.slice(-30); // 假设每分钟1条数据
  if (lastHourData.length > 0) {
    const lastHourPrices = lastHourData.map((item) => {
      const timestamp = Object.keys(item)[0];
      return parseFloat(item[timestamp].NEW);
    });
    const lastHourVolumes = lastHourData.map((item) => {
      const timestamp = Object.keys(item)[0];
      return parseFloat(item[timestamp].VOL);
    });

    const avgLastHourPrice =
      lastHourPrices.reduce((a, b) => a + b, 0) / lastHourPrices.length;
    const avgLastHourVolume =
      lastHourVolumes.reduce((a, b) => a + b, 0) / lastHourVolumes.length;

    // 检测尾盘放量下跌（可多次出现）
    for (let i = lastHourData.length - 1; i >= 0; i--) {
      const currentTimestamp = Object.keys(lastHourData[i])[0];
      const currentData = lastHourData[i][currentTimestamp];
      const currentPrice = parseFloat(currentData.NEW);
      const currentVolume = parseFloat(currentData.VOL);

      if (
        currentPrice < avgLastHourPrice * 0.99 && // 跌破平均价1%
        currentVolume > avgLastHourVolume * 1.2
      ) {
        // 成交量放大20%
        const originalIndex = dataArray.length - lastHourData.length + i;
        sellPoints.push({
          ...SELL_POINT_META['尾盘破位'],
          type: '尾盘破位',
          time: currentTimestamp,
          price: currentPrice,
          volume: currentVolume,
          description: '尾盘放量破位，趋势转弱',
          signal: 'strong',
          index: originalIndex,
        });
        summary.sellSignals++;
        summary.recommendations.push('尾盘破位，明日可能继续下跌');
        // 不break，允许多次
      }
    }
  }

  // 5.1 盘中急跌放量（可多次出现）
  for (let i = 5; i < dataArray.length; i++) {
    const timestamp = Object.keys(dataArray[i])[0];
    const data = dataArray[i][timestamp];
    const price = parseFloat(data.NEW);
    const volume = parseFloat(data.VOL);
    const prevPrice = parseFloat(
      dataArray[i - 1][Object.keys(dataArray[i - 1])[0]].NEW
    );
    const vol5 = calcMA(dataArray, i - 1, 5, 'VOL');
    if (
      price < prevPrice * 0.99 && // 跌幅大于1%
      volume > vol5 * 1.5 // 成交量大于5均量1.5倍
    ) {
      sellPoints.push({
        ...SELL_POINT_META['盘中急跌放量'],
        type: '盘中急跌放量',
        time: timestamp,
        price,
        volume,
        description: '盘中急跌且放量，恐慌盘或主力砸盘',
        signal: 'strong',
        index: i,
      });
      summary.sellSignals++;
      summary.recommendations.push('盘中急跌放量，短线需果断止损');
      // 不break，允许多次
    }
  }

  // 修正后的涨停打开且放量信号（可多次出现）
  if (stockInfo && stockInfo.limitUpPrice !== undefined) {
    for (let i = 1; i < dataArray.length; i++) {
      const prevTimestamp = Object.keys(dataArray[i - 1])[0];
      const prevData = dataArray[i - 1][prevTimestamp];
      const prevPrice = parseFloat(prevData.NEW);
      const timestamp = Object.keys(dataArray[i])[0];
      const data = dataArray[i][timestamp];
      const price = parseFloat(data.NEW);
      const volume = parseFloat(data.VOL);
      const vol5 = calcMA(dataArray, i - 1, 5, 'VOL');
      // 前一分钟在涨停价（误差0.01元内），当前分钟低于涨停价0.01元且放量
      if (
        Math.abs(prevPrice - stockInfo.limitUpPrice) < 0.01 &&
        price < stockInfo.limitUpPrice - 0.01 &&
        volume > vol5 * 1.5
      ) {
        sellPoints.push({
          ...SELL_POINT_META['涨停打开且放量'],
          type: '涨停打开且放量',
          time: timestamp,
          price,
          volume,
          description: '涨停打开且放量，资金出逃',
          signal: 'strong',
          index: i,
        });
        summary.sellSignals++;
        summary.recommendations.push('涨停打开且放量，短线需警惕回落风险');
        // 不break，允许多次
      }
    }
  }

  // 6. 综合分析风险等级
  if (summary.sellSignals >= 3) {
    summary.riskLevel = '高';
    summary.recommendations.push('多个卖出信号叠加，强烈建议减仓或清仓');
  } else if (summary.sellSignals >= 2) {
    summary.riskLevel = '中';
    summary.recommendations.push('多个卖出信号，建议谨慎操作');
  } else if (summary.sellSignals >= 1) {
    summary.riskLevel = '低';
    summary.recommendations.push('单个卖出信号，注意观察');
  } else {
    summary.recommendations.push('未检测到明显卖出信号，可继续持有');
  }
  return { sellPoints, summary };
}

// 计算N分钟均价或均量
function calcMA(arr, idx, period, key) {
  let sum = 0;
  let count = 0;
  for (let i = Math.max(0, idx - period + 1); i <= idx; i++) {
    const timestamp = Object.keys(arr[i])[0];
    sum += parseFloat(arr[i][timestamp][key]);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

// 高位放量滞涨三维度检测实现
/**
 * 检查是否为高位放量滞涨
 * @param {Object} stockData - 分时数据对象，key为"HH:mm:00"
 * @param {Object} stockInfo - 股票信息对象，需含涨跌幅changePercent
 * @param {Array<Object>} conceptPeersData - 同板块其他股票的分时数据对象数组（可选）
 * @returns {Object|null} - 满足条件则返回卖点对象，否则返回null
 */
function detectStagnation(stockData, stockInfo, conceptPeersData = []) {
  const times = Object.keys(stockData).sort(); // 时间升序
  const group5min = [];
  for (let i = 0; i < times.length; i += 5) {
    const group = times.slice(i, i + 5);
    if (group.length === 5) group5min.push(group);
  }
  if (group5min.length < 3) return null; // 至少3个5分钟区间

  // 计算每个5分钟区间的统计
  const stats5min = group5min.map((group) => {
    const prices = group.map((t) => parseFloat(stockData[t].NEW));
    const vols = group.map((t) => parseFloat(stockData[t].VOL));
    const moneys = group.map((t) => parseFloat(stockData[t].money));
    return {
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[4],
      volume: vols.reduce((a, b) => a + b, 0),
      money: moneys.reduce((a, b) => a + b, 0),
      avgAmountPerTrade:
        moneys.reduce((a, b) => a + b, 0) /
        (vols.reduce((a, b) => a + b, 0) || 1),
      startTime: group[0],
      endTime: group[4],
    };
  });

  // 当日5分钟均量
  const avg5minVol =
    stats5min.reduce((a, b) => a + b.volume, 0) / stats5min.length;

  // 检查连续3个5分钟区间
  for (let i = 2; i < stats5min.length; i++) {
    // 价格横盘
    const isLate = stats5min[i].endTime >= '14:50:00';
    const priceCond = [i, i - 1, i - 2].every((idx) => {
      const s = stats5min[idx];
      const amp = (s.high - s.low) / s.low;
      return (
        amp <= (isLate ? 0.015 : 0.01) &&
        s.close <=
          Math.max(stats5min[idx - 1]?.high || 0, stats5min[idx - 2]?.high || 0)
      );
    });

    // 成交量放量
    const prevVol = stats5min[i - 1].volume;
    const risePercent = stockInfo.changePercent || 0;
    const volThreshold = risePercent >= 5 ? 1.5 : 2;
    const volCond =
      stats5min[i].volume >= prevVol * volThreshold &&
      stats5min[i].volume >= avg5minVol * 3;

    // 均额递减
    const avgAmtCond =
      stats5min[i].avgAmountPerTrade <
        stats5min[i - 1].avgAmountPerTrade * 0.9 &&
      stats5min[i - 1].avgAmountPerTrade <
        stats5min[i - 2].avgAmountPerTrade * 0.9;

    // 联动股确认（可选，需传入同板块数据）
    let conceptCond = true;
    if (conceptPeersData.length > 0) {
      let peerCount = 0;
      for (const peer of conceptPeersData) {
        // 取peer的同一5分钟区间
        const peerTimes = Object.keys(peer).sort();
        const peerGroup5min = [];
        for (let j = 0; j < peerTimes.length; j += 5) {
          const group = peerTimes.slice(j, j + 5);
          if (group.length === 5) peerGroup5min.push(group);
        }
        if (peerGroup5min.length > i) {
          const group = peerGroup5min[i];
          const prices = group.map((t) => parseFloat(peer[t].NEW));
          const vols = group.map((t) => parseFloat(peer[t].VOL));
          const moneys = group.map((t) => parseFloat(peer[t].money));
          const high = Math.max(...prices);
          const low = Math.min(...prices);
          const amp = (high - low) / low;
          const volume = vols.reduce((a, b) => a + b, 0);
          const avg5minVolPeer =
            peerGroup5min
              .map((g) =>
                g.map((t) => parseFloat(peer[t].VOL)).reduce((a, b) => a + b, 0)
              )
              .reduce((a, b) => a + b, 0) / peerGroup5min.length;
          if (amp <= 0.01 && volume >= avg5minVolPeer * 3) peerCount++;
        }
      }
      conceptCond = peerCount >= 2;
    }

    if (priceCond && volCond && avgAmtCond && conceptCond) {
      // 满足条件，返回卖点
      return {
        ...SELL_POINT_META['高位放量滞涨'],
        type: '高位放量滞涨',
        time: stats5min[i].endTime,
        price: stats5min[i].close,
        volume: stats5min[i].volume,
        description: '高位放量滞涨，三维度同步验证，主力出货',
        signal: 'strong',
        index: i,
      };
    }
  }
  return null;
}

// 卖点类型可视化属性映射表
export const SELL_POINT_META = {
  高位放量滞涨: {
    symbol: 'diamond',
    symbolRotate: 0,
    color: '#ff4d4f',
    label: '高位滞涨',
  },
  首次回调: {
    symbol: 'arrow',
    symbolRotate: 180,
    color: '#fa8c16',
    label: '首次回调',
  },
  反弹乏力: {
    symbol: 'circle',
    symbolRotate: 0,
    color: '#722ed1',
    label: '反弹乏力',
  },
  尾盘破位: {
    symbol: 'rect',
    symbolRotate: 0,
    color: '#eb2f96',
    label: '尾盘破位',
  },
  盘中急跌放量: {
    symbol: 'arrow',
    symbolRotate: 270,
    color: '#f5222d',
    label: '急跌放量',
  },
  涨停打开且放量: {
    symbol: 'star',
    symbolRotate: 0,
    color: '#faad14',
    label: '涨停开板',
  },
  default: {
    symbol: 'arrow',
    symbolRotate: 180,
    color: '#f56c6c',
    label: '卖点',
  },
};
