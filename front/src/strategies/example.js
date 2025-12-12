import { analyzeSellPoints } from './sellPointAnalysis.js';
import { data as rawData } from './mock.js';
import { getLimitPrices } from '../utils/common.js';
export function example() {
  // 直接使用对象格式数据,昨收为85.47
  const stockInfo = {
    limitUpPrice: 93.56,
    limitDownPrice: 76.38,
    name: '测试股票',
    code: '000001',
    preClose: 85.47,
  };
  const sellPoints = analyzeSellPoints(rawData, stockInfo);
  console.log('卖出点分析结果:', sellPoints);
}
example();
