/**
 * 竞价选股策略
 * 基于集合竞价数据进行股票筛选，过滤出竞价涨跌幅在指定范围内的股票
 */

import { fetchHistoryData } from '@/utils/quoteApi.js'
import axios from 'axios'

/**
 * 竞价选股策略配置
 */
export const AUCTION_PRESELECT_CONFIG = {
  // 默认竞价涨跌幅过滤范围
  MIN_CHANGE_PERCENT: 3, // 最小涨跌幅 3%
  MAX_CHANGE_PERCENT: 5, // 最大涨跌幅 5%

  // 批处理配置
  BATCH_SIZE: 100, // 每批处理股票数量
  BATCH_DELAY: 200, // 批次间延迟(ms)

  // API配置
  API_URL: 'https://www.wttiao.com/moni/ztpool/auction-preselect'
}

/**
 * 竞价选股策略主函数
 * @param {Object} params 策略参数
 * @param {string} params.date 回测日期，格式: YYYY-MM-DD
 * @param {number} params.minChange 最小竞价涨跌幅，默认3%
 * @param {number} params.maxChange 最大竞价涨跌幅，默认5%
 * @param {Function} params.onProgress 进度回调函数，可选
 * @returns {Promise<Object>} 策略执行结果
 */
export async function executeAuctionPreselect(params = {}) {
  const {
    date,
    minChange = AUCTION_PRESELECT_CONFIG.MIN_CHANGE_PERCENT,
    maxChange = AUCTION_PRESELECT_CONFIG.MAX_CHANGE_PERCENT,
    onProgress
  } = params

  if (!date) {
    throw new Error('请指定回测日期')
  }

  const result = {
    date,
    originalCount: 0,
    filteredCount: 0,
    stocks: [],
    filterCriteria: {
      minChange,
      maxChange
    },
    executionTime: Date.now()
  }

  try {
    // 报告进度
    onProgress && onProgress('正在获取预选股票列表...', 0)

    // 第一步：获取预选股票列表
    const originalStocks = await fetchPreselectedStocks(date)
    result.originalCount = originalStocks.length

    onProgress && onProgress(`获取到 ${originalStocks.length} 只预选股票，开始计算竞价涨跌幅...`, 20)

    // 第二步：分批获取行情数据并计算竞价涨跌幅
    const stocksWithAuctionData = await calculateAuctionChanges(originalStocks, date, onProgress)
    
    // 第三步：根据竞价涨跌幅过滤股票
    const filteredStocks = filterByAuctionChange(stocksWithAuctionData, minChange, maxChange)

    result.filteredCount = filteredStocks.length
    result.stocks = filteredStocks
    result.executionTime = Date.now() - result.executionTime

    onProgress && onProgress(`策略执行完成，找到 ${filteredStocks.length} 只符合条件的股票`, 100)

    return result

  } catch (error) {
    console.error('竞价选股策略执行失败:', error)
    throw new Error(`竞价选股策略执行失败: ${error.message}`)
  }
}

/**
 * 获取预选股票列表
 * @param {string} date 日期，格式: YYYY-MM-DD
 * @returns {Promise<Array>} 预选股票列表
 */
export async function fetchPreselectedStocks(date) {
  try {
    const response = await axios.get(AUCTION_PRESELECT_CONFIG.API_URL, {
      params: { date }
    })

    if (response.data.code !== 0) {
      throw new Error(`API返回错误: ${response.data.msg}`)
    }

    return response.data.data || []
  } catch (error) {
    throw new Error(`获取预选股票失败: ${error.message}`)
  }
}

/**
 * 分批计算股票的竞价涨跌幅
 * @param {Array} stocks 股票列表
 * @param {string} date 日期，格式: YYYY-MM-DD
 * @param {Function} onProgress 进度回调函数
 * @returns {Promise<Array>} 包含竞价涨跌幅的股票列表
 */
export async function calculateAuctionChanges(stocks, date, onProgress) {
  const { BATCH_SIZE, BATCH_DELAY } = AUCTION_PRESELECT_CONFIG
  const dateFormatted = date.replace(/-/g, '') // 转换为YYYYMMDD格式
  const stocksWithData = []
  const totalBatches = Math.ceil(stocks.length / BATCH_SIZE)

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE)
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1

    try {
      // 报告进度
      const progress = 20 + (batchIndex / totalBatches) * 60 // 20-80%的进度
      onProgress && onProgress(`正在处理第 ${batchIndex}/${totalBatches} 批股票 (${batch.length} 只)`, progress)

      // 构造股票代码列表，需要加上市场代码
      const stockCodes = batch.map(stock => formatStockCode(stock.code))

      // 获取历史行情数据
      const historyData = await fetchHistoryData(stockCodes, dateFormatted, dateFormatted)

      // 处理每只股票的数据
      batch.forEach(stock => {
        const marketCode = formatStockCode(stock.code)
        const stockData = historyData[marketCode]
        const auctionChange = calculateSingleAuctionChange(stockData, dateFormatted)
        const closeChange = calculateSingleCloseChange(stockData, dateFormatted)

        stocksWithData.push({
          ...stock,
          auction_change: auctionChange,
          close_change: closeChange,
          market_code: marketCode
        })
      })

      // 添加延迟避免API调用过快
      if (i + BATCH_SIZE < stocks.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
      }

    } catch (error) {
      console.error(`第 ${batchIndex} 批股票获取行情数据失败:`, error)

      // 即使失败也要添加股票到结果中，只是竞价涨跌幅和收盘涨跌幅为null
      batch.forEach(stock => {
        stocksWithData.push({
          ...stock,
          auction_change: null,
          close_change: null,
          market_code: formatStockCode(stock.code),
          error: error.message
        })
      })
    }
  }

  return stocksWithData
}

