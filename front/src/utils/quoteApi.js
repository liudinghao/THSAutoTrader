/**
 * 股票行情相关 API
 */

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
 *   1752629400: {JUNJIA: "1.4090", NEW: "1.4090", VOL: "17104500.000", money: "24100241.000"}
 *   1752629460: {JUNJIA: "1.4118", NEW: "1.4170", VOL: "108021700.000", money: "152508600.000"}
 * },
 * "20:513050": {
 *   1752629400: {JUNJIA: "1.4090", NEW: "1.4090", VOL: "17104500.000", money: "24100241.000"}
 *   1752629460: {JUNJIA: "1.4118", NEW: "1.4170", VOL: "108021700.000", money: "152508600.000"}
 * }
 * }
 * 1752629400 是时间戳，单位是秒
 */
export async function fetchMinuteData(stockCodes, date = null) {
  return new Promise((resolve, reject) => {
    // 如果没有指定日期，使用当前日期
    const targetDate =
      date || new Date().toISOString().slice(0, 10).replace(/-/g, '');

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
              console.log('fetchMinuteData: 获取分时数据完成', parsedData);
              resolve(parsedData);
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
        type: ['NEW', 'ZHANGDIEFU'],
        period: 'now',
      },
      callbackName: 'onready',
      success: (data) => {
        // 第二步：获取详细数据
        window.API.use({
          method: 'Quote.getData2',
          data: {
            code: stockCodes,
            type: ['NEW', 'ZHANGDIEFU'],
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
        console.error('请求实时行情数据失败:', error);
        reject(error);
      },
      notClient: () => {
        console.error('API客户端不可用');
        reject(new Error('API客户端不可用'));
      },
    });
  });
}
