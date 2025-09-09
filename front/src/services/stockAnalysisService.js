/**
 * 股票分析服务
 * 提供股票数据获取和分析功能
 */

import { fetchHistoryData, fetchMinuteData, isTradeTime } from '../utils/quoteApi';
import { sendMessage } from '../api/llm';
import axios from 'axios';

// API配置
const DEEPSEEK_API_KEY = 'sk-c7c0c5a0480c462ebcf13be3f999f406';
const DEEPSEEK_MODEL = 'deepseek-chat';
// const DEEPSEEK_MODEL = 'deepseek-reasoner';

// 系统提示配置
const SYSTEM_PROMPT = `你是一位经验丰富的短线交易员，操作风格为激进型。你的职责是根据提供的股票数据给出专业的交易建议。

【角色定义】
- 身份：专业短线交易员
- 风格：激进型交易策略
- 输出要求：简洁明了，直接给出买卖建议，无需分析过程
- 语言：中文

【A股交易规则】
- 交易单位：1手=100股，买卖必须是100股整数倍
- T+1交易制度：当日买入的股票次日才能卖出
- 资金限制：根据当前可用金额进行仓位管理
- 风险控制：设置合理的止损位和止盈目标

【分析原则】
1. 基于技术面分析（趋势、支撑阻力位、成交量变化）
2. 结合持仓状态和盈亏情况进行决策
3. 考虑资金管理和风险控制
4. 关注概念热点和市场情绪
5. 提供具体操作点位和仓位建议

【风险控制重点】
- 严格执行止损策略，控制单笔亏损在总资金的3%以内
- 关注成交量变化，异常放量或缩量需谨慎操作
- 结合技术指标和市场趋势，避免逆势操作
- 注意仓位管理，避免重仓单一股票`;

// 交易规则详情
const TRADING_RULES = {
  unit: '1手=100股',
  t1Rule: 'T+1交易制度（当日买入次日可卖）',
  minQuantity: '必须是100股整数倍',
  riskControl: '设置止损位和分批止盈',
};

/**
 * 获取股票历史K线数据
 * @param {string} stockCode 股票代码
 * @param {number} months 月数，默认6个月
 * @returns {Promise<Object>} K线数据
 */
export async function getHistoricalKLineData(stockCode, months = 6) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const formatDate = (date) =>
      date.toISOString().slice(0, 10).replace(/-/g, '');
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    let dailyKData = null;

    try {
      dailyKData = await fetchHistoryData(
        [stockCode],
        startDateStr,
        endDateStr
      );
    } catch (error) {
      console.warn('获取历史K线数据失败，尝试使用备用API:', error);
      // 使用备用API获取K线数据
      try {
        const response = await axios.get(
          `https://www.wttiao.com/moni/quote/kline`,
          {
            params: {
              code: stockCode.replace(':', '').replace(/\D/g, ''),
              start: startDate.toISOString().slice(0, 10),
              marketid: 33,
            },
          }
        );
        dailyKData = response.data;
      } catch (backupError) {
        console.error('备用API也失败:', backupError);
        throw new Error('无法获取历史K线数据');
      }
    }

    return dailyKData;
  } catch (error) {
    console.error('获取历史K线数据错误:', error);
    throw error;
  }
}

/**
 * 获取股票今日分时数据
 * @param {string} stockCode 股票代码
 * @returns {Promise<Object>} 分时数据
 */
export async function getIntradayData(stockCode) {
  try {
    const minuteData = await fetchMinuteData([stockCode]);
    return minuteData;
  } catch (error) {
    console.error('获取分时数据错误:', error);
    throw new Error('无法获取分时数据');
  }
}