/**
 * 格式化股票代码，添加市场前缀
 * @param {string} code 股票代码
 * @returns {string} 带市场前缀的股票代码
 */
export function formatStockCode(code) {
  return code;
}

/**
 * 计算单只股票的竞价涨跌幅
 * @param {Object} stockData 股票历史数据
 * @param {string} dateFormatted 格式化的日期 YYYYMMDD
 * @returns {number|null} 竞价涨跌幅百分比，保留2位小数
 */
export function calculateSingleAuctionChange(stockData, dateFormatted) {
  if (!stockData || !stockData[dateFormatted]) {
    return null
  }

  const dayData = stockData[dateFormatted]
  const openPrice = parseFloat(dayData.OPEN)
  const prePrice = parseFloat(dayData.PRE)

  if (isNaN(openPrice) || isNaN(prePrice) || prePrice <= 0) {
    return null
  }

  // 计算竞价涨跌幅 = (开盘价 - 昨收价) / 昨收价 * 100
  const changePercent = ((openPrice - prePrice) / prePrice) * 100
  return parseFloat(changePercent.toFixed(2))
}

/**
 * 计算单只股票的当日收盘涨跌幅
 * @param {Object} stockData 股票历史数据
 * @param {string} dateFormatted 格式化的日期 YYYYMMDD
 * @returns {number|null} 收盘涨跌幅百分比，保留2位小数
 */
export function calculateSingleCloseChange(stockData, dateFormatted) {
  if (!stockData || !stockData[dateFormatted]) {
    return null
  }

  const dayData = stockData[dateFormatted]
  const closePrice = parseFloat(dayData.CLOSE)
  const prePrice = parseFloat(dayData.PRE)

  if (isNaN(closePrice) || isNaN(prePrice) || prePrice <= 0) {
    return null
  }

  // 计算收盘涨跌幅 = (收盘价 - 昨收价) / 昨收价 * 100
  const changePercent = ((closePrice - prePrice) / prePrice) * 100
  return parseFloat(changePercent.toFixed(2))
}

/**
 * 根据竞价涨跌幅过滤股票
 * @param {Array} stocks 包含竞价涨跌幅的股票列表
 * @param {number} minChange 最小涨跌幅
 * @param {number} maxChange 最大涨跌幅
 * @returns {Array} 过滤后的股票列表
 */
export function filterByAuctionChange(stocks, minChange, maxChange) {
  return stocks.filter(stock => {
    const change = stock.auction_change
    return change !== null &&
           change !== undefined &&
           change >= minChange &&
           change <= maxChange
  })
}

/**
 * 竞价选股策略分析
 * 提供策略的详细分析结果
 * @param {Array} filteredStocks 过滤后的股票列表
 * @returns {Object} 分析结果
 */
export function analyzeAuctionStrategy(filteredStocks) {
  if (!Array.isArray(filteredStocks) || filteredStocks.length === 0) {
    return {
      count: 0,
      avgChange: 0,
      changeRange: { min: 0, max: 0 },
      distribution: {},
      topReasons: []
    }
  }

  // 计算基础统计
  const validChanges = filteredStocks
    .map(stock => stock.auction_change)
    .filter(change => change !== null && change !== undefined)

  const avgChange = validChanges.length > 0
    ? parseFloat((validChanges.reduce((sum, change) => sum + change, 0) / validChanges.length).toFixed(2))
    : 0

  const changeRange = {
    min: validChanges.length > 0 ? Math.min(...validChanges) : 0,
    max: validChanges.length > 0 ? Math.max(...validChanges) : 0
  }

  // 分析涨跌幅分布
  const distribution = {}
  validChanges.forEach(change => {
    const range = Math.floor(change)
    distribution[range] = (distribution[range] || 0) + 1
  })

  // 分析选股原因
  const reasonCount = {}
  filteredStocks.forEach(stock => {
    if (stock.reason_type) {
      const reasons = stock.reason_type.split(',').map(r => r.trim())
      reasons.forEach(reason => {
        reasonCount[reason] = (reasonCount[reason] || 0) + 1
      })
    }
  })

  const topReasons = Object.entries(reasonCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }))

  return {
    count: filteredStocks.length,
    avgChange,
    changeRange,
    distribution,
    topReasons
  }
}

/**
 * 竞价选股策略默认导出对象
 */
export default {
  name: '竞价选股策略',
  description: '基于集合竞价涨跌幅筛选股票，适用于短线交易策略',
  version: '1.0.0',
  author: 'THS AutoTrader',

  // 策略配置
  config: AUCTION_PRESELECT_CONFIG,

  // 主要方法
  execute: executeAuctionPreselect,
  fetchPreselectedStocks,
  calculateAuctionChanges,
  filterByAuctionChange,
  analyzeAuctionStrategy,

  // 工具方法
  formatStockCode,
  calculateSingleAuctionChange,
  calculateSingleCloseChange
}