/**
 * 策略管理器服务
 * 负责策略的自动调度和执行
 */

import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getStrategyById, checkStrategyTimeWindow } from '@/config/strategyConfig.js'
import { getLatestTradeDate } from '@/utils/quoteApi.js'

/**
 * 策略管理器类
 */
class StrategyManager {
  constructor() {
    // 当前选中的策略ID
    this.currentStrategyId = ref('auction_preselect')

    // 策略执行状态
    this.strategyStatus = ref('waiting') // waiting, running, stopped

    // 定时器ID
    this.timerId = null

    // 上次执行时间
    this.lastExecuteTime = null

    // 执行回调函数
    this.onExecuteCallback = null

    // 策略是否正在运行
    this.isRunning = false
  }

  /**
   * 启动策略管理器
   * @param {string} strategyId 策略ID
   * @param {Function} onExecute 策略执行回调函数
   */
  start(strategyId, onExecute) {
    if (this.isRunning) {
      console.warn('策略管理器已在运行中')
      return
    }

    this.currentStrategyId.value = strategyId
    this.onExecuteCallback = onExecute
    this.isRunning = true
    this.strategyStatus.value = 'waiting'

    console.log(`启动策略管理器: ${strategyId}`)

    // 立即检查一次时间窗口
    this.checkAndExecute()

    // 每秒检查一次时间窗口
    this.timerId = setInterval(() => {
      this.checkAndExecute()
    }, 1000)

    ElMessage.success('策略管理器已启动')
  }

  /**
   * 停止策略管理器
   */
  stop() {
    if (!this.isRunning) {
      console.warn('策略管理器未在运行')
      return
    }

    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }

    this.isRunning = false
    this.strategyStatus.value = 'stopped'
    this.lastExecuteTime = null

    console.log('策略管理器已停止')
    ElMessage.info('策略管理器已停止')
  }

  /**
   * 切换策略
   * @param {string} strategyId 新的策略ID
   */
  switchStrategy(strategyId) {
    console.log(`切换策略: ${this.currentStrategyId.value} -> ${strategyId}`)

    // 停止当前策略
    if (this.isRunning) {
      this.stop()
    }

    // 启动新策略
    this.currentStrategyId.value = strategyId
    if (this.onExecuteCallback) {
      this.start(strategyId, this.onExecuteCallback)
    }
  }

  /**
   * 检查并执行策略
   */
  async checkAndExecute() {
    const strategyId = this.currentStrategyId.value
    const strategy = getStrategyById(strategyId)

    if (!strategy || !strategy.enabled) {
      this.strategyStatus.value = 'stopped'
      return
    }

    // 检查是否在时间窗口内
    const timeWindowResult = checkStrategyTimeWindow(strategyId)

    if (!timeWindowResult.inWindow) {
      // 不在时间窗口内
      if (this.strategyStatus.value === 'running') {
        console.log(`策略 ${strategyId} 已退出时间窗口，状态改为等待`)
        this.strategyStatus.value = 'waiting'
      }
      return
    }

    // 在时间窗口内，检查是否需要执行
    const { intervalSeconds } = timeWindowResult
    const now = Date.now()

    // 检查是否到达执行间隔
    if (this.lastExecuteTime) {
      const timeSinceLastExecute = (now - this.lastExecuteTime) / 1000
      if (timeSinceLastExecute < intervalSeconds) {
        // 未到执行间隔，保持运行状态但不执行
        this.strategyStatus.value = 'running'
        return
      }
    }

    // 执行策略
    this.strategyStatus.value = 'running'
    await this.executeStrategy(strategy)
    this.lastExecuteTime = now
  }

  /**
   * 执行策略
   * @param {Object} strategy 策略配置对象
   */
  async executeStrategy(strategy) {
    console.log(`执行策略: ${strategy.name}`)

    try {
      // 准备执行参数
      const params = {}

      // 如果策略需要日期参数，获取最新交易日
      if (strategy.requiresDate) {
        const today = new Date()
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        params.date = await getLatestTradeDate(dateStr)
        console.log(`使用交易日期: ${params.date}`)
      }

      // 执行策略函数
      const result = await strategy.executeFunction(params)

      // 调用回调函数，通知父组件更新数据
      if (this.onExecuteCallback) {
        this.onExecuteCallback(result)
      }

      console.log(`策略执行成功，结果:`, result)
    } catch (error) {
      console.error(`策略执行失败:`, error)
      ElMessage.error(`策略执行失败: ${error.message}`)
    }
  }

  /**
   * 手动触发策略执行（不受时间窗口限制）
   */
  async manualExecute() {
    const strategyId = this.currentStrategyId.value
    const strategy = getStrategyById(strategyId)

    if (!strategy) {
      ElMessage.error('策略不存在')
      return
    }

    console.log(`手动执行策略: ${strategy.name}`)
    ElMessage.info('正在手动执行策略...')

    await this.executeStrategy(strategy)
  }

  /**
   * 获取策略状态
   */
  getStatus() {
    return {
      currentStrategyId: this.currentStrategyId.value,
      strategyStatus: this.strategyStatus.value,
      isRunning: this.isRunning,
      lastExecuteTime: this.lastExecuteTime
    }
  }
}

// 导出单例
export const strategyManager = new StrategyManager()

export default strategyManager
