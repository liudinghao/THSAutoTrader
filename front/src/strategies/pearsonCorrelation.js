/**
 * 皮尔逊相关性算法
 * 计算两只股票分时数据的相似度
 */

/**
 * 计算皮尔逊相关系数（基于涨跌幅数据）
 * @param {Array} data1 第一个股票的涨跌幅序列（百分比）
 * @param {Array} data2 第二个股票的涨跌幅序列（百分比）
 * @returns {number} 皮尔逊相关系数，范围在[-1, 1]之间
 */
function calculatePearsonCorrelation(data1, data2) {
  if (!Array.isArray(data1) || !Array.isArray(data2)) {
    throw new Error('输入必须是数组');
  }

  if (data1.length !== data2.length) {
    throw new Error('两个序列长度必须相同');
  }

  if (data1.length < 2) {
    return 0;
  }

  // 过滤掉null/undefined/NaN值，只保留有效数字
  const validPairs = [];
  for (let i = 0; i < data1.length; i++) {
    if (
      data1[i] !== null &&
      data2[i] !== null &&
      data1[i] !== undefined &&
      data2[i] !== undefined &&
      typeof data1[i] === 'number' &&
      typeof data2[i] === 'number' &&
      !isNaN(data1[i]) &&
      !isNaN(data2[i])
    ) {
      validPairs.push([data1[i], data2[i]]);
    }
  }

  if (validPairs.length < 2) {
    return 0;
  }

  const n = validPairs.length;

  // 计算平均值
  const sumX = validPairs.reduce((sum, pair) => sum + pair[0], 0);
  const sumY = validPairs.reduce((sum, pair) => sum + pair[1], 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  // 计算分子和分母
  let numerator = 0;
  let sumSquareX = 0;
  let sumSquareY = 0;

  for (let i = 0; i < n; i++) {
    const [xi, yi] = validPairs[i];
    const devX = xi - meanX;
    const devY = yi - meanY;

    numerator += devX * devY;
    sumSquareX += devX * devX;
    sumSquareY += devY * devY;
  }

  const denominator = Math.sqrt(sumSquareX * sumSquareY);

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * 根据相关系数获取相似度标签
 * @param {number} correlation 皮尔逊相关系数
 * @returns {Object} 包含百分比相似度和标签的对象
 */
function getCorrelationLabel(correlation) {
  const absCorrelation = Math.abs(correlation);
  let label = '';
  let level = '';

  if (absCorrelation >= 0.9) {
    label = '极强相关';
    level = 'extremely-strong';
  } else if (absCorrelation >= 0.8) {
    label = '强相关';
    level = 'strong';
  } else if (absCorrelation >= 0.6) {
    label = '中等相关';
    level = 'moderate';
  } else if (absCorrelation >= 0.4) {
    label = '弱相关';
    level = 'weak';
  } else if (absCorrelation >= 0.2) {
    label = '极弱相关';
    level = 'very-weak';
  } else {
    label = '不相关';
    level = 'none';
  }

  // 计算百分比相似度（基于绝对值）
  const similarity = Math.round(absCorrelation * 100);

  return {
    similarity,
    label,
    level,
    correlation,
    direction:
      correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none',
  };
}

/**
 * 标准化涨跌幅数据（相对于涨停幅度）
 * @param {Array} changePercent 涨跌幅数据
 * @param {number} limitUpPercent 涨停幅度（如20表示20%）
 * @returns {Array} 标准化后的涨跌幅比例
 */
function normalizeChangePercent(changePercent, limitUpPercent = 10) {
  if (!Array.isArray(changePercent) || changePercent.length === 0) {
    return changePercent;
  }

  // 涨停幅度不能为0
  const limit = Math.max(limitUpPercent, 0.01);

  // 将涨跌幅除以涨停幅度，得到相对于涨停的比例
  return changePercent.map((percent) => {
    if (typeof percent !== 'number' || isNaN(percent)) {
      return percent;
    }
    return (percent / limit) * 100; // 标准化为相对于涨停的百分比
  });
}

/**
 * 计算两只股票分时数据的相似度
 * @param {Object} stock1 第一个股票的对象
 * @param {Object} stock2 第二个股票的对象
 * @param {string} dataType 数据类型：'prices'（价格）或 'changePercent'（涨跌幅）
 * @param {boolean} normalize 是否标准化涨跌幅（按涨停幅度）
 * @param {boolean} includePrevious 是否包含上一日相似度
 * @returns {Object} 相似度分析结果
 */
export function calculateStockSimilarity(
  stock1,
  stock2,
  dataType = 'changePercent',
  normalize = true,
  includePrevious = true
) {
  if (!stock1 || !stock2) {
    throw new Error('必须提供两个股票对象');
  }

  let data1, data2;
  let prevData1, prevData2;

  switch (dataType) {
    case 'prices':
      data1 = stock1.prices || [];
      data2 = stock2.prices || [];
      prevData1 = stock1.prevPrices || [];
      prevData2 = stock2.prevPrices || [];
      break;
    case 'changePercent':
      data1 = stock1.changePercent || [];
      data2 = stock2.changePercent || [];
      prevData1 = stock1.prevChangePercent || [];
      prevData2 = stock2.prevChangePercent || [];

      // 标准化涨跌幅数据（按涨停幅度）
      if (normalize) {
        const limit1 = stock1.limitUpPercent || 10;
        const limit2 = stock2.limitUpPercent || 10;
        data1 = normalizeChangePercent(data1, limit1);
        data2 = normalizeChangePercent(data2, limit2);
        prevData1 = normalizeChangePercent(prevData1, limit1);
        prevData2 = normalizeChangePercent(prevData2, limit2);
      }
      break;
    default:
      throw new Error('数据类型必须是 prices 或 changePercent');
  }

  if (data1.length === 0 || data2.length === 0) {
    console.log('数据为空，返回0%');
    return {
      correlation: 0,
      similarity: 0,
      label: '无数据',
      level: 'none',
      direction: 'none',
      validDataPoints: 0,
      totalDataPoints: Math.max(data1.length, data2.length),
    };
  }

  try {
    const correlation = calculatePearsonCorrelation(data1, data2);
    const result = getCorrelationLabel(correlation);

    // 计算上一日相似度
    let prevCorrelation = null;
    let prevSimilarity = null;
    let prevLabel = null;

    if (includePrevious && prevData1.length > 0 && prevData2.length > 0) {
      try {
        const prevCorr = calculatePearsonCorrelation(prevData1, prevData2);
        const prevResult = getCorrelationLabel(prevCorr);
        prevCorrelation = prevCorr;
        prevSimilarity = prevResult.similarity;
        prevLabel = prevResult.label;
      } catch (prevError) {
        console.warn('计算上一日相似度失败:', prevError.message);
      }
    }

    // 计算有效数据点
    const validDataPoints = data1.filter(
      (val, idx) =>
        val !== null &&
        data2[idx] !== null &&
        typeof val === 'number' &&
        typeof data2[idx] === 'number' &&
        !isNaN(val) &&
        !isNaN(data2[idx])
    ).length;

    return {
      ...result,
      prevCorrelation,
      prevSimilarity,
      prevLabel,
      validDataPoints,
      totalDataPoints: data1.length,
      dataType,
      hasPreviousData: prevData1.length > 0 && prevData2.length > 0,
    };
  } catch (error) {
    console.error('计算股票相似度失败:', error);
    return {
      correlation: 0,
      similarity: 0,
      prevCorrelation: null,
      prevSimilarity: null,
      prevLabel: null,
      label: '计算错误',
      level: 'error',
      direction: 'none',
      validDataPoints: 0,
      totalDataPoints: Math.max(data1.length, data2.length),
      error: error.message,
      hasPreviousData: false,
    };
  }
}

/**
 * 计算多只股票之间的相似度矩阵
 * @param {Array} stocks 股票数组
 * @param {string} dataType 数据类型：'prices' 或 'changePercent'
 * @param {boolean} normalize 是否标准化涨跌幅（按涨停幅度）
 * @param {boolean} includePrevious 是否包含上一日相似度
 * @returns {Array} 相似度矩阵
 */
export function calculateSimilarityMatrix(
  stocks,
  dataType = 'changePercent',
  normalize = true,
  includePrevious = true
) {
  if (!Array.isArray(stocks) || stocks.length < 2) {
    return [];
  }

  const matrix = [];

  for (let i = 0; i < stocks.length; i++) {
    const row = [];
    for (let j = 0; j < stocks.length; j++) {
      if (i === j) {
        row.push({
          correlation: 1,
          similarity: 100,
          label: '完全相同',
          level: 'perfect',
          direction: 'positive',
          validDataPoints: 0,
          totalDataPoints: 0,
          stock1: stocks[i],
          stock2: stocks[j],
        });
      } else {
        const similarity = calculateStockSimilarity(
          stocks[i],
          stocks[j],
          dataType,
          normalize,
          includePrevious
        );
        row.push({
          ...similarity,
          stock1: stocks[i],
          stock2: stocks[j],
        });
      }
    }
    matrix.push(row);
  }

  return matrix;
}

/**
 * 获取最相似的股票对
 * @param {Array} stocks 股票数组
 * @param {string} dataType 数据类型：'prices' 或 'changePercent'
 * @param {number} minSimilarity 最小相似度阈值（0-100）
 * @param {boolean} normalize 是否标准化涨跌幅（按涨停幅度）
 * @param {boolean} includePrevious 是否包含上一日相似度
 * @returns {Array} 排序后的相似股票对
 */
export function getMostSimilarStocks(
  stocks,
  dataType = 'changePercent',
  minSimilarity = 60,
  normalize = true,
  includePrevious = true
) {
  if (!Array.isArray(stocks) || stocks.length < 2) {
    return [];
  }

  const similarities = [];

  for (let i = 0; i < stocks.length; i++) {
    for (let j = i + 1; j < stocks.length; j++) {
      const similarity = calculateStockSimilarity(
        stocks[i],
        stocks[j],
        dataType,
        normalize,
        includePrevious
      );
      if (similarity.similarity >= minSimilarity) {
        similarities.push({
          ...similarity,
          stock1: stocks[i],
          stock2: stocks[j],
          pairIndex: [i, j],
        });
      }
    }
  }

  // 按相似度降序排序
  return similarities.sort((a, b) => b.similarity - a.similarity);
}

// 导出剩余的函数（其他函数已在前面用 export function 导出）
export {
  calculatePearsonCorrelation,
  getCorrelationLabel,
};
