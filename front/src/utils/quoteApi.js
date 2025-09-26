/**
 * 股票行情相关 API
 */

/**
 * 时间戳转换工具函数
 * @param {number|string} timestamp 时间戳（秒）
 * @param {string} format 输出格式，默认为 'HH:mm:00'
 * @returns {string} 格式化后的时间字符串
 */
export function formatTimestamp(timestamp, format = 'HH:mm:00') {
  const date = new Date(parseInt(timestamp) * 1000);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return format
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 将时间戳转换为 HH:mm:00 格式（与时间轴格式保持一致）
 * @param {number|string} timestamp 时间戳（秒）
 * @returns {string} 格式化的时间字符串，如 "14:30:00"
 */
export function timestampToTimeString(timestamp) {
  return formatTimestamp(timestamp, 'HH:mm:00');
}

/**
 * 将时间戳转换为完整的日期时间格式
 * @param {number|string} timestamp 时间戳（秒）
 * @returns {string} 格式化的时间字符串，如 "2024-01-01 14:30:00"
 */
export function timestampToDateTime(timestamp) {
  const date = new Date(parseInt(timestamp) * 1000);
  return date
    .toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(/\//g, '-');
}

/**
 * 跳转到分时图
 * @param {string} code 代码
 * @param {string[]} stockCode 跟踪代码数组
 */
export function jumpToQuote(code, stockCode) {
  API.use({
    method: 'Quote.syncStockList',
    data: {
      id: 379, // 379为分时图，65为k线
      code: code,
      period: '8192',
      stocklist: stockCode.join('|'),
    },
    success: function (result) {},
  });
}

/**
 * 注册推送
 * @param {string[]} codes 股票代码数组
 * @param {Function} callback 回调函数
 * @returns {string} quoteSessionId 会话ID
 */
export function registerPush(codes, callback) {
  var quoteSessionId = window.API.createSessionId('Quote');
  console.log('quoteSessionId:', quoteSessionId);
  window.API.use({
    method: 'Quote.registerPush',
    data: { code: codes.join(',') },
    sessionId: quoteSessionId,
    persistent: true,
    callbackName: 'onready',
    success: function (data) {
      window.API.use({
        method: 'Quote.getData2',
        data: {
          code: codes.join(','),
          type: ['NEW', 'ZHANGDIEFU', 'ZHANGSHU'],
          period: 'now',
          mode: 'after',
        },
        success: function (data) {
          const stockData = JSON.parse(data);
          console.log('registerPush:', data);
          callback(stockData);
        },
      });
    },
  });
  return quoteSessionId;
}

/**
 * 取消推送
 * @param {string} sessionId 会话ID
 */
export function unregisterPush(sessionId) {
  window.API.use({
    method: 'Quote.unregisterPush',
    sessionId: sessionId,
    success: function (data) {
      sessionId = null;
      // 通知
      customLog('取消监听成功');
    },
  });
}

/**
 * 获取自选股列表
 * @returns {Promise} 返回自选股列表的Promise
 */
export function getSelfStocks() {
  return new Promise((resolve, reject) => {
    window.API.use({
      method: 'Passport.selfStocks',
      success: function (stocklist) {
        resolve(stocklist);
      },
      error: function (error) {
        reject(error);
      },
    });
  });
}

/**
 * 添加自选股
 * @param {string[]} code 股票代码
 * @returns {Promise} 返回操作结果的Promise
 */
export function addSelfStock(code) {
  return new Promise((resolve, reject) => {
    window.API.use({
      method: 'Quote.setSelfStock',
      data: {
        mode: 'add',
        code: code.join(','),
      },
      success: function (result) {
        resolve(result);
      },
      error: function (error) {
        reject(error);
      },
    });
  });
}

/**
 * 删除自选股
 * @param {string[]} code 股票代码
 * @returns {Promise} 返回操作结果的Promise
 */
export function removeSelfStock(code) {
  return new Promise((resolve, reject) => {
    window.API.use({
      method: 'Quote.setSelfStock',
      data: {
        mode: 'del',
        code: code.join(','),
      },
      success: function (result) {
        resolve(result);
      },
      error: function (error) {
        reject(error);
      },
    });
  });
}

/**
 * 根据概念代码获取股票列表
 * @param {string} conceptCode 概念代码
 * @returns {Promise<string[]>} 返回股票代码数组的Promise
 */
export function getStocksByConceptCode(conceptCode) {
  return new Promise((resolve, reject) => {
    window.API.use({
      method: 'Util.getBlockStockByCode',
      data: conceptCode,
      success: function (result) {
        try {
          // 返回的是逗号分隔的股票代码字符串，需要转换为数组
          const stockCodes = result.split(',').filter((code) => code.trim());
          console.log(
            `概念 ${conceptCode} 获取到 ${stockCodes.length} 只股票:`,
            stockCodes
          );
          resolve(stockCodes);
        } catch (error) {
          reject(new Error(`解析股票代码失败: ${error.message}`));
        }
      },
      error: function (error) {
        reject(new Error(`获取概念股票失败: ${error.message}`));
      },
    });
  });
}

/*
 * 获取股票分时数据
 * 返回的数据结构为：
 * {
 * "177:HK0700": {
 *   "09:30:00": {
 *     JUNJIA: "1.4090",
 *     NEW: "1.4090",
 *     VOL: "17104500.000",
 *     money: "24100241.000",
 *     changePercent: 2.5,  // 新增：涨跌幅百分比
 *     preClose: 1.3750     // 新增：昨收价
 *   }
 *   "09:31:00": {
 *     JUNJIA: "1.4118",
 *     NEW: "1.4170",
 *     VOL: "108021700.000",
 *     money: "152508600.000",
 *     changePercent: 3.05, // 新增：涨跌幅百分比
 *     preClose: 1.3750     // 新增：昨收价
 *   }
 * }
 * }
 * 注意：
 * 1. 时间键已转换为 HH:mm:00 格式，无需再次转换
 * 2. VOL 和 money 字段已经过处理，第一个数据点的成交量和成交额保持不变，后续数据点的成交量和成交额已计算为增量值
 * 3. 新增 changePercent 字段：涨跌幅百分比，保留2位小数
 * 4. 新增 preClose 字段：昨收价，用于计算涨跌幅
 */
export async function fetchMinuteData(stockCodes, date = null) {
  return new Promise(async (resolve, reject) => {
    try {
      // 如果没有指定日期，使用最近交易日
      const targetDate = date || await getLatestTradeDate();
      // 首先获取昨收价
      const preCloseData = {};
      try {
        const historyData = await fetchHistoryData(
          stockCodes,
          targetDate,
          targetDate
        );
        for (const [stockCode, stockData] of Object.entries(historyData)) {
          if (stockData && stockData[targetDate] && stockData[targetDate].PRE) {
            preCloseData[stockCode] = parseFloat(stockData[targetDate].PRE);
          }
        }
      } catch (error) {
        console.warn('获取昨收价失败，将使用默认值:', error, stockCodes, targetDate);
      }

      // 第一步：请求分时数据
      window.API.use({
        method: 'Quote.request',
        data: {
          code: stockCodes,
          type: ['NEW', 'VOL', 'JUNJIA', 'money', 'ZHANGDIEFU'],
          period: 'min',
          begin: targetDate,
          withmarket: false,
          end: targetDate,
          timeFmt: 1,
        },
        success: (data) => {
          // 第二步：获取详细数据
          window.API.use({
            method: 'Quote.getData2',
            data: {
              code: stockCodes,
              withmarket: false,
              type: ['NEW', 'VOL', 'JUNJIA', 'money', 'ZHANGDIEFU'],
              period: 'min',
              timeStamp: 1,
              updateMode: 1,
              time: {
                begin: targetDate,
                end: targetDate,
                timeFmt: 1,
              },
            },
            success: (data) => {
              try {
                const parsedData = JSON.parse(data);
                console.log(
                  'fetchMinuteData: 获取分时原始数据完成',
                  parsedData
                );

                // 处理成交量计算
                const processedData = {};
                for (const [stockCode, timeData] of Object.entries(
                  parsedData
                )) {
                  const processedTimeData = {};
                  const entries = Object.entries(timeData);
                  entries.forEach(([timestamp, values], index) => {
                    // 计算成交量：第一个数据保持不变，后续数据等于当前数据减去上一个数据
                    let calculatedVol = parseFloat(values.VOL || 0);
                    if (index > 0) {
                      const prevValues = entries[index - 1][1];
                      const prevVol = parseFloat(prevValues.VOL || 0);
                      calculatedVol = Math.max(0, calculatedVol - prevVol); // 确保不为负数
                    }

                    // 计算成交额：第一个数据保持不变，后续数据等于当前数据减去上一个数据
                    let calculatedMoney = parseFloat(values.money || 0);
                    if (index > 0) {
                      const prevValues = entries[index - 1][1];
                      const prevMoney = parseFloat(prevValues.money || 0);
                      calculatedMoney = Math.max(
                        0,
                        calculatedMoney - prevMoney
                      ); // 确保不为负数
                    }

                    // 直接转换时间戳为时间字符串
                    const timeStr = timestampToTimeString(timestamp);

                    // 计算涨跌幅
                    const currentPrice = parseFloat(
                      values.NEW || values.JUNJIA || 0
                    );
                    const preClose = preCloseData[stockCode];
                    let changePercent = 0;
                    if (preClose && preClose > 0) {
                      changePercent =
                        ((currentPrice - preClose) / preClose) * 100;
                    }

                    processedTimeData[timeStr] = {
                      ...values,
                      VOL: calculatedVol.toString(), // 使用计算后的成交量
                      money: calculatedMoney.toString(), // 使用计算后的成交额
                      changePercent: parseFloat(changePercent.toFixed(2)), // 涨跌幅百分比，保留2位小数
                      preClose: preClose || null, // 昨收价
                    };
                  });

                  processedData[stockCode] = processedTimeData;
                }

                resolve(processedData);
              } catch (error) {
                console.error('解析分时数据失败:', error);
                reject(error);
              }
            },
            error: (error) => {
              console.error('获取分时详细数据失败:', error);
              reject(error);
            },
            notClient: () => {
              console.error('API客户端不可用');
              reject(new Error('API客户端不可用'));
            },
          });
        },
        error: (error) => {
          console.error('请求分时数据失败:', error);
          reject(error);
        },
        notClient: () => {
          console.error('API客户端不可用');
          reject(new Error('API客户端不可用'));
        },
      });
    } catch (error) {
      console.error('fetchMinuteData 执行失败:', error);
      reject(error);
    }
  });
}

/**
 *获取实时行情数据
 * stockCodes 支持以下格式：
 * - 单个股票代码字符串: '33:301357'
 * - 股票代码数组: ['33:301357', '20:513050']
 * 返回格式：
 * {"33:301357":{"NEW":"80.7200","PRE":"50.0000","ZHANGDIEFU":"6.5892"}}
 * @param {*} stockCodes
 * @returns
 */
export async function fetchRealTimeQuote(stockCodes) {
  return new Promise((resolve, reject) => {
    // 第一步：请求实时行情数据
    window.API.use({
      method: 'Quote.request',
      data: {
        code: stockCodes,
        type: ['NEW', 'ZHANGDIEFU', 'OPEN'],
        period: 'now',
      },
      callbackName: 'onready',
      success: (data) => {
        // 第二步：获取详细数据
        window.API.use({
          method: 'Quote.getData2',
          data: {
            code: stockCodes,
            type: ['NEW', 'ZHANGDIEFU', 'OPEN'],
            period: 'now',
            mode: 'after',
          },
          success: (res) => {
            try {
              const parsedData = JSON.parse(res);

              // 通过NEW和ZHANGDIEFU计算昨收价
              const processedData = {};
              for (const [code, data] of Object.entries(parsedData)) {
                const newPrice = parseFloat(data.NEW);
                const zhangdiefu = parseFloat(data.ZHANGDIEFU);

                // 计算昨收价：昨收价 = 当前价格 / (1 + 涨跌幅/100)
                let prePrice = null;
                if (!isNaN(newPrice) && !isNaN(zhangdiefu)) {
                  prePrice = newPrice / (1 + zhangdiefu / 100);
                  prePrice = parseFloat(prePrice.toFixed(4)); // 保留4位小数
                }

                processedData[code] = {
                  NEW: data.NEW,
                  PRE: prePrice ? prePrice.toString() : null,
                  ZHANGDIEFU: data.ZHANGDIEFU,
                  OPEN: data.OPEN,
                };
              }

              resolve(processedData);
            } catch (error) {
              console.error('解析实时行情数据失败:', error);
              reject(error);
            }
          },
          error: (error) => {
            console.error('获取实时行情详细数据失败:', error);
            reject(error);
          },
          notClient: () => {
            console.error('API客户端不可用');
            reject(new Error('API客户端不可用'));
          },
        });
      },
      error: (error) => {
        console.error('请求实时行情数据失败:', error, stockCodes);
        reject(error);
      },
      notClient: () => {
        console.error('API客户端不可用');
        reject(new Error('API客户端不可用'));
      },
    });
  });
}

/**
 * 获取历史行情数据
 * @param {string|string[]} stockCodes 股票代码，支持单个字符串或数组
 * @param {string} beginDate 开始日期，格式：YYYYMMDD，如：20250711
 * @param {string} endDate 结束日期，格式：YYYYMMDD，如：20250714
 * @returns {Promise<Object>} 返回历史行情数据的Promise
 *
 * 返回数据格式示例：
 * {
 *   "33:300033": {
 *     "20250711": {
 *       "CLOSE": "287.2500",    // 收盘价
 *       "OPEN": "275.0400",     // 开盘价
 *       "PRE": "275.0100",      // 昨收价
 *       "VOL": "25306788.000",  // 成交量
 *       "money": "7246381000.00" // 成交额
 *     },
 *     "20250714": {
 *       "CLOSE": "277.0800",
 *       "OPEN": "284.9200",
 *       "PRE": "287.2500",
 *       "VOL": "12702121",
 *       "money": "3532377800.00"
 *     }
 *   }
 * }
 */
export async function fetchHistoryData(stockCodes, beginDate, endDate) {
  return new Promise((resolve, reject) => {
    // 确保 stockCodes 是数组格式
    const codes = Array.isArray(stockCodes) ? stockCodes : [stockCodes];

    // 第一步：请求历史数据
    window.API.use({
      method: 'Quote.request',
      data: {
        code: codes,
        type: ['OPEN', 'CLOSE', 'PRE', 'VOL', 'money'],
        period: 'day',
        begin: beginDate,
        end: endDate,
      },
      success: function (data) {
        // 第二步：获取详细数据
        window.API.use({
          method: 'Quote.getData2',
          data: {
            code: codes,
            type: ['OPEN', 'CLOSE', 'PRE', 'VOL', 'money'],
            period: 'day',
            mode: 'after',
            time: {
              begin: beginDate,
              end: endDate,
              timeFmt: 1,
            },
            updateMode: 1, // 这个参数如果不加的话在获取新股的k涨跌幅的时候会为空
          },
          success: function (data) {
            try {
              const parsedData = JSON.parse(data);
              console.log('fetchHistoryData: 获取历史数据完成', parsedData);
              resolve(parsedData);
            } catch (error) {
              console.error('解析历史数据失败:', error);
              reject(error);
            }
          },
          error: function (error) {
            console.error('获取历史详细数据失败:', error);
            reject(error);
          },
          notClient: () => {
            console.error('API客户端不可用');
            reject(new Error('API客户端不可用'));
          },
        });
      },
      error: function (error) {
        console.error('请求历史数据失败:', error);
        reject(error);
      },
      notClient: () => {
        console.error('API客户端不可用');
        reject(new Error('API客户端不可用'));
      },
    });
  });
}

/**
 * 获取最近一个交易日
 * @param {string} date 查询日期，格式：YYYYMMDD，如：20250719，默认为当前日期
 * @returns {Promise<string>} 返回最近一个交易日的Promise
 */
export function getLatestTradeDate(date = null) {
  return new Promise((resolve, reject) => {
    // 如果没有指定日期，使用当前日期
    const targetDate =
      date || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    window.API.use({
      method: 'Quote.getSHTradeDate',
      data: targetDate,
      success: function (result) {
        resolve(result);
      },
      error: function (error) {
        console.error('获取最近交易日失败:', error);
        reject(error);
      },
      notClient: () => {
        console.error('API客户端不可用');
        reject(new Error('API客户端不可用'));
      },
    });
  });
}

/**
 * 获取上一个交易日
 * @param {string} date 查询日期，格式：YYYYMMDD，如：20250719，默认为当前日期
 * @returns {Promise<string>} 返回最近一个交易日的Promise
 */
export function getPreTradeDate(date = null) {
  return new Promise((resolve, reject) => {
    // 如果没有指定日期，使用当前日期
    const targetDate =
      date || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    window.API.use({
      method: 'Quote.getPreSHTradeDate',
      data: targetDate,
      success: function (result) {
        resolve(result);
      },
      error: function (error) {
        console.error('获取最近交易日失败:', error);
        reject(error);
      },
      notClient: () => {
        console.error('API客户端不可用');
        reject(new Error('API客户端不可用'));
      },
    });
  });
}

/**
 * 获取最近5个交易日日期列表
 * @param {string} date 起始日期，格式：YYYYMMDD，如：20250719，默认为当前日期
 * @returns {Promise<string[]>} 返回最近5个交易日日期数组的Promise，按时间倒序排列
 */
export function getPreviousTradeDates(date = null, count = 5) {
  return new Promise((resolve, reject) => {
    const targetDate = date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const dates = [];
    let currentDate = targetDate;
    
    // 递归获取前一个交易日
    const getNextDate = async () => {
      if (dates.length >= count) {
        resolve(dates); // 按时间倒序排列（最新的在前）
        return;
      }
      
      try {
        const prevDate = await getPreTradeDate(currentDate);
        if (prevDate && prevDate !== currentDate) {
          dates.push(prevDate);
          currentDate = prevDate;
          // 继续获取下一个交易日
          setTimeout(() => getNextDate(), 50); // 添加延迟避免API调用过快
        } else {
          // 无法获取更多交易日，返回已获取的
          resolve(dates);
        }
      } catch (error) {
        console.error('获取交易日失败:', error);
        reject(error);
      }
    };
    
    // 开始获取
    getNextDate();
  });
}
/**
 * 检查是否在交易时间内
 * @param {string} stockCode 股票代码，如：'300033'
 * @returns {Promise<boolean>} 返回是否在交易时间内的Promise
 */
export function isTradeTime(stockCode = '300033') {
  return new Promise((resolve, reject) => {
    window.API.use({
      method: 'Quote.isTradeTime',
      data: stockCode,
      success: function (isTradeTime) {
        console.log('是否在交易时间内:', isTradeTime);
        resolve(isTradeTime);
      },
      error: function (error) {
        console.error('检查交易时间失败:', error);
        reject(error);
      },
      notClient: () => {
        console.error('API客户端不可用');
        reject(new Error('API客户端不可用'));
      },
    });
  });
}

/**
 * 获取所有股票代码（集合竞价策略用）
 * @param {boolean} needMarket 是否需要市场信息，默认为1
 * @returns {Promise<Object[]>} 返回股票代码对象数组的Promise
 * 返回格式示例：[{code: '002402', marketId: '33'}, {code: '002418', marketId: '33'}, ...]
 */
export function getAllStockCodes(needMarket = 1) {
  return new Promise((resolve, reject) => {
    window.API.use({
      method: 'Util.getAllBlockCode',
      data: { needMarket },
      success: function (data) {
        try {
          // 返回的是逗号分隔的股票代码字符串，需要转换为对象数组
          const rawCodes = data.split(',').filter((code) => code.trim());
          const stockCodes = rawCodes.map((fullCode) => {
            const [marketId, code] = fullCode.split(':');
            return {
              code: code || '',
              marketId: marketId || ''
            };
          });
          resolve(stockCodes);
        } catch (error) {
          reject(new Error(`解析股票代码失败: ${error.message}`));
        }
      },
      error: function (error) {
        console.error('获取板块代码失败:', error);
        reject(error);
      },
      notClient: function () {
        console.error('API客户端不可用');
        reject(new Error('API客户端不可用'));
      },
    });
  });
}

/**
 * 调起下单窗口
 * @param {number} cmdStatus 下单状态：0-买入(XD_MAIRU)，1-卖出(XD_MAICHU)
 * @param {string} stockCode 股票代码，如：'002402'
 * @param {string} price 价格，可选，默认为空字符串（使用当前市价）
 * @param {string} amount 数量，可选，默认为空字符串
 * @returns {Promise<any>} 返回下单结果的Promise
 */
export function placeOrder(cmdStatus, stockCode, price = '', amount = '') {
  return new Promise((resolve, reject) => {
    const strInfo = `<?xml version="1.0" encoding="GB2312"?><RealTime StockCode="${stockCode}" Market="33"><Bid><Price Selected="1">${price}</Price><Amount>${amount}</Amount></Bid></RealTime>`;
    const info =
      'wt_startup=wt_startup=\r\nrealtime=' +
      window.btoa(unescape(encodeURIComponent(strInfo)));

    window.API.use({
      method: 'XdMgr.fastCallXiadan',
      data: {
        cmd: cmdStatus === 0 ? 'XD_MAIRU' : 'XD_MAICHU',
        code: stockCode,
        amount: amount,
        info: info,
        default: false,
        hide: false,
        select: true,
      },
      success: function (data) {
        console.log(`${cmdStatus === 0 ? '买入' : '卖出'}下单成功:`, stockCode, data);
        resolve(data);
      },
      error: function (error) {
        console.error(`${cmdStatus === 0 ? '买入' : '卖出'}下单失败:`, stockCode, error);
        reject(error);
      },
      notClient: function () {
        const errorMsg = 'API客户端不可用';
        console.error(errorMsg);
        reject(new Error(errorMsg));
      },
    });
  });
}

/**
 * 判断是否为交易日
 * @returns {Promise<boolean>} 是否为交易日
 * @throws {Error} 当API调用失败时抛出错误
 */
export async function isTradingDay() {
  // 获取当前日期，格式：YYYYMMDD
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  // 获取最近一个交易日
  const latestTradeDate = await getLatestTradeDate(today)
  
  // 如果今日等于最近交易日，说明今日是交易日
  return today === latestTradeDate
}


window.getAllStockCodes = getAllStockCodes; // for debug
// 保持向后兼容性
window.getAllBlockCode = getAllStockCodes;
window.placeOrder = placeOrder; // for debug
window.getLatestTradeDate = getLatestTradeDate; // for debug
window.fetchMinuteData = fetchMinuteData; // for debug
window.fetchRealTimeQuote = fetchRealTimeQuote; // for debug
window.fetchHistoryData = fetchHistoryData;