/**
 * 构建股票分析提示
 * @param {string} stockCode 股票代码
 * @param {string} stockName 股票名称
 * @param {Object} dailyKData 日线数据
 * @param {Object} minuteData 分时数据
 * @param {number} recentDays 最近天数，默认30天
 * @param {number} recentMinutes 最近分钟数，默认30分钟
 * @param {Object} positionInfo 持仓信息，包含是否持仓、成本价、盈亏等
 * @param {string} availableBalance 可用金额
 * @param {Object} marketData 市场概况数据 {limit_up, limit_down, rising, falling}
 * @param {boolean} isTradingTime 是否在交易时间内
 * @returns {string} 分析提示文本
 */
/**
 * 构建风险评估部分的文本（不依赖联网搜索）
 * @param {Object} negativeNewsData 消息数据（当前为空）
 * @returns {string} 格式化的风险评估文本
 */
function buildNegativeNewsSection(negativeNewsData) {
  return '📊 风险评估：基于技术面和市场数据进行综合评估，联网消息搜索已暂时禁用';
}

export function buildStockAnalysisPrompt(
  stockCode,
  stockName,
  dailyKData,
  minuteData,
  recentDays = 30,
  recentMinutes = 30,
  positionInfo = null,
  availableBalance = '0.00',
  marketData = null,
  stockConcepts = [],
  marketConcepts = {topRisers: [], topFallers: []},
  isTradingTime = false,
  negativeNewsData = null
) {
  let prompt = '';

  // 构建市场概况信息
  let marketInfo = '';
  if (marketData) {
    const totalStocks =
      marketData.rising +
      marketData.falling +
      marketData.limit_up +
      marketData.limit_down;
    const limitUpRatio = ((marketData.limit_up / totalStocks) * 100).toFixed(2);
    const limitDownRatio = (
      (marketData.limit_down / totalStocks) *
      100
    ).toFixed(2);
    const risingRatio = ((marketData.rising / totalStocks) * 100).toFixed(2);
    const fallingRatio = ((marketData.falling / totalStocks) * 100).toFixed(2);

    marketInfo = `
【市场概况】
- 涨停数量：${marketData.limit_up}只 (${limitUpRatio}%)
- 跌停数量：${marketData.limit_down}只 (${limitDownRatio}%)
- 上涨股票：${marketData.rising}只 (${risingRatio}%)
- 下跌股票：${marketData.falling}只 (${fallingRatio}%)
`;
  }

  // 添加交易时间信息
  const tradingTimeInfo = `
【交易时间状态】
${isTradingTime ? '✅ 当前为盘中交易时间（9:30-11:30, 13:00-15:00）' : '⏰ 当前为非交易时间（盘前、午休或盘后）'}
${isTradingTime ? '请提供当前操盘计划，可提示立即买入' : '请提供次日买入计划，操作建议为次日开盘策略'}
`;

  // 概念信息
  let conceptsInfo = '';
  if (stockConcepts && stockConcepts.length > 0) {
    conceptsInfo += `
【所属概念】
${formatConceptsToString(stockConcepts)}
`;
  }

  // 市场概念排行信息
  let marketConceptsInfo = '';
  if (marketConcepts && (marketConcepts.topRisers.length > 0 || marketConcepts.topFallers.length > 0)) {
    marketConceptsInfo += formatConceptRankingInfo(marketConcepts.topRisers, marketConcepts.topFallers);
  }

  if (positionInfo && positionInfo.isInPosition) {
    const isT1Locked =
      positionInfo.availableQuantity === 0 ||
      positionInfo.availableQuantity === '0';
    const t1Status = isT1Locked
      ? '⚠️ 今日买入（T+1锁定，不可卖出）'
      : '✅ 可正常交易';

    prompt = `【股票分析数据】${marketInfo}${tradingTimeInfo}${conceptsInfo}${marketConceptsInfo}

【持仓信息】
- 证券代码：${stockCode}
- 证券名称：${stockName}
- 持仓成本价：${positionInfo.costPrice}元
- 实际数量：${positionInfo.totalQuantity}股（${
      parseInt(positionInfo.totalQuantity) / 100
    }手）
- 可用数量：${positionInfo.availableQuantity}股（${
      parseInt(positionInfo.availableQuantity) / 100
    }手） ${t1Status}
- 当前市值：${positionInfo.marketValue}元
- 持仓盈亏：${positionInfo.profit}元
- 盈亏比例：${positionInfo.profitPercent}%
- 仓位占比：${positionInfo.positionRatio}%
- 可用资金：${availableBalance}元

【交易状态】
${isT1Locked ? '⚠️ T+1锁定 - 仅可分析明日策略' : '✅ 当前可交易'}

【市场影响】
${
  marketData
    ? `当前市场整体${
        marketData.rising > marketData.falling * 2
          ? '强势，可考虑加仓或持有'
          : marketData.falling > marketData.rising * 2
          ? '弱势，需谨慎操作'
          : '平衡，建议谨慎观望'
      }`
    : ''
}

【风险评估】
${buildNegativeNewsSection(negativeNewsData)}

【分析要求】
基于持仓数据、所属概念、市场环境和技术面分析提供：
1. 当前盈亏状态分析：${positionInfo.profit}元 (${positionInfo.profitPercent}%)
2. 所属概念板块的市场表现及影响分析
3. 操作决策（继续持有/减仓/加仓），考虑所属概念板块走势
4. 具体交易点位建议（以手为单位）
5. 止损位和目标价位
6. ${isT1Locked ? '明日' : '今日'}具体操作策略，结合所属概念板块情绪

近期日线数据（最近6个月）：`;
  } else {
    prompt = `【股票分析数据】${marketInfo}${tradingTimeInfo}${conceptsInfo}${marketConceptsInfo}

【基本信息】
- 证券代码：${stockCode}
- 证券名称：${stockName}
- 可用资金：${availableBalance}元

【所属概念】
${stockConcepts && stockConcepts.length > 0 ? formatConceptsToString(stockConcepts) : '暂无概念信息'}

【市场环境】
${
  marketData
    ? `当前市场${
        marketData.rising > marketData.falling * 2
          ? '强势，可考虑积极建仓'
          : marketData.falling > marketData.rising * 2
          ? '弱势，建议谨慎观望'
          : '平衡，可适度参与'
      }
- 涨停家数：${marketData.limit_up}只，显示市场热度${
        marketData.limit_up > 100
          ? '较高'
          : marketData.limit_up > 50
          ? '适中'
          : '较低'
      }
- 跌停家数：${marketData.limit_down}只，显示市场风险${
        marketData.limit_down > 20
          ? '较高'
          : marketData.limit_down > 10
          ? '适中'
          : '较低'
      }`
    : ''
}

【风险评估】
${buildNegativeNewsSection(negativeNewsData)}

【分析要求】
基于当前数据、所属概念、市场环境和技术面分析提供：
1. 当前价位是否适合建仓，考虑所属概念板块表现
2. 所属概念板块的市场热度及对该股的影响
3. 建议买入股数（手数），结合所属概念板块走势
4. 买入金额和仓位比例
5. 止损位设置，考虑所属概念板块风险
6. 目标价位和止盈策略
7. 今日具体操作点位建议，结合所属概念板块情绪

近期日线数据（最近6个月）：`;
  }

  // 添加日线数据
  if (dailyKData && dailyKData[stockCode]) {
    const dailyData = dailyKData[stockCode];
    const dates = Object.keys(dailyData).sort().slice(-recentDays);

    prompt += '日期\t\t开盘价\t收盘价\t昨收价\t成交量\t成交额\n';
    dates.forEach((date) => {
      const day = dailyData[date];
      prompt += `${date}\t${day.OPEN || 'N/A'}\t${day.CLOSE || 'N/A'}\t${
        day.PRE || 'N/A'
      }\t${day.VOL || 'N/A'}\t${day.money || 'N/A'}\n`;
    });
  } else {
    prompt += '(日线数据获取失败)\n';
  }

  // 添加分时数据
  prompt += '\n今日分时数据：\n';
  if (minuteData && minuteData[stockCode]) {
    const minuteEntries = Object.entries(minuteData[stockCode]);
    prompt += '时间\t\t价格\t成交量\t成交额\t涨跌幅\n';
    minuteEntries.forEach(([time, data]) => {
      prompt += `${time}\t${data.NEW || data.JUNJIA || 'N/A'}\t${
        data.VOL || 'N/A'
      }\t${data.money || 'N/A'}\t${data.changePercent || 'N/A'}%\n`;
    });
  } else {
    prompt += '(分时数据获取失败)\n';
  }

  prompt += `

【分析要求】
请基于以上数据，提供简洁的交易建议，重点突出，适合快速决策。`;

  return prompt;
}

