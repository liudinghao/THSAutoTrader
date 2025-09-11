/**
 * 集合竞价策略数据源服务
 * 负责获取集合竞价策略的股票数据
 */
import { ElMessage } from 'element-plus'
import { getAllBlockCode } from '../../../utils/quoteApi.js'

/**
 * 集合竞价策略数据源服务类
 */
export class AuctionStrategyDataService {
  constructor() {
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5分钟缓存
  }

  /**
   * 获取集合竞价策略股票数据
   */
  async getStockData(forceRefresh = false) {
    const cacheKey = 'auction_strategy_stocks'
    
    // 检查缓存
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('使用缓存数据: 集合竞价策略')
        return cached.data
      }
    }

    try {
      const stockData = await this.fetchAuctionStrategyData()

      // 缓存数据
      this.cache.set(cacheKey, {
        data: stockData,
        timestamp: Date.now()
      })

      console.log(`成功获取集合竞价策略数据: ${stockData.length} 个板块代码`)
      return stockData

    } catch (error) {
      console.error('获取集合竞价策略数据失败:', error)
      ElMessage.error(`获取集合竞价策略数据失败: ${error.message}`)
      throw error
    }
  }


  /**
   * 获取集合竞价策略数据
   * 直接使用 getAllBlockCode 方法获取的板块代码作为集合竞价策略的股票列表
   */
  async fetchAuctionStrategyData() {
    try {
      console.log('开始获取集合竞价策略数据...')
      
      // 调用 getAllBlockCode 获取所有板块代码，直接作为集合竞价策略的股票列表
      const blockCodes = await getAllBlockCode(1)
      
      if (!Array.isArray(blockCodes) || blockCodes.length === 0) {
        throw new Error('获取到的板块代码数据为空')
      }

      console.log(`获取到 ${blockCodes.length} 个板块代码`)
      
      // 将板块代码转换为股票数据格式（取前30个）
      const stockData = blockCodes.slice(0, 30).map((block, index) => ({
        code: block.code || `BK${String(index).padStart(4, '0')}`,
        name: '--', // 板块名称在这里不显示，后续通过实时数据获取
        price: '--',
        changePercent: '--',
        source: 'auction-strategy',
        marketId: block.marketId
      }))

      console.log(`集合竞价策略数据处理完成: ${stockData.length} 个板块代码`)
      return stockData

    } catch (error) {
      console.error('获取集合竞价策略数据失败:', error)
      
      // 失败时不返回默认数据，直接抛出错误让上层处理
      throw new Error(`集合竞价策略数据获取失败: ${error.message}`)
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear()
    console.log('清除集合竞价策略缓存')
  }
}

// 创建全局实例
export const dataSourceService = new AuctionStrategyDataService()

// 默认导出
export default dataSourceService