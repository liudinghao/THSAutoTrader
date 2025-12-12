/**
 * 集合竞价策略数据源服务
 * 负责获取集合竞价策略的股票数据
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getAllStockCodes } from '../../../utils/quoteApi.js'

/**
 * 集合竞价策略数据源服务类
 */
export class AuctionStrategyDataService {
  /**
   * 获取集合竞价策略股票数据
   * 直接使用 getAllStockCodes 方法获取的股票代码作为集合竞价策略的股票列表
   */
  async getStockData() {
    try {
      console.log('开始获取集合竞价策略数据...')
      
      // 调用 getAllStockCodes 获取所有股票代码，作为集合竞价策略的股票列表
      const stockCodes = await getAllStockCodes(1)
      
      if (!Array.isArray(stockCodes) || stockCodes.length === 0) {
        throw new Error('获取到的股票代码数据为空')
      }
      
      // 为每个股票代码获取详细信息
      const stockDataPromises = stockCodes.map(async (stock) => {
        try {
          const stockDetail = await this.fetchStockDetail(stock.code)
          return {
            code: stock.code,
            name: stockDetail?.name || '--',
            price: stockDetail?.price || '--',
            changePercent: stockDetail?.changePercent || '--',
            limitUpReason: stockDetail?.limitUpReason || '--', // 涨停原因
            source: 'auction-strategy',
            marketId: stock.marketId
          }
        } catch (error) {
          console.warn(`获取股票 ${stock.code} 详细信息失败:`, error)
          // 获取详细信息失败时，返回基本信息
          return {
            code: stock.code,
            name: '--',
            price: '--',
            changePercent: '--',
            limitUpReason: '--', // 涨停原因
            source: 'auction-strategy',
            marketId: stock.marketId
          }
        }
      })
      const stockData = await Promise.all(stockDataPromises)

      console.log(`集合竞价策略数据处理完成: ${stockData.length} 个股票`, stockData)
      return stockData

    } catch (error) {
      console.error('获取集合竞价策略数据失败:', error)
      ElMessage.error(`获取集合竞价策略数据失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取股票详细信息
   * @param {string} stockCode 股票代码
   * @returns {Promise<Object>} 股票详细信息
   */
  async fetchStockDetail(stockCode) {
    try {
      const response = await axios.get(`https://www.wttiao.com/moni/ztpool/recent-limit-up/?code=${stockCode}`, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.data && response.data.code === 0 && response.data.data) {
        const stockInfo = response.data.data
      
        return {
          name: stockInfo.name,
          // 涨停原因相关字段
          limitUpReason: stockInfo.reason_type,
        }
      } else {
        console.warn(`股票 ${stockCode} 详细信息接口返回格式异常:`, response.data)
        return null
      }
    } catch (error) {
      console.warn(`获取股票 ${stockCode} 详细信息请求失败:`, error)
      return null
    }
  }

}

// 创建全局实例
export const dataSourceService = new AuctionStrategyDataService()

// 默认导出
export default dataSourceService