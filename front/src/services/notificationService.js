/**
 * 通知服务
 * 封装微信通知接口调用
 */
import axios from 'axios'
import { getStrategyById } from '../config/strategyConfig.js'

// 固定配置
const NOTIFICATION_CONFIG = {
  baseUrl: 'https://www.wttiao.com/moni/users/sendMessage',
  openid: 'oA5mf7ZvHz7XPIHCCkLasbUt2Yw8'
}

/**
 * 发送微信通知
 * @param {string} title - 通知标题
 * @param {string} content - 通知内容
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendWechatNotification(title, content) {
  try {
    const params = new URLSearchParams({
      openid: NOTIFICATION_CONFIG.openid,
      title: title,
      content: content
    })

    const response = await axios.get(`${NOTIFICATION_CONFIG.baseUrl}?${params}`)

    if (response.data && response.data.success) {
      console.log('微信通知发送成功:', title)
      return true
    } else {
      console.warn('微信通知发送失败:', response.data)
      return false
    }
  } catch (error) {
    console.error('发送微信通知异常:', error.message)
    return false
  }
}

/**
 * 生成股票变更通知内容
 * @param {Array} currentStocks - 当前监控股票列表
 * @param {string} strategyName - 策略名称
 * @returns {string} 通知内容
 */
export function generateNotificationContent(currentStocks, strategyName) {
  if (!currentStocks || currentStocks.length === 0) {
    return '无股票'
  }

  // 只返回当前股票名称列表
  return currentStocks.map(stock => stock.name).join('、')
}

/**
 * 比较两个股票列表，找出新增和删除的股票
 * @param {Array} oldStocks - 旧的股票列表
 * @param {Array} newStocks - 新的股票列表
 * @returns {{added: Array, removed: Array}} 变更信息
 */
export function compareStockChanges(oldStocks, newStocks) {
  const oldCodes = new Set(oldStocks.map(stock => stock.code))
  const newCodes = new Set(newStocks.map(stock => stock.code))

  const added = newStocks.filter(stock => !oldCodes.has(stock.code))
  const removed = oldStocks.filter(stock => !newCodes.has(stock.code))

  return { added, removed }
}

/**
 * 发送股票变更通知
 * @param {Array} currentStocks - 当前监控股票列表
 * @param {string} strategyId - 策略ID
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendStockChangeNotification(currentStocks, strategyId) {
  // 获取策略配置
  const strategy = getStrategyById(strategyId)

  // 使用策略配置中的名称，如果没有找到策略配置，则使用策略ID
  const strategyName = strategy ? strategy.name : strategyId

  // 生成通知内容
  const content = generateNotificationContent(currentStocks, strategyName)

  // 发送通知
  const success = await sendWechatNotification(strategyName, content)
  return success
}