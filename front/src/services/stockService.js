import { registerPush, unregisterPush } from '../utils/quoteApi';
import { debounce, throttle } from 'lodash-es';
import { indexedDBUtil, STORE_NAMES } from '../utils/indexedDB';

export class StockService {
  constructor() {
    this.quoteSessionId = null;
    this.klineDataCache = new Map();
    this.klineDataLoading = new Set();
    this.updateQueue = new Set();
    this.updateTimer = null;
  }

  // 从IndexedDB获取K线数据
  async getKLineDataFromDB(code) {
    try {
      const data = await indexedDBUtil.getData(STORE_NAMES.KLINE_DATA, code);
      if (data) {
        // 检查数据是否过期（超过15分钟）
        const now = new Date().getTime();
        if (now - data.timestamp < 15 * 60 * 1000) {
          return data.data;
        }
      }
      return null;
    } catch (error) {
      console.error('从IndexedDB获取K线数据失败:', error);
      return null;
    }
  }

  // 保存K线数据到IndexedDB
  async saveKLineDataToDB(code, klineData) {
    try {
      await indexedDBUtil.saveData(STORE_NAMES.KLINE_DATA, klineData, code);
    } catch (error) {
      console.error('保存K线数据到IndexedDB失败:', error);
    }
  }

  // 获取龙头股票数据
  async fetchDragonStocks() {
    const response = await fetch(
      'https://www.wttiao.com/moni/ztpool/dragonCallback'
    );
    const result = await response.json();

    if (result.code === 0 && result.data && Array.isArray(result.data)) {
      return result.data.map((item) => ({
        code: item.code,
        name: item.name,
        date: item.date,
        zttj_days: item.zttj_days,
        zttj_ct: item.zttj_ct,
        reason_type: item.reason_type || '',
        price: null,
        change: null,
      }));
    }
    throw new Error(result.msg || '获取数据失败');
  }

  // 获取K线数据
  async fetchKLineData(code) {
    try {
      // 1. 先检查内存缓存
      if (this.klineDataCache.has(code)) {
        return this.klineDataCache.get(code);
      }

      // 2. 检查IndexedDB缓存
      const dbData = await this.getKLineDataFromDB(code);
      if (dbData) {
        this.klineDataCache.set(code, dbData);
        return dbData;
      }

      // 3. 从API获取新数据
      const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;
      const date = new Date();
      const endDate = `${date.getFullYear()}${String(
        date.getMonth() + 1
      ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

      const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1%2Cf2%2Cf3%2Cf4%2Cf5%2Cf6&fields2=f51%2Cf52%2Cf53%2Cf54%2Cf55%2Cf56%2Cf57%2Cf58%2Cf59%2Cf60%2Cf61&klt=101&fqt=1&end=${endDate}&lmt=30`;

      const response = await fetch(url);
      const result = await response.json();

      if (result.rc === 0 && result.data && result.data.klines) {
        const klineData = result.data.klines
          .map((item) => {
            const [date, open, close, high, low] = item.split(',');
            return {
              date,
              value: [
                parseFloat(open),
                parseFloat(close),
                parseFloat(low),
                parseFloat(high),
              ],
            };
          })
          .filter(
            (item) =>
              !isNaN(item.value[0]) &&
              !isNaN(item.value[1]) &&
              !isNaN(item.value[2]) &&
              !isNaN(item.value[3])
          );

        if (klineData.length > 0) {
          // 4. 保存到内存缓存
          this.klineDataCache.set(code, klineData);
          // 5. 保存到IndexedDB
          await this.saveKLineDataToDB(code, klineData);
          return klineData;
        }
      }
      return [];
    } catch (error) {
      console.error('获取K线数据失败:', error);
      return [];
    }
  }

  // 注册行情推送
  registerQuotePush(stockCodes, callback) {
    if (stockCodes.length === 0) return;

    if (this.quoteSessionId) {
      unregisterPush(this.quoteSessionId);
    }

    this.quoteSessionId = registerPush(stockCodes, debounce(callback, 100));
    return this.quoteSessionId;
  }

  // 取消行情推送
  unregisterQuotePush() {
    if (this.quoteSessionId) {
      unregisterPush(this.quoteSessionId);
      this.quoteSessionId = null;
    }
  }

  // 加载K线数据
  loadKLineData = throttle(async function (stocks, updateCallback) {
    if (!stocks || !stocks.length) return;

    const stockCodes = stocks.map((stock) => stock.code);

    const klineDataPromises = stockCodes.map(async (code) => {
      try {
        const klineData = await this.fetchKLineData(code);

        if (!klineData || !klineData.length) return;

        const latestPrice = klineData[klineData.length - 1]?.value[1];
        const prevPrice = klineData[klineData.length - 2]?.value[1];

        if (latestPrice && prevPrice) {
          const change = Number(
            (((latestPrice - prevPrice) / prevPrice) * 100).toFixed(2)
          );

          updateCallback(code, {
            klineData,
            price: latestPrice,
            change,
          });
        }
      } catch (error) {
        console.error(`获取股票${code}的K线数据失败:`, error);
      }
    });

    await Promise.all(klineDataPromises);
  }, 200);

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
  async fetchMinuteData(stockCodes, date = null) {
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
              time: {
                begin: targetDate,
                end: targetDate,
                timeFmt: 1,
              },
            },
            success: (data) => {
              try {
                const parsedData = JSON.parse(data);
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

  // 获取单个股票的分时数据
  async fetchSingleStockMinuteData(marketId, stockCode, date = null) {
    const fullCode = `${marketId}:${stockCode}`;
    return this.fetchMinuteData([fullCode], date);
  }

  // 获取多个股票的分时数据
  async fetchMultipleStocksMinuteData(stockList, date = null) {
    const stockCodes = stockList.map(
      (stock) => `${stock.marketId}:${stock.code}`
    );
    return this.fetchMinuteData(stockCodes, date);
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
  async fetchRealTimeQuote(stockCodes) {
    return new Promise((resolve, reject) => {
      // 第一步：请求实时行情数据
      window.API.use({
        method: 'Quote.request',
        data: {
          code: stockCodes,
          type: ['NEW', 'PRE', 'ZHANGDIEFU'],
          period: 'now',
        },
        callbackName: 'onready',
        success: (data) => {
          // 第二步：获取详细数据
          window.API.use({
            method: 'Quote.getData2',
            data: {
              code: stockCodes,
              type: ['NEW', 'PRE', 'ZHANGDIEFU'],
              period: 'now',
              mode: 'after',
            },
            success: (res) => {
              try {
                const parsedData = JSON.parse(res);
                resolve(parsedData);
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

  // 清理资源
  dispose() {
    this.unregisterQuotePush();
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    this.klineDataCache.clear();
    this.klineDataLoading.clear();
    this.updateQueue.clear();
  }
}

export const stockService = new StockService();
