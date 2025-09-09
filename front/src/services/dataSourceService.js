/**
 * 数据源管理服务
 * 负责管理不同策略的股票数据获取
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getAllBlockCode, getStocksByConceptCode } from '../utils/quoteApi.js'

/**
 * 数据源类型定义
 */
export const DATA_SOURCES = {
  DRAGON_BACK: 'dragon-back',      // 龙回头策略
  AUCTION_STRATEGY: 'auction-strategy'  // 集合竞价策略
}

/**
 * 数据源配置
 */
const DATA_SOURCE_CONFIG = {
  [DATA_SOURCES.DRAGON_BACK]: {
    name: '龙回头策略',
    description: '基于龙回头形态的股票选择策略',
    endpoint: 'https://www.wttiao.com/moni/ztpool/stock-pick',
    enabled: true
  },
  [DATA_SOURCES.AUCTION_STRATEGY]: {
    name: '集合竞价策略', 
    description: '基于集合竞价数据的股票选择策略',
    endpoint: null, // 使用 quoteApi.js 的 getAllBlockCode
    enabled: true
  }
}

/**
 * 数据源服务类
 */
export class DataSourceService {
  constructor() {
    // 从localStorage读取上次选择的数据源，没有则默认为龙回头策略
    this.currentDataSource = this.loadDataSourceFromStorage() || DATA_SOURCES.DRAGON_BACK
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5分钟缓存
    this.storageKey = 'trading_monkey_data_source' // localStorage存储键
  }

