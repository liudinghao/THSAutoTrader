import axios from 'axios';
import { indexedDBUtil, STORE_NAMES } from '../utils/indexedDB';

const BASE_URL = 'http://localhost:5000';

// 获取资产信息（可用金额等）
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
        // 对缓存数据也进行过滤
        return filterActivePositions(cachedData.data);
      }
    }

    // 从接口获取数据
    const response = await axios.get(`${BASE_URL}/position`);
    if (response.data.status === 'success') {
      const data = response.data.data;
      
      // 过滤掉实际数量为0的股票（已卖出的股票）
      const filteredData = filterActivePositions(data);
      
      // 保存原始数据到缓存（保留完整数据）
      await indexedDBUtil.saveData(STORE_NAMES.POSITION_DATA, data);
      
      // 返回过滤后的数据
      return filteredData;
    }
    throw new Error('接口返回状态异常');
  } catch (error) {
    console.error('获取持仓信息失败:', error);
    throw error;
  }
};

/**
 * 过滤活跃持仓（实际数量大于0）
 * @param {Array} positions 原始持仓数据
 * @returns {Array} 过滤后的持仓数据
 */
const filterActivePositions = (positions) => {
  if (!Array.isArray(positions)) return [];
  
  return positions.filter(position => {
    const quantity = parseFloat(position.股票余额 || 0);
    return quantity > 0;
  });
};
