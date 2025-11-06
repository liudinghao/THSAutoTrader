/**
 * 策略配置管理
 * 定义各策略的运行时间窗口、刷新间隔、执行函数等
 */

import { executeAuctionPreselect } from '@/strategies/auctionPreselect.js'

/**
 * 策略配置列表
 *
 * 配置项说明:
 * - id: 策略唯一标识
 * - name: 策略显示名称
 * - description: 策略描述
 * - enabled: 是否启用
 * - timeWindows: 时间窗口列表，支持多个时间段
 *   - start: 开始时间 HH:mm 格式
 *   - end: 结束时间 HH:mm 格式
 *   - intervalSeconds: 刷新间隔（秒）
 * - executeFunction: 策略执行函数
 * - requiresDate: 是否需要日期参数
 */
export const STRATEGY_CONFIG = [
  {
    id: 'auction_preselect',
    name: '集合竞价策略',
    description: '集合竞价结束后筛选符合条件的股票',
    enabled: true,
    timeWindows: [
      {
        start: '09:26',
        end: '09:30',
        intervalSeconds: 60 // 每分钟刷新一次
      }
    ],
    executeFunction: executeAuctionPreselect,
    requiresDate: true
  }
  // 未来可以在这里添加更多策略
  // {
  //   id: 'volume_breakout',
  //   name: '放量突破策略',
  //   description: '盘中放量突破关键价位',
  //   enabled: true,
  //   timeWindows: [
  //     {
  //       start: '09:30',
  //       end: '11:30',
  //       intervalSeconds: 300 // 5分钟刷新一次
  //     },
  //     {
  //       start: '13:00',
  //       end: '15:00',
  //       intervalSeconds: 300
  //     }
  //   ],
  //   executeFunction: executeVolumeBreakout,
  //   requiresDate: false
  // }
]

/**
 * 根据策略ID获取策略配置
 * @param {string} strategyId 策略ID
 * @returns {Object|null} 策略配置对象
 */
export function getStrategyById(strategyId) {
  return STRATEGY_CONFIG.find(strategy => strategy.id === strategyId) || null
}

/**
 * 获取所有已启用的策略
 * @returns {Array} 已启用的策略列表
 */
export function getEnabledStrategies() {
  return STRATEGY_CONFIG.filter(strategy => strategy.enabled)
}

/**
 * 获取策略选项列表（用于下拉框）
 * @returns {Array} 策略选项 [{value, label, description}]
 */
export function getStrategyOptions() {
  return STRATEGY_CONFIG.map(strategy => ({
    value: strategy.id,
    label: strategy.name,
    description: strategy.description
  }))
}

/**
 * 检查策略是否在运行时间窗口内
 * @param {string} strategyId 策略ID
 * @param {Date} currentTime 当前时间（可选，默认为当前时间）
 * @returns {Object} { inWindow: boolean, nextWindow: string|null, intervalSeconds: number|null }
 */
export function checkStrategyTimeWindow(strategyId, currentTime = new Date()) {
  const strategy = getStrategyById(strategyId)
  if (!strategy || !strategy.enabled) {
    return { inWindow: false, nextWindow: null, intervalSeconds: null }
  }

  const currentHHmm = formatTimeToHHmm(currentTime)

  for (const window of strategy.timeWindows) {
    if (currentHHmm >= window.start && currentHHmm <= window.end) {
      return {
        inWindow: true,
        currentWindow: window,
        intervalSeconds: window.intervalSeconds
      }
    }
  }

  // 找到下一个时间窗口
  const nextWindow = strategy.timeWindows.find(window => currentHHmm < window.start)

  return {
    inWindow: false,
    nextWindow: nextWindow ? nextWindow.start : null,
    intervalSeconds: null
  }
}

/**
 * 格式化时间为 HH:mm
 * @param {Date} date 日期对象
 * @returns {string} HH:mm 格式的时间字符串
 */
function formatTimeToHHmm(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export default {
  STRATEGY_CONFIG,
  getStrategyById,
  getEnabledStrategies,
  getStrategyOptions,
  checkStrategyTimeWindow
}
