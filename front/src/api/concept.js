import axios from 'axios';
import { getStocksByConceptCode as getStocksByConceptCodeFromQuote } from '../utils/quoteApi';

// 根据概念代码获取股票列表
export const getStocksByConceptCode = async (conceptCode) => {
  try {
    return await getStocksByConceptCodeFromQuote(conceptCode);
  } catch (error) {
    console.error('获取概念股票失败:', error);
    throw new Error(`获取概念 ${conceptCode} 的股票失败: ${error.message}`);
  }
};

// 保存概念股票关系
export const saveConceptStockRelations = async (relations) => {
  try {
    const response = await axios.post(
      'https://www.wttiao.com/moni/concepts/relations',
      {
        relations: relations,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 200) {
      return response.data;
    }
    throw new Error('保存失败');
  } catch (error) {
    console.error('保存概念股票关系失败:', error);
    throw new Error(`保存概念股票关系失败: ${error.message}`);
  }
};

// 获取概念列表
export const getConceptList = async (onlyCodes = false) => {
  try {
    const response = await axios.get(
      'https://www.wttiao.com/moni/concepts/list/',
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.code === 0 && response.data.data) {
      if (onlyCodes) {
        // 只返回概念代码数组
        const conceptCodes = response.data.data.map((concept) => concept.code);
        console.log(`成功获取 ${conceptCodes.length} 个概念代码`);
        return conceptCodes;
      } else {
        // 返回完整的概念信息
        return response.data.data;
      }
    } else {
      throw new Error(response.data.msg || '获取概念列表失败');
    }
  } catch (error) {
    console.error('获取概念列表失败:', error);
    throw new Error(`获取概念列表失败: ${error.message}`);
  }
};

// 获取所有概念代码列表（用于全量更新）- 保持向后兼容
export const getAllConceptCodes = async () => {
  return await getConceptList(true);
};

// 获取概念排行数据（涨幅前十和跌幅前十）
export const getConceptRanking = async () => {
  try {
    const response = await axios.get(
      'https://zx.10jqka.com.cn/hotblock/proxy/block/platerankinfo',
      {
        params: {
          platetype: 'all',
          'client-type': 0,
        },
        timeout: 10000,
      }
    );

    if (
      response.data &&
      response.data.errorcode === 0 &&
      response.data.result
    ) {
      const data = response.data.result;

      // 根据increase字段排序并提取前十
      const sortedData = [...data].sort((a, b) => b.increase - a.increase);

      // 提取涨幅前十
      const topRisers = sortedData.slice(0, 10).map((item) => ({
        name: item.platename,
        code: item.platecode.toString(),
        changePercent: parseFloat(item.increase || 0).toFixed(2),
      }));

      // 提取跌幅前十（按涨幅排序后取最后10个并反转）
      const topFallers = sortedData
        .slice(-10)
        .reverse()
        .map((item) => ({
          name: item.platename,
          code: item.platecode.toString(),
          changePercent: parseFloat(item.increase || 0).toFixed(2),
        }));

      return {
        topRisers,
        topFallers,
        timestamp: new Date().toISOString(),
      };
    } else {
      console.warn('获取概念排行数据失败，返回空数据');
      return {
        topRisers: [],
        topFallers: [],
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    console.error('获取概念排行数据失败:', error);
    // 返回空数据而不是抛出错误，避免影响用户体验
    return {
      topRisers: [],
      topFallers: [],
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
};
