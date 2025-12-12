/**
 * 竞价选股策略使用示例
 * 演示如何使用竞价选股策略进行股票筛选和回测
 */

import { executeAuctionPreselect, analyzeAuctionStrategy } from './auctionPreselect.js'
import { strategyManager, STRATEGY_TYPES } from './index.js'

/**
 * 示例1：基本使用方法
 */
export async function basicExample() {
  try {
    console.log('开始执行竞价选股策略...')

    const result = await executeAuctionPreselect({
      date: '2025-09-16',
      minChange: 3,
      maxChange: 5,
      onProgress: (message, progress) => {
        console.log(`[${progress}%] ${message}`)
      }
    })

    console.log('策略执行结果:', result)
    console.log(`原始股票数量: ${result.originalCount}`)
    console.log(`过滤后数量: ${result.filteredCount}`)
    console.log(`执行时间: ${result.executionTime}ms`)

    // 分析策略结果
    const analysis = analyzeAuctionStrategy(result.stocks)
    console.log('策略分析结果:', analysis)

    return result
  } catch (error) {
    console.error('策略执行失败:', error)
    throw error
  }
}

/**
 * 示例2：通过策略管理器使用
 */
export async function strategyManagerExample() {
  try {
    console.log('通过策略管理器执行竞价选股策略...')

    const result = await strategyManager.executeStrategy(
      STRATEGY_TYPES.AUCTION_PRESELECT,
      {
        date: '2025-09-16',
        minChange: 2,
        maxChange: 6,
        onProgress: (message, progress) => {
          console.log(`策略管理器: [${progress}%] ${message}`)
        }
      }
    )

    console.log('策略管理器执行结果:', result)
    return result
  } catch (error) {
    console.error('策略管理器执行失败:', error)
    throw error
  }
}

/**
 * 示例3：批量回测多个日期
 */
export async function batchBacktestExample() {
  const dates = ['2025-09-16', '2025-09-15', '2025-09-14']
  const results = []

  console.log('开始批量回测...')

  for (const date of dates) {
    try {
      console.log(`回测日期: ${date}`)

      const result = await executeAuctionPreselect({
        date,
        minChange: 3,
        maxChange: 5,
        onProgress: (message, progress) => {
          console.log(`${date}: [${progress}%] ${message}`)
        }
      })

      results.push({
        date,
        ...result,
        analysis: analyzeAuctionStrategy(result.stocks)
      })

      console.log(`${date} 回测完成: ${result.filteredCount} 只股票`)

      // 添加延迟避免API调用过快
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error(`${date} 回测失败:`, error)
      results.push({
        date,
        error: error.message
      })
    }
  }

  console.log('批量回测完成:', results)
  return results
}

/**
 * 示例4：自定义过滤条件
 */
export async function customFilterExample() {
  try {
    console.log('使用自定义过滤条件...')

    // 更宽松的过滤条件
    const result1 = await executeAuctionPreselect({
      date: '2025-09-16',
      minChange: 1,
      maxChange: 8,
      onProgress: (message, progress) => {
        console.log(`宽松条件: [${progress}%] ${message}`)
      }
    })

    // 更严格的过滤条件
    const result2 = await executeAuctionPreselect({
      date: '2025-09-16',
      minChange: 4,
      maxChange: 4.5,
      onProgress: (message, progress) => {
        console.log(`严格条件: [${progress}%] ${message}`)
      }
    })

    console.log('宽松条件结果:', {
      count: result1.filteredCount,
      criteria: result1.filterCriteria
    })

    console.log('严格条件结果:', {
      count: result2.filteredCount,
      criteria: result2.filterCriteria
    })

    return { loose: result1, strict: result2 }
  } catch (error) {
    console.error('自定义过滤示例失败:', error)
    throw error
  }
}

/**
 * 示例5：策略性能测试
 */
export async function performanceTestExample() {
  console.log('开始策略性能测试...')

  const startTime = Date.now()
  let totalStocks = 0
  let totalFiltered = 0

  try {
    const result = await executeAuctionPreselect({
      date: '2025-09-16',
      minChange: 3,
      maxChange: 5,
      onProgress: (message, progress) => {
        console.log(`性能测试: [${progress}%] ${message}`)
      }
    })

    totalStocks = result.originalCount
    totalFiltered = result.filteredCount
    const endTime = Date.now()

    const performance = {
      totalExecutionTime: endTime - startTime,
      strategyExecutionTime: result.executionTime,
      originalStocks: totalStocks,
      filteredStocks: totalFiltered,
      filterRate: ((totalFiltered / totalStocks) * 100).toFixed(2),
      throughput: (totalStocks / (result.executionTime / 1000)).toFixed(2) // 股票/秒
    }

    console.log('性能测试结果:', performance)
    return performance

  } catch (error) {
    console.error('性能测试失败:', error)
    throw error
  }
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('=== 开始运行所有竞价选股策略示例 ===')

  try {
    // 示例1：基本使用
    console.log('\n1. 基本使用示例')
    await basicExample()

    // 示例2：策略管理器
    console.log('\n2. 策略管理器示例')
    await strategyManagerExample()

    // 示例3：批量回测
    console.log('\n3. 批量回测示例')
    await batchBacktestExample()

    // 示例4：自定义过滤
    console.log('\n4. 自定义过滤示例')
    await customFilterExample()

    // 示例5：性能测试
    console.log('\n5. 性能测试示例')
    await performanceTestExample()

    console.log('\n=== 所有示例执行完成 ===')

  } catch (error) {
    console.error('示例执行失败:', error)
  }
}

// 在开发环境中可以直接运行示例
if (process.env.NODE_ENV === 'development') {
  // runAllExamples()
}

export default {
  basicExample,
  strategyManagerExample,
  batchBacktestExample,
  customFilterExample,
  performanceTestExample,
  runAllExamples
}