/**
 * 交易执行服务
 * 负责执行买卖订单、订单管理、交易历史记录等功能
 */

import axios from 'axios'

// 订单状态
export const ORDER_STATUS = {
  PENDING: 'pending',       // 待处理
  SUBMITTED: 'submitted',   // 已提交
  FILLED: 'filled',        // 已成交
  CANCELLED: 'cancelled',   // 已取消
  REJECTED: 'rejected',     // 已拒绝
  PARTIAL: 'partial'        // 部分成交
}

// 订单类型
export const ORDER_TYPES = {
  BUY: 'buy',              // 买入
  SELL: 'sell'             // 卖出
}

// 价格类型
export const PRICE_TYPES = {
  MARKET: 'market',        // 市价
  LIMIT: 'limit',          // 限价
  STOP_LOSS: 'stop_loss',  // 止损
  STOP_PROFIT: 'stop_profit' // 止盈
}

/**
 * 交易服务类
 */
export class TradingService {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:5000'
    this.timeout = options.timeout || 10000
    this.orders = new Map() // 本地订单缓存
    this.executionHistory = []
  }

  /**
   * 执行买入订单
   * @param {Object} orderParams - 订单参数
   * @returns {Promise<Object>} 执行结果
   */
  async executeBuy(orderParams) {
    const {
      stockCode,
      stockName,
      quantity,
      price,
      priceType = PRICE_TYPES.LIMIT,
      signal = null
    } = orderParams

    const order = this.createOrder({
      type: ORDER_TYPES.BUY,
      stockCode,
      stockName,
      quantity,
      price,
      priceType,
      signal
    })

    try {
      console.log('执行买入订单:', order)
      
      // 调用后端买入接口
      const response = await this.callTradingAPI('buy', {
        code: stockCode,
        amount: quantity,
        price: priceType === PRICE_TYPES.MARKET ? undefined : price
      })

      // 更新订单状态
      this.updateOrderStatus(order.id, ORDER_STATUS.SUBMITTED, {
        serverResponse: response.data,
        submittedAt: new Date().toISOString()
      })

      // 记录执行历史
      this.recordExecution(order, 'success', '买入订单已提交')

      return {
        success: true,
        order: order,
        message: '买入订单提交成功',
        data: response.data
      }
    } catch (error) {
      console.error('买入执行失败:', error)
      
      // 更新订单状态为失败
      this.updateOrderStatus(order.id, ORDER_STATUS.REJECTED, {
        error: error.message,
        rejectedAt: new Date().toISOString()
      })

      // 记录执行历史
      this.recordExecution(order, 'error', `买入失败: ${error.message}`)

      return {
        success: false,
        order: order,
        error: error.message,
        message: '买入订单提交失败'
      }
    }
  }

  /**
   * 执行卖出订单
   * @param {Object} orderParams - 订单参数
   * @returns {Promise<Object>} 执行结果
   */
  async executeSell(orderParams) {
    const {
      stockCode,
      stockName,
      quantity,
      price,
      priceType = PRICE_TYPES.LIMIT,
      reason = 'manual', // manual, stop_loss, take_profit, signal
      signal = null
    } = orderParams

    const order = this.createOrder({
      type: ORDER_TYPES.SELL,
      stockCode,
      stockName,
      quantity,
      price,
      priceType,
      reason,
      signal
    })

    try {
      console.log('执行卖出订单:', order)
      
      // 调用后端卖出接口
      const response = await this.callTradingAPI('sell', {
        code: stockCode,
        amount: quantity,
        price: priceType === PRICE_TYPES.MARKET ? undefined : price
      })

      // 更新订单状态
      this.updateOrderStatus(order.id, ORDER_STATUS.SUBMITTED, {
        serverResponse: response.data,
        submittedAt: new Date().toISOString()
      })

      // 记录执行历史
      this.recordExecution(order, 'success', `卖出订单已提交 (${reason})`)

      return {
        success: true,
        order: order,
        message: '卖出订单提交成功',
        data: response.data
      }
    } catch (error) {
      console.error('卖出执行失败:', error)
      
      // 更新订单状态为失败
      this.updateOrderStatus(order.id, ORDER_STATUS.REJECTED, {
        error: error.message,
        rejectedAt: new Date().toISOString()
      })

      // 记录执行历史
      this.recordExecution(order, 'error', `卖出失败: ${error.message}`)

      return {
        success: false,
        order: order,
        error: error.message,
        message: '卖出订单提交失败'
      }
    }
  }

  /**
   * 批量执行订单
   * @param {Array} orders - 订单数组
   * @returns {Promise<Object>} 批量执行结果
   */
  async executeBatch(orders) {
    const results = []
    let successCount = 0
    let errorCount = 0

    console.log(`开始批量执行 ${orders.length} 个订单`)

    for (const orderParams of orders) {
      try {
        let result
        if (orderParams.type === ORDER_TYPES.BUY) {
          result = await this.executeBuy(orderParams)
        } else if (orderParams.type === ORDER_TYPES.SELL) {
          result = await this.executeSell(orderParams)
        } else {
          throw new Error(`未知订单类型: ${orderParams.type}`)
        }

        results.push(result)
        if (result.success) {
          successCount++
        } else {
          errorCount++
        }

        // 每个订单之间间隔一定时间，避免频繁请求
        if (orders.indexOf(orderParams) < orders.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error('批量执行订单失败:', error)
        errorCount++
        results.push({
          success: false,
          error: error.message,
          orderParams
        })
      }
    }

    const batchResult = {
      success: successCount > 0,
      total: orders.length,
      successCount,
      errorCount,
      results,
      timestamp: new Date().toISOString()
    }

    // 记录批量执行历史
    this.recordExecution(null, 'batch', `批量执行完成: 成功${successCount}个，失败${errorCount}个`, batchResult)

    return batchResult
  }

  /**
   * 取消订单
   * @param {string} orderId - 订单ID
   * @returns {Promise<Object>} 取消结果
   */
  async cancelOrder(orderId) {
    const order = this.orders.get(orderId)
    if (!order) {
      return {
        success: false,
        message: '订单不存在'
      }
    }

    if (order.status === ORDER_STATUS.FILLED || order.status === ORDER_STATUS.CANCELLED) {
      return {
        success: false,
        message: '订单已完成或已取消，无法取消'
      }
    }

    try {
      // 调用后端取消接口 (如果有的话)
      // const response = await this.callTradingAPI('cancel', { orderId })
      
      // 更新订单状态
      this.updateOrderStatus(orderId, ORDER_STATUS.CANCELLED, {
        cancelledAt: new Date().toISOString()
      })

      this.recordExecution(order, 'info', '订单已取消')

      return {
        success: true,
        message: '订单取消成功'
      }
    } catch (error) {
      console.error('取消订单失败:', error)
      return {
        success: false,
        error: error.message,
        message: '订单取消失败'
      }
    }
  }

  /**
   * 取消所有待处理订单
   * @returns {Promise<Object>} 批量取消结果
   */
  async cancelAllOrders() {
    try {
      // 调用后端取消所有订单接口
      const response = await axios.get(`${this.baseURL}/cancel_all_orders`, {
        timeout: this.timeout
      })

      // 更新本地所有待处理订单状态
      this.orders.forEach((order, orderId) => {
        if (order.status === ORDER_STATUS.PENDING || order.status === ORDER_STATUS.SUBMITTED) {
          this.updateOrderStatus(orderId, ORDER_STATUS.CANCELLED, {
            cancelledAt: new Date().toISOString(),
            cancelledBy: 'batch_cancel'
          })
        }
      })

      this.recordExecution(null, 'info', '已取消所有订单')

      return {
        success: true,
        message: '所有订单已取消',
        data: response.data
      }
    } catch (error) {
      console.error('取消所有订单失败:', error)
      return {
        success: false,
        error: error.message,
        message: '取消所有订单失败'
      }
    }
  }

  /**
   * 获取订单状态
   * @param {string} orderId - 订单ID
   * @returns {Object|null} 订单信息
   */
  getOrder(orderId) {
    return this.orders.get(orderId) || null
  }

  /**
   * 获取所有订单
   * @param {Object} filters - 过滤条件
   * @returns {Array} 订单列表
   */
  getAllOrders(filters = {}) {
    let orders = Array.from(this.orders.values())
    
    // 按状态过滤
    if (filters.status) {
      orders = orders.filter(order => order.status === filters.status)
    }
    
    // 按股票代码过滤
    if (filters.stockCode) {
      orders = orders.filter(order => order.stockCode === filters.stockCode)
    }
    
    // 按日期过滤
    if (filters.date) {
      const targetDate = new Date(filters.date).toDateString()
      orders = orders.filter(order => 
        new Date(order.createdAt).toDateString() === targetDate
      )
    }
    
    // 按创建时间倒序排列
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    
    return orders
  }

  /**
   * 获取执行历史
   * @param {number} limit - 限制数量
   * @returns {Array} 执行历史
   */
  getExecutionHistory(limit = 50) {
    return this.executionHistory
      .slice(-limit)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  /**
   * 清理历史数据
   * @param {number} daysToKeep - 保留天数
   */
  cleanHistory(daysToKeep = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // 清理执行历史
    this.executionHistory = this.executionHistory.filter(
      record => new Date(record.timestamp) > cutoffDate
    )

    // 清理已完成的订单
    this.orders.forEach((order, orderId) => {
      if (new Date(order.createdAt) < cutoffDate && 
          (order.status === ORDER_STATUS.FILLED || order.status === ORDER_STATUS.CANCELLED)) {
        this.orders.delete(orderId)
      }
    })

    console.log(`清理完成，保留${daysToKeep}天内的数据`)
  }

  // 私有方法

  /**
   * 创建订单对象
   * @param {Object} params - 订单参数
   * @returns {Object} 订单对象
   */
  createOrder(params) {
    const orderId = this.generateOrderId()
    const order = {
      id: orderId,
      ...params,
      status: ORDER_STATUS.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    this.orders.set(orderId, order)
    return order
  }

  /**
   * 更新订单状态
   * @param {string} orderId - 订单ID
   * @param {string} status - 新状态
   * @param {Object} additionalData - 附加数据
   */
  updateOrderStatus(orderId, status, additionalData = {}) {
    const order = this.orders.get(orderId)
    if (order) {
      order.status = status
      order.updatedAt = new Date().toISOString()
      Object.assign(order, additionalData)
      this.orders.set(orderId, order)
    }
  }

  /**
   * 调用交易API
   * @param {string} action - 操作类型
   * @param {Object} params - 参数
   * @returns {Promise} API响应
   */
  async callTradingAPI(action, params) {
    const url = `${this.baseURL}/xiadan`
    const queryParams = new URLSearchParams()
    
    queryParams.append('code', params.code)
    
    if (action === 'buy') {
      queryParams.append('status', '1') // 买入
    } else if (action === 'sell') {
      queryParams.append('status', '2') // 卖出
    }
    
    if (params.amount) {
      queryParams.append('amount', params.amount.toString())
    }
    
    const requestUrl = `${url}?${queryParams.toString()}`
    
    console.log('调用交易API:', requestUrl)
    
    return await axios.get(requestUrl, {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  /**
   * 记录执行历史
   * @param {Object} order - 订单对象
   * @param {string} type - 记录类型
   * @param {string} message - 消息
   * @param {Object} data - 附加数据
   */
  recordExecution(order, type, message, data = {}) {
    const record = {
      id: this.generateRecordId(),
      type, // success, error, info, batch
      message,
      timestamp: new Date().toISOString(),
      order: order ? {
        id: order.id,
        stockCode: order.stockCode,
        stockName: order.stockName,
        type: order.type,
        quantity: order.quantity,
        price: order.price
      } : null,
      data
    }
    
    this.executionHistory.push(record)
    
    // 保留最近1000条记录
    if (this.executionHistory.length > 1000) {
      this.executionHistory.shift()
    }
  }

  /**
   * 生成订单ID
   * @returns {string} 订单ID
   */
  generateOrderId() {
    return `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成记录ID
   * @returns {string} 记录ID
   */
  generateRecordId() {
    return `RECORD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }
}

// 创建默认实例
export const defaultTradingService = new TradingService()

// 工具函数
export const getOrderStatusText = (status) => {
  const texts = {
    [ORDER_STATUS.PENDING]: '待处理',
    [ORDER_STATUS.SUBMITTED]: '已提交',
    [ORDER_STATUS.FILLED]: '已成交',
    [ORDER_STATUS.CANCELLED]: '已取消',
    [ORDER_STATUS.REJECTED]: '已拒绝',
    [ORDER_STATUS.PARTIAL]: '部分成交'
  }
  return texts[status] || '未知'
}

export const getOrderTypeText = (type) => {
  const texts = {
    [ORDER_TYPES.BUY]: '买入',
    [ORDER_TYPES.SELL]: '卖出'
  }
  return texts[type] || '未知'
}

export const getOrderStatusColor = (status) => {
  const colors = {
    [ORDER_STATUS.PENDING]: '#e6a23c',
    [ORDER_STATUS.SUBMITTED]: '#409eff',
    [ORDER_STATUS.FILLED]: '#67c23a',
    [ORDER_STATUS.CANCELLED]: '#909399',
    [ORDER_STATUS.REJECTED]: '#f56c6c',
    [ORDER_STATUS.PARTIAL]: '#e6a23c'
  }
  return colors[status] || '#909399'
}