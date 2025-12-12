import axios from 'axios';

const SEARCH_BASE_URL = 'https://www.wttiao.com/moni/quote';
const LIMIT_UP_BASE_URL = 'https://www.wttiao.com/moni/ztpool';

/**
 * 搜索股票（支持代码或名称模糊搜索）
 * @param {string} keyword - 搜索关键词（股票代码或名称）
 * @returns {Promise<Array>} 股票列表
 */
export const searchStock = async (keyword) => {
  try {
    if (!keyword || keyword.trim() === '') {
      return [];
    }

    const response = await axios.get(`${SEARCH_BASE_URL}/search`, {
      params: { keyword: keyword.trim() }
    });

    if (response.data.code === 0 && Array.isArray(response.data.data)) {
      return response.data.data.map(item => ({
        code: item.code,
        name: item.name,
        marketId: item.marketId
      }));
    }

    return [];
  } catch (error) {
    console.error('搜索股票失败:', error);
    return [];
  }
};

/**
 * 获取股票最近涨停原因
 * @param {string} code - 股票代码
 * @returns {Promise<Object|null>} 涨停信息
 */
export const getRecentLimitUp = async (code) => {
  try {
    if (!code || code.trim() === '') {
      return null;
    }

    const response = await axios.get(`${LIMIT_UP_BASE_URL}/recent-limit-up/`, {
      params: { code: code.trim() }
    });

    if (response.data.code === 0 && response.data.data) {
      return {
        code: response.data.data.code,
        name: response.data.data.name,
        price: response.data.data.price,
        zdf: response.data.data.zdf,
        firstZtTime: response.data.data.first_zt_time,
        lastZtTime: response.data.data.last_zt_time,
        date: response.data.data.date,
        reasonType: response.data.data.reason_type,
        limitUpType: response.data.data.limit_up_type,
        zttjDays: response.data.data.zttj_days,
        zttjCt: response.data.data.zttj_ct
      };
    }

    return null;
  } catch (error) {
    console.error('获取涨停原因失败:', error);
    return null;
  }
};
