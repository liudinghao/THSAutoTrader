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
