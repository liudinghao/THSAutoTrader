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
