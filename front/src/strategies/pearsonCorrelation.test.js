/**
 * 皮尔逊相关性算法测试
 */

import { 
  calculatePearsonCorrelation, 
  calculateStockSimilarity, 
  getMostSimilarStocks,
  getCorrelationLabel 
} from './pearsonCorrelation.js'

// 测试数据
const mockStock1 = {
  code: '000001',
  name: '平安银行',
  prices: [10.1, 10.2, 10.3, 10.2, 10.4, 10.5, 10.3],
  changePercent: [0.1, 1.0, 0.98, -0.97, 1.96, 0.96, -1.9]
}

const mockStock2 = {
  code: '000002',
  name: '万科A',
  prices: [15.1, 15.3, 15.5, 15.4, 15.7, 15.9, 15.6],
  changePercent: [0.2, 1.32, 1.31, -0.65, 1.95, 1.28, -1.89]
}

const mockStock3 = {
  code: '600000',
  name: '浦发银行',
  prices: [8.5, 8.4, 8.3, 8.2, 8.1, 8.0, 8.1],
  changePercent: [-1.2, -1.18, -1.19, -1.2, -1.22, -1.23, 1.25]
}

// 运行测试
function runTests() {
  console.log('=== 皮尔逊相关性算法测试 ===')
  
  // 测试1: 计算相关系数
  console.log('\n1. 计算相关系数:')
  const corr1 = calculatePearsonCorrelation(
    mockStock1.changePercent, 
    mockStock2.changePercent
  )
  console.log(`平安银行 vs 万科A: ${corr1.toFixed(4)}`)
  
  const corr2 = calculatePearsonCorrelation(
    mockStock1.changePercent, 
    mockStock3.changePercent
  )
  console.log(`平安银行 vs 浦发银行: ${corr2.toFixed(4)}`)
  
  // 测试2: 计算股票相似度
  console.log('\n2. 计算股票相似度:')
  const similarity1 = calculateStockSimilarity(mockStock1, mockStock2)
  console.log('平安银行 vs 万科A:', similarity1)
  
  const similarity2 = calculateStockSimilarity(mockStock1, mockStock3)
  console.log('平安银行 vs 浦发银行:', similarity2)
  
  // 测试3: 获取标签
  console.log('\n3. 获取相关性标签:')
  console.log('相关系数0.95:', getCorrelationLabel(0.95))
  console.log('相关系数0.75:', getCorrelationLabel(0.75))
  console.log('相关系数0.45:', getCorrelationLabel(0.45))
  console.log('相关系数0.15:', getCorrelationLabel(0.15))
  console.log('相关系数-0.85:', getCorrelationLabel(-0.85))
  
  // 测试4: 获取最相似股票对
  console.log('\n4. 获取最相似股票对:')
  const stocks = [mockStock1, mockStock2, mockStock3]
  const similarPairs = getMostSimilarStocks(stocks)
  console.log('最相似股票对:', similarPairs)
  
  console.log('\n=== 测试完成 ===')
}

// 运行测试
runTests()

// 导出测试函数供其他模块使用
export { runTests }