import { analyzeSellPoints } from './sellPointAnalysis.js';
import { data as rawData } from './mock.js';
export function example() {
  // 直接使用对象格式数据
  const sellPoints = analyzeSellPoints(rawData);
  console.log('卖出点分析结果:', sellPoints);
}
example();