/**
 * 执行股票分析
 * @param {string} stockCode 股票代码
 * @param {string} stockName 股票名称
 * @param {Object} options 分析选项
 * @param {Object} positionData 持仓数据数组
 * @param {Object} marketData 市场概况数据 {limit_up, limit_down, rising, falling}
 * @returns {Promise<Object>} 分析结果
 */
export async function performStockAnalysis(
  stockCode,
  stockName,
  options = {},
  positionData = [],
  marketData = null,
  marketConcepts = {topRisers: [], topFallers: []}
) {
  const { months = 6, recentDays = 30, recentMinutes = 30 } = options;

  try {
    // 获取数据（暂时禁用联网搜索功能）
    const [dailyKData, minuteData, stockConcepts, isTradingTime] = await Promise.all([
      getHistoricalKLineData(stockCode, months),
      getIntradayData(stockCode),
      getStockConcepts(stockCode),
      isTradeTime().catch(() => false) // 如果API调用失败，默认非交易时间
    ])

    // 暂时禁用联网搜索，使用默认空数据
    const negativeNewsData = {
      stockCode,
      stockName,
      monthsBack: 1,
      totalResults: 0,
      negativeNews: [],
      summary: '联网搜索功能已暂时禁用'
    };

    // 检查是否持仓
    const positionInfo = checkStockPosition(stockCode, positionData);

    // 获取可用金额
    let availableBalance = '0.00';
    try {
      const storedData = localStorage.getItem('available_balance');
      if (storedData) {
        const balanceData = JSON.parse(storedData);
        availableBalance = balanceData['可用金额']
          ? parseFloat(balanceData['可用金额']).toFixed(2)
          : '0.00';
      }
    } catch (error) {
      console.error('获取可用金额失败:', error);
    }

    // 构建分析提示
    const analysisPrompt = buildStockAnalysisPrompt(
      stockCode,
      stockName,
      dailyKData,
      minuteData,
      recentDays,
      recentMinutes,
      positionInfo,
      availableBalance,
      marketData,
      stockConcepts,
      marketConcepts,
      isTradingTime,
      negativeNewsData
    );

    // 调用AI分析（使用system prompt）
    const response = await sendMessage(
      DEEPSEEK_API_KEY,
      DEEPSEEK_MODEL,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: analysisPrompt },
      ],
      0.7
    );

    return {
      success: true,
      stockCode,
      stockName,
      analysis: response.content,
      data: {
        dailyKData,
        minuteData,
      },
      // 联网搜索功能已暂时禁用
    };
  } catch (error) {
    console.error('股票分析失败:', error);
    return {
      success: false,
      error: error.message,
      stockCode,
      stockName,
    };
  }
}

