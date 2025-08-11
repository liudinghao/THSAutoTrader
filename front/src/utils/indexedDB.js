const DB_NAME = 'THSAutoTrader';
const DB_VERSION = 3;
const STORES = {
  ASSET_INFO: 'assetInfo',
  POSITION_DATA: 'positionData',
  KLINE_DATA: 'klineData',
  ANALYSIS_RESULTS: 'analysisResults',
};

class IndexedDBUtil {
  constructor() {
    this.db = null;
  }

  // 初始化数据库
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        reject('数据库打开失败');
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // 创建资产信息存储
        if (!db.objectStoreNames.contains(STORES.ASSET_INFO)) {
          db.createObjectStore(STORES.ASSET_INFO, { keyPath: 'id' });
        }
        // 创建持仓数据存储
        if (!db.objectStoreNames.contains(STORES.POSITION_DATA)) {
          db.createObjectStore(STORES.POSITION_DATA, { keyPath: 'id' });
        }
        // 创建 K 线数据存储
        if (!db.objectStoreNames.contains(STORES.KLINE_DATA)) {
          db.createObjectStore(STORES.KLINE_DATA, { keyPath: 'code' });
        }
        // 创建分析结果存储
        if (!db.objectStoreNames.contains(STORES.ANALYSIS_RESULTS)) {
          db.createObjectStore(STORES.ANALYSIS_RESULTS, { keyPath: 'stockCode' });
        }
      };
    });
  }

  // 保存数据
  async saveData(storeName, data, key = 1) {
    if (!this.db) {
      await this.init();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      let record;
      if (storeName === STORES.KLINE_DATA) {
        record = { code: key, data, timestamp: Date.now() };
      } else if (storeName === STORES.ANALYSIS_RESULTS) {
        record = { stockCode: key, ...data, timestamp: Date.now() };
      } else {
        record = { id: key, data, timestamp: Date.now() };
      }
      
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject('数据保存失败');
    });
  }

  // 获取数据
  async getData(storeName, key = 1) {
    if (!this.db) {
      await this.init();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject('数据获取失败');
    });
  }

  // 检查数据是否过期（默认5分钟）
  isDataExpired(timestamp, maxAge = 5 * 60 * 1000) {
    // 返回 false 表示数据永不过期
    return false;
  }
}

// 创建实例
export const indexedDBUtil = new IndexedDBUtil();
export const STORE_NAMES = STORES;
export { DB_NAME, DB_VERSION };

// 保存分析结果
export const saveAnalysisResult = async (stockCode, result) => {
  try {
    await indexedDBUtil.saveData(STORES.ANALYSIS_RESULTS, result, stockCode);
  } catch (error) {
    console.error('保存分析结果失败:', error);
    throw error;
  }
};

// 获取分析结果
export const getAnalysisResult = async (stockCode) => {
  try {
    const result = await indexedDBUtil.getData(STORES.ANALYSIS_RESULTS, stockCode);
    // 分析结果存储时已经展开，直接返回
    return result || null;
  } catch (error) {
    console.error('获取分析结果失败:', error);
    return null;
  }
};

// 获取所有分析结果
export const getAllAnalysisResults = async () => {
  try {
    if (!indexedDBUtil.db) {
      await indexedDBUtil.init();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = indexedDBUtil.db.transaction([STORES.ANALYSIS_RESULTS], 'readonly');
      const store = transaction.objectStore(STORES.ANALYSIS_RESULTS);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = {};
        request.result.forEach(item => {
          results[item.stockCode] = item;
        });
        resolve(results);
      };
      
      request.onerror = () => reject('获取所有分析结果失败');
    });
  } catch (error) {
    console.error('获取所有分析结果失败:', error);
    return {};
  }
};
