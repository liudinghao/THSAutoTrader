/**
 * 股票分析服务
 * 提供股票数据获取和分析功能
 */

import { fetchHistoryData, fetchMinuteData } from '../utils/quoteApi';
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
4. 提供具体操作点位和仓位建议`;

// 交易规则详情
const TRADING_RULES = {
  unit: '1手=100股',
  t1Rule: 'T+1交易制度（当日买入次日可卖）',
  minQuantity: '必须是100股整数倍',
  riskControl: '设置止损位和分批止盈'
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
 * @returns {string} 分析提示文本
 */
export function buildStockAnalysisPrompt(
  stockCode,
  stockName,
  dailyKData,
  minuteData,
  recentDays = 30,
  recentMinutes = 30,
  positionInfo = null,
  availableBalance = "0.00"
) {
  let prompt = "";

  if (positionInfo && positionInfo.isInPosition) {
    const isT1Locked =
      positionInfo.availableQuantity === 0 ||
      positionInfo.availableQuantity === "0";
    const t1Status = isT1Locked
      ? "⚠️ 今日买入（T+1锁定，不可卖出）"
      : "✅ 可正常交易";

    prompt = `【股票分析数据】

【持仓信息】
- 证券代码：${stockCode}
- 证券名称：${stockName}
- 持仓成本价：${positionInfo.costPrice}元
- 持仓数量：${positionInfo.quantity}股（${parseInt(positionInfo.quantity) / 100}手）
- 可用数量：${positionInfo.availableQuantity}股（${parseInt(positionInfo.availableQuantity) / 100}手） ${t1Status}
- 当前市值：${positionInfo.marketValue}元
- 持仓盈亏：${positionInfo.profit}元
- 盈亏比例：${positionInfo.profitPercent}%
- 仓位占比：${positionInfo.positionRatio}%
- 可用资金：${availableBalance}元

【交易状态】
${isT1Locked ? "⚠️ T+1锁定 - 仅可分析明日策略" : "✅ 当前可交易"}

【分析要求】
基于持仓数据提供：
1. 当前盈亏状态分析：${positionInfo.profit}元 (${positionInfo.profitPercent}%)
2. 操作决策（继续持有/减仓/加仓）
3. 具体交易点位建议（以手为单位）
4. 止损位和目标价位
5. ${isT1Locked ? "明日" : "今日"}具体操作策略

近期日线数据（最近6个月）：`;
  } else {
    prompt = `【股票分析数据】

【基本信息】
- 证券代码：${stockCode}
- 证券名称：${stockName}
- 可用资金：${availableBalance}元

【分析要求】
基于当前数据提供：
1. 当前价位是否适合建仓
2. 建议买入股数（手数）
3. 买入金额和仓位比例
4. 止损位设置
5. 目标价位和止盈策略
6. 今日具体操作点位建议

近期日线数据（最近6个月）：`;
  }

  // 添加日线数据
  if (dailyKData && dailyKData[stockCode]) {
    const dailyData = dailyKData[stockCode];
    const dates = Object.keys(dailyData).sort().slice(-recentDays);

    prompt += "日期\t\t开盘价\t收盘价\t昨收价\t成交量\t成交额\n";
    dates.forEach((date) => {
      const day = dailyData[date];
      prompt += `${date}\t${day.OPEN || "N/A"}\t${day.CLOSE || "N/A"}\t${day.PRE || "N/A"}\t${day.VOL || "N/A"}\t${day.money || "N/A"}\n`;
    });
  } else {
    prompt += "(日线数据获取失败)\n";
  }

  // 添加分时数据
  prompt += "\n今日分时数据：\n";
  if (minuteData && minuteData[stockCode]) {
    const minuteEntries = Object.entries(minuteData[stockCode]);
    prompt += "时间\t\t价格\t成交量\t成交额\t涨跌幅\n";
    minuteEntries.forEach(([time, data]) => {
      prompt += `${time}\t${data.NEW || data.JUNJIA || "N/A"}\t${data.VOL || "N/A"}\t${data.money || "N/A"}\t${data.changePercent || "N/A"}%\n`;
    });
  } else {
    prompt += "(分时数据获取失败)\n";
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
 * @returns {Promise<Object>} 分析结果
 */
export async function performStockAnalysis(
  stockCode,
  stockName,
  options = {},
  positionData = []
) {
  const { months = 6, recentDays = 30, recentMinutes = 30 } = options;

  try {
    // 获取数据
    const [dailyKData, minuteData] = await Promise.all([
      getHistoricalKLineData(stockCode, months),
      getIntradayData(stockCode),
    ]);

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
      availableBalance
    );

    // 调用AI分析（使用system prompt）
    const response = await sendMessage(
      DEEPSEEK_API_KEY,
      DEEPSEEK_MODEL,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: analysisPrompt }
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
  positionData = []
) {
  const results = [];

  for (const stock of stocks) {
    try {
      const result = await performStockAnalysis(
        stock.code,
        stock.name,
        options,
        positionData
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
      costPrice: position.成本价 || position.costPrice || 'N/A',
      profit: position.盈亏 || position.profit || 'N/A',
      profitPercent: position['盈亏比例(%)'] || position.profitPercent || 'N/A',
      quantity: position.股票余额 || position.quantity || 'N/A',
      marketValue: position.市值 || position.marketValue || 'N/A',
      availableQuantity:
        position.可用余额 || position.availableQuantity || 'N/A',
      positionRatio: position['仓位占比(%)'] || position.positionRatio || 'N/A',
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