/**
 * 批量分析股票
 * @param {Array} stocks 股票数组 [{code, name}]
 * @param {Object} options 分析选项
 * @param {Array} positionData 持仓数据数组
 * @returns {Promise<Array>} 分析结果数组
 */
export async function batchAnalyzeStocks(
  stocks,
  options = {},
  positionData = [],
  marketData = null,
  marketConcepts = {topRisers: [], topFallers: []}
) {
  const results = [];

  for (const stock of stocks) {
    try {
      const result = await performStockAnalysis(
        stock.code,
        stock.name,
        options,
        positionData,
        marketData,
        marketConcepts
      );
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        stockCode: stock.code,
        stockName: stock.name,
      });
    }
  }

  return results;
}

/**
 * 格式化股票代码
 * @param {string} code 原始股票代码
 * @returns {string} 格式化后的代码
 */
export function formatStockCode(code) {
  if (!code) return '';

  // 处理不同格式的股票代码
  return code.replace(':', '').replace(/\D/g, '');
}

/**
 * 检查股票是否持仓
 * @param {string} stockCode 股票代码
 * @param {Array} positionData 持仓数据数组
 * @returns {Object} 持仓信息对象
 */
export function checkStockPosition(stockCode, positionData = []) {
  if (!positionData || positionData.length === 0) {
    return { isInPosition: false };
  }

  // 标准化股票代码格式，移除前缀和特殊字符
  const normalizeCode = (code) => {
    return code.toString().replace(/[^\d]/g, '');
  };

  const normalizedTargetCode = normalizeCode(stockCode);

  // 在持仓数据中查找匹配的股票
  const position = positionData.find((pos) => {
    const posCode = pos.证券代码 || pos.code;
    return normalizeCode(posCode) === normalizedTargetCode;
  });

  if (position) {
    return {
      isInPosition: true,
      costPrice: position.成本价,
      profit: position.盈亏,
      profitPercent: position['盈亏比例(%)'],
      totalQuantity: position.实际数量,
      availableQuantity: position.可用余额,
      marketValue: position.市值,
      positionRatio: position['仓位占比(%)'],
    };
  }

  return { isInPosition: false };
}

