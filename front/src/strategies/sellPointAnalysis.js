/**
 * 股票分时数据分析工具 - 卖出点检测
 * 基于量价关系逻辑：高位放量滞涨、首次回调、反弹乏力、尾盘破位
 */

/**
 * 主分析函数 - 检测股票卖出点
 * @param {Object} stockData 股票分时数据对象
 * @returns {Array} 分析结果数组
 */
export function analyzeSellPoints(stockData) {
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
  if (maxPriceIndex > 0) {
    const peakTimestamp = Object.keys(dataArray[maxPriceIndex])[0];
    const peakData = dataArray[maxPriceIndex][peakTimestamp];
    const prevTimestamp = Object.keys(dataArray[maxPriceIndex - 1])[0];
    const prevData = dataArray[maxPriceIndex - 1][prevTimestamp];

    if (
      parseFloat(peakData.VOL) > parseFloat(prevData.VOL) * 1.2 &&
      parseFloat(peakData.NEW) <= maxPrice * 1.005
    ) {
      sellPoints.push({
        type: '高位放量滞涨',
        time: Object.keys(dataArray[maxPriceIndex])[0],
        price: maxPrice,
        volume: peakData.VOL,
        description: '高位放量但价格停滞，主力可能出货',
        signal: 'strong',
        index: maxPriceIndex,
      });
      summary.sellSignals++;
      summary.recommendations.push('检测到高位放量滞涨，建议减仓');
    }
  }

  // 3. 首次回调检测（从最高点回落1%以上）
  for (let i = maxPriceIndex + 1; i < dataArray.length; i++) {
    const currentTimestamp = Object.keys(dataArray[i])[0];
    const currentData = dataArray[i][currentTimestamp];
    const currentPrice = parseFloat(currentData.NEW);

    if (currentPrice < maxPrice * 0.99) {
      // 回落1%
      sellPoints.push({
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

  // 4. 反弹乏力检测（反弹时成交量低于前高）
  const hasFirstPullback = sellPoints.some(
    (point) => point.type === '首次回调'
  );
  if (hasFirstPullback) {
    const reboundThreshold = maxPrice * 0.98; // 从最高点回落2%后观察反弹

    for (let i = maxPriceIndex; i < dataArray.length; i++) {
      const currentTimestamp = Object.keys(dataArray[i])[0];
      const currentData = dataArray[i][currentTimestamp];
      const currentPrice = parseFloat(currentData.NEW);

      if (currentPrice < reboundThreshold) {
        // 寻找之后的反弹
        for (let j = i + 1; j < dataArray.length; j++) {
          const reboundTimestamp = Object.keys(dataArray[j])[0];
          const reboundData = dataArray[j][reboundTimestamp];
          const reboundPrice = parseFloat(reboundData.NEW);

          if (
            reboundPrice > currentPrice * 1.01 && // 反弹1%以上
            parseFloat(reboundData.VOL) <
              parseFloat(
                dataArray[maxPriceIndex][
                  Object.keys(dataArray[maxPriceIndex])[0]
                ].VOL
              )
          ) {
            sellPoints.push({
              type: '反弹乏力',
              time: reboundTimestamp,
              price: reboundPrice,
              volume: reboundData.VOL,
              description: '反弹但成交量不足，买盘乏力',
              signal: 'strong',
              index: j,
            });
            summary.sellSignals++;
            summary.recommendations.push('反弹乏力，建议卖出');
            break;
          }
        }
        break;
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

    // 检测尾盘放量下跌
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
        break;
      }
    }
  }

  // 6. 综合分析风险等级
  if (summary.sellSignals >= 3) {
    summary.riskLevel = 'high';
    summary.recommendations.push('多个卖出信号叠加，强烈建议减仓或清仓');
  } else if (summary.sellSignals >= 2) {
    summary.riskLevel = 'medium';
    summary.recommendations.push('多个卖出信号，建议谨慎操作');
  } else if (summary.sellSignals >= 1) {
    summary.riskLevel = 'low';
    summary.recommendations.push('单个卖出信号，注意观察');
  } else {
    summary.recommendations.push('未检测到明显卖出信号，可继续持有');
  }

  return sellPoints;
}