  /**
   * 获取所有数据源配置
   */
  getDataSources() {
    return Object.entries(DATA_SOURCE_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.name,
      description: config.description,
      enabled: config.enabled
    }))
  }

  /**
   * 设置当前数据源
   */
  setCurrentDataSource(dataSource) {
    if (!DATA_SOURCE_CONFIG[dataSource]) {
      throw new Error(`未知的数据源: ${dataSource}`)
    }
    
    if (!DATA_SOURCE_CONFIG[dataSource].enabled) {
      throw new Error(`数据源 ${DATA_SOURCE_CONFIG[dataSource].name} 暂未启用`)
    }
    
    this.currentDataSource = dataSource
    
    // 保存到localStorage
    this.saveDataSourceToStorage(dataSource)
    
    console.log(`数据源切换到: ${DATA_SOURCE_CONFIG[dataSource].name}`)
  }

  /**
   * 获取当前数据源
   */
  getCurrentDataSource() {
    return this.currentDataSource
  }

  /**
   * 获取当前数据源配置
   */
  getCurrentDataSourceConfig() {
    return DATA_SOURCE_CONFIG[this.currentDataSource]
  }

  /**
   * 获取股票数据
   */
  async getStockData(forceRefresh = false) {
    const cacheKey = `stocks_${this.currentDataSource}`
    
    // 检查缓存
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`使用缓存数据: ${DATA_SOURCE_CONFIG[this.currentDataSource].name}`)
        return cached.data
      }
    }

    try {
      let stockData = []
      
      switch (this.currentDataSource) {
        case DATA_SOURCES.DRAGON_BACK:
          stockData = await this.fetchDragonBackData()
          break
          
        case DATA_SOURCES.AUCTION_STRATEGY:
          stockData = await this.fetchAuctionStrategyData()
          break
          
        default:
          throw new Error(`不支持的数据源: ${this.currentDataSource}`)
      }

      // 缓存数据
      this.cache.set(cacheKey, {
        data: stockData,
        timestamp: Date.now()
      })

      console.log(`成功获取 ${DATA_SOURCE_CONFIG[this.currentDataSource].name} 数据: ${stockData.length} 只股票`)
      return stockData

    } catch (error) {
      console.error(`获取 ${DATA_SOURCE_CONFIG[this.currentDataSource].name} 数据失败:`, error)
      ElMessage.error(`获取 ${DATA_SOURCE_CONFIG[this.currentDataSource].name} 数据失败: ${error.message}`)
      
      // 对于集合竞价策略，失败时直接抛出错误，不使用缓存或默认数据
      if (this.currentDataSource === DATA_SOURCES.AUCTION_STRATEGY) {
        throw error
      }
      
      // 对于其他数据源（如龙回头策略），尝试返回缓存数据
      if (this.cache.has(cacheKey)) {
        console.log('接口失败，使用缓存数据')
        ElMessage.warning('接口异常，使用缓存数据')
        return this.cache.get(cacheKey).data
      }
      
      throw error
    }
  }

  /**
   * 获取龙回头策略数据
   */
  async fetchDragonBackData() {
    const config = DATA_SOURCE_CONFIG[DATA_SOURCES.DRAGON_BACK]
    
    if (!config.endpoint) {
      throw new Error('龙回头策略接口未配置')
    }

    const response = await axios.get(config.endpoint, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.data || !Array.isArray(response.data.data)) {
      throw new Error('龙回头策略数据格式异常')
    }

    return response.data.data.map(stock => ({
      code: stock.code,
      name: stock.name,
      price: '--',
      changePercent: '--',
      source: DATA_SOURCES.DRAGON_BACK
    }))
  }

  /**
   * 获取集合竞价策略数据
   * 基于 quoteApi.js 的 getAllBlockCode 方法获取板块，然后选择特定板块获取股票
   */
  async fetchAuctionStrategyData() {
    try {
      console.log('开始获取集合竞价策略数据...')
      
      // 1. 调用 getAllBlockCode 获取所有板块代码
      const blockCodes = await getAllBlockCode(1)
      
      if (!Array.isArray(blockCodes) || blockCodes.length === 0) {
        throw new Error('获取到的板块代码数据为空')
      }

      console.log(`获取到 ${blockCodes.length} 个板块代码`)
      
      // 2. 查找国家大基金持股相关的板块（如果找不到，使用第一个板块）
      let targetBlock = blockCodes.find(block => 
        block.code && (
          block.code.includes('BK0987') || // 国家大基金持股概念板块代码
          block.code.includes('大基金') ||
          block.code.includes('国家队')
        )
      ) || blockCodes[0] // 如果找不到特定板块，使用第一个

      console.log(`选择板块: ${targetBlock.code} (市场ID: ${targetBlock.marketId})`)

      // 3. 获取该板块下的股票代码
      const stockCodes = await getStocksByConceptCode(targetBlock.code)
      
      if (!Array.isArray(stockCodes) || stockCodes.length === 0) {
        console.warn(`板块 ${targetBlock.code} 下没有股票，使用板块代码作为数据`)
        // 如果该板块下没有股票，直接返回一些板块作为监控对象
        return blockCodes.slice(0, 10).map((block, index) => ({
          code: block.code || `BK${String(index).padStart(4, '0')}`,
          name: '--', // 板块名称没有时显示 --
          price: '--',
          changePercent: '--',
          source: DATA_SOURCES.AUCTION_STRATEGY,
          marketId: block.marketId
        }))
      }

      // 4. 将股票代码转换为股票数据格式（取前20只股票）
      const stockData = stockCodes.slice(0, 20).map((stockCode, index) => ({
        code: stockCode,
        name: '--', // 股票名称没有时显示 --
        price: '--',
        changePercent: '--',
        source: DATA_SOURCES.AUCTION_STRATEGY
      }))

      console.log(`集合竞价策略数据处理完成: ${stockData.length} 只股票`)
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
  clearCache(dataSource = null) {
    if (dataSource) {
      const cacheKey = `stocks_${dataSource}`
      this.cache.delete(cacheKey)
      console.log(`清除 ${DATA_SOURCE_CONFIG[dataSource]?.name || dataSource} 缓存`)
    } else {
      this.cache.clear()
      console.log('清除所有数据源缓存')
    }
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus() {
    const status = {}
    
    Object.keys(DATA_SOURCE_CONFIG).forEach(dataSource => {
      const cacheKey = `stocks_${dataSource}`
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)
        const isExpired = Date.now() - cached.timestamp >= this.cacheTimeout
        
        status[dataSource] = {
          cached: true,
          timestamp: cached.timestamp,
          expired: isExpired,
          size: cached.data.length
        }
      } else {
        status[dataSource] = {
          cached: false
        }
      }
    })
    
    return status
  }

  /**
   * 从localStorage读取数据源配置
   */
  loadDataSourceFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey)
      if (saved && DATA_SOURCE_CONFIG[saved] && DATA_SOURCE_CONFIG[saved].enabled) {
        console.log(`从localStorage读取到数据源配置: ${DATA_SOURCE_CONFIG[saved].name}`)
        return saved
      }
    } catch (error) {
      console.warn('读取数据源配置失败:', error)
    }
    return null
  }

  /**
   * 保存数据源配置到localStorage
   */
  saveDataSourceToStorage(dataSource) {
    try {
      localStorage.setItem(this.storageKey, dataSource)
      console.log(`数据源配置已保存到localStorage: ${DATA_SOURCE_CONFIG[dataSource].name}`)
    } catch (error) {
      console.warn('保存数据源配置失败:', error)
    }
  }

  /**
   * 清除localStorage中的数据源配置
   */
  clearDataSourceFromStorage() {
    try {
      localStorage.removeItem(this.storageKey)
      console.log('已清除localStorage中的数据源配置')
    } catch (error) {
      console.warn('清除数据源配置失败:', error)
    }
  }
}

// 创建全局实例
export const dataSourceService = new DataSourceService()

// 默认导出
export default dataSourceService