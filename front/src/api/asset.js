import axios from 'axios';
import { indexedDBUtil, STORE_NAMES } from '../utils/indexedDB';

const BASE_URL = 'http://localhost:5000';

// 获取资产信息
export const getAssetInfo = async (forceRefresh = false) => {
  try {
    // 如果不是强制刷新，先尝试从缓存获取数据
    if (!forceRefresh) {
      const cachedData = await indexedDBUtil.getData(STORE_NAMES.ASSET_INFO);
      if (cachedData && !indexedDBUtil.isDataExpired(cachedData.timestamp)) {
        return cachedData.data;
      }
    }

    // 从接口获取数据
    const response = await axios.get(`${BASE_URL}/balance`);
    if (response.data.status === 'success') {
      const data = response.data.data;
      // 保存到缓存
      await indexedDBUtil.saveData(STORE_NAMES.ASSET_INFO, data);
      return data;
    }
    throw new Error('接口返回状态异常');
  } catch (error) {
    console.error('获取资产信息失败:', error);
    throw error;
  }
};

// 获取持仓信息
export const getPositionData = async (forceRefresh = false) => {
  try {
    // 如果不是强制刷新，先尝试从缓存获取数据
    if (!forceRefresh) {
      const cachedData = await indexedDBUtil.getData(STORE_NAMES.POSITION_DATA);
      if (cachedData && !indexedDBUtil.isDataExpired(cachedData.timestamp)) {
        return cachedData.data;
      }
    }

    // 从接口获取数据
    const response = await axios.get(`${BASE_URL}/position`);
    if (response.data.status === 'success') {
      const data = response.data.data;
      // 保存到缓存
      await indexedDBUtil.saveData(STORE_NAMES.POSITION_DATA, data);
      return data;
    }
    throw new Error('接口返回状态异常');
  } catch (error) {
    console.error('获取持仓信息失败:', error);
    throw error;
  }
};