/**
 * 获取市场ID
 * @param {string} stockCode 股票代码
 * @returns {string} 市场ID
 */
export function getMarketId(stockCode) {
  if (!stockCode) return '33'; // 默认创业板

  // 根据股票代码前缀判断市场
  const code = stockCode.toString();
  if (code.startsWith('6')) return '1'; // 上海主板
  if (code.startsWith('0')) return '33'; // 深圳主板
  if (code.startsWith('3')) return '33'; // 创业板

  return '33';
}

/**
 * 获取股票所属概念信息
 * @param {string} stockCode 股票代码
 * @returns {Promise<Array>} 概念信息数组
 */
export async function getStockConcepts(stockCode) {
  try {
    const response = await axios.get(
      `https://www.wttiao.com/moni/concepts/getConceptsByStock?stockCode=${stockCode}`
    );
    
    if (response.data && response.data.code === 0 && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    
    return [];
  } catch (error) {
    console.error('获取股票概念信息失败:', error);
    return [];
  }
}

/**
 * 格式化概念信息为字符串
 * @param {Array} concepts 概念数组
 * @returns {string} 格式化后的概念信息
 */
export function formatConceptsToString(concepts) {
  if (!concepts || concepts.length === 0) {
    return '暂无概念信息';
  }
  
  return concepts.map(concept => concept.conceptName).join('、');
}

/**
 * 格式化概念排行信息
 * @param {Array} topRisers 涨幅前十概念
 * @param {Array} topFallers 跌幅前十概念
 * @returns {string} 格式化后的概念排行信息
 */
export function formatConceptRankingInfo(topRisers, topFallers) {
  let info = '';
  
  if (topRisers && topRisers.length > 0) {
    info += '\n【涨幅前十概念】\n';
    topRisers.forEach((concept, index) => {
      info += `${index + 1}. ${concept.name} (${concept.changePercent}%)\n`;
    });
  }
  
  if (topFallers && topFallers.length > 0) {
    info += '\n【跌幅前十概念】\n';
    topFallers.forEach((concept, index) => {
      info += `${index + 1}. ${concept.name} (${concept.changePercent}%)\n`;
    });
  }
  
  return info;
}
