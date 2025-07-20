/**
 * 历史数据模拟播放代理
 * 用于将历史数据按照时间顺序逐步播放，模拟实时数据流
 */
import { fetchMinuteData, timestampToTimeString } from './quoteApi';

class SimulationDataProxy {
  constructor() {
    this.originalData = new Map(); // 保存原始历史数据
    this.simulationIndex = 0; // 当前播放索引
    this.simulationTimer = null; // 模拟定时器
    this.simulationSpeed = 60000; // 默认1分钟
    this.isSimulating = false; // 是否正在模拟
    this.callbacks = new Set(); // 数据更新回调函数集合
  }

  /**
   * 统一的数据获取接口
   * 如果在模拟交易状态下，返回模拟数据；否则直接返回原始数据
   * @param {Array} stockCodes - 股票代码数组
   * @param {string} date - 日期
   * @param {Object} preCloseMap - 昨收价映射表
   * @returns {Promise<Object>} 分时数据
   */
  async fetchMinuteData(stockCodes, date, preCloseMap = {}) {
    try {
      // 首先获取原始数据
      const originalData = await fetchMinuteData(stockCodes, date);

      if (!originalData) {
        console.warn('获取分时数据失败');
        return null;
      }

      // 保存原始数据到代理器
      this.saveOriginalData(originalData, preCloseMap);

      // 如果是模拟交易模式，返回模拟数据
      if (this.isSimulationMode) {
        return this.getSimulationData(originalData);
      } else {
        // 非模拟模式，直接返回原始数据
        return originalData;
      }
    } catch (error) {
      console.error('获取分时数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存原始数据到代理器
   * @param {Object} originalData - 原始分时数据
   * @param {Object} preCloseMap - 昨收价映射表
   */
  saveOriginalData(originalData, preCloseMap = {}) {
    // 清空之前的数据
    this.originalData.clear();

    // 保存新的原始数据
    for (const [stockKey, stockData] of Object.entries(originalData)) {
      if (stockData && typeof stockData === 'object') {
        // 转换数据格式为模拟播放需要的格式
        const chartData = [];
        const rawData = {};

        Object.entries(stockData).forEach(([timeStr, values]) => {
          // 时间字符串已经是 HH:mm:00 格式，无需转换

          // 计算涨跌幅，使用传入的昨收价
          const currentPrice = parseFloat(values.NEW || values.JUNJIA || 0);
          const preClose = preCloseMap[stockKey] || 1.0; // 使用传入的昨收价，如果没有则使用默认值
          const changePercent =
            preClose > 0 ? ((currentPrice - preClose) / preClose) * 100 : 0;

          chartData.push([timeStr, parseFloat(changePercent.toFixed(2))]);

          // 保存原始数据
          rawData[timeStr] = {
            NEW: values.NEW,
            JUNJIA: values.JUNJIA,
            VOL: parseFloat(values.VOL || 0),
            money: values.money,
          };
        });

        this.setOriginalData(stockKey, chartData, rawData);
      }
    }

    console.log(`已保存 ${this.originalData.size} 只股票的原始数据`);
  }

  /**
   * 获取模拟数据（到当前索引为止）
   * @param {Object} originalData - 原始数据
   * @returns {Object} 模拟数据
   */
  getSimulationData(originalData) {
    const simulationData = {};

    for (const [stockKey, stockData] of Object.entries(originalData)) {
      const currentSimulationData = this.getCurrentSimulationData(stockKey);

      if (currentSimulationData && currentSimulationData.data.length > 0) {
        // 将模拟数据转换回原始格式
        const convertedData = {};

        currentSimulationData.data.forEach(([timeStr, changePercent]) => {
          // 从原始数据中获取对应的价格信息
          const originalTimeData = currentSimulationData.rawData[timeStr];
          if (originalTimeData) {
            convertedData[timeStr] = originalTimeData;
          }
        });

        simulationData[stockKey] = convertedData;
      } else {
        // 如果没有模拟数据，返回空对象
        simulationData[stockKey] = {};
      }
    }

    return simulationData;
  }

  /**
   * 设置模拟交易模式
   * @param {boolean} mode - 是否开启模拟交易模式
   */
  setSimulationMode(mode) {
    this.isSimulationMode = mode;
    console.log(`模拟交易模式已${mode ? '开启' : '关闭'}`);

    if (!mode) {
      // 关闭模拟模式时，停止模拟播放
      this.stopSimulation();
    }
  }

  /**
   * 获取模拟交易模式状态
   * @returns {boolean} 是否在模拟交易模式
   */
  getSimulationMode() {
    return this.isSimulationMode;
  }

  /**
   * 设置原始历史数据
   * @param {string} key - 数据键（如股票代码）
   * @param {Array} data - 历史数据数组
   * @param {Object} rawData - 原始分时数据对象
   */
  setOriginalData(key, data, rawData = {}) {
    this.originalData.set(key, {
      data: [...data],
      rawData: { ...rawData },
    });
    console.log(`设置 ${key} 的原始数据，共 ${data.length} 个数据点`);
  }

  /**
   * 获取原始数据
   * @param {string} key - 数据键
   * @returns {Object|null} 原始数据对象
   */
  getOriginalData(key) {
    return this.originalData.get(key) || null;
  }

  /**
   * 获取当前模拟数据（到当前索引为止）
   * @param {string} key - 数据键
   * @returns {Object|null} 当前模拟数据
   */
  getCurrentSimulationData(key) {
    const original = this.originalData.get(key);
    if (!original || !original.data.length) {
      return null;
    }

    // 获取到当前索引的数据
    const currentData = original.data.slice(0, this.simulationIndex + 1);
    const currentRawData = {};

    // 构建当前时间点的原始数据
    currentData.forEach((dataPoint, index) => {
      const timeStr = dataPoint[0];
      const originalTimeData = original.rawData[timeStr];

      if (originalTimeData) {
        currentRawData[timeStr] = { ...originalTimeData };
      } else {
        // 如果没有原始数据，使用默认值
        currentRawData[timeStr] = {
          NEW: dataPoint[1] ? (dataPoint[1] + 100).toFixed(3) : '0.000',
          JUNJIA: dataPoint[1] ? (dataPoint[1] + 100).toFixed(3) : '0.000',
          VOL: '0',
          money: '0',
        };
      }
    });

    return {
      data: currentData,
      rawData: currentRawData,
      currentIndex: this.simulationIndex,
      totalLength: original.data.length,
    };
  }

  /**
   * 获取所有当前模拟数据
   * @returns {Map} 所有数据的当前模拟状态
   */
  getAllCurrentSimulationData() {
    const result = new Map();
    for (const [key] of this.originalData) {
      const currentData = this.getCurrentSimulationData(key);
      if (currentData) {
        result.set(key, currentData);
      }
    }
    return result;
  }

  /**
   * 启动模拟播放
   * @param {number} speed - 播放速度（毫秒）
   * @param {Function} onUpdate - 数据更新回调函数
   */
  startSimulation(speed = this.simulationSpeed, onUpdate = null) {
    if (this.isSimulating) {
      this.stopSimulation();
    }

    // 检查是否有数据
    if (this.originalData.size === 0) {
      console.warn('没有原始数据，无法启动模拟播放');
      return false;
    }

    this.simulationSpeed = speed;
    this.simulationIndex = 0;
    this.isSimulating = true;

    // 添加回调函数
    if (onUpdate && typeof onUpdate === 'function') {
      this.callbacks.add(onUpdate);
    }

    // 启动定时器
    this.simulationTimer = setInterval(() => {
      this.nextStep();
    }, speed);

    console.log(`模拟播放已启动，速度: ${speed / 1000}秒`);

    // 立即执行一次更新
    this.nextStep();

    return true;
  }

  /**
   * 停止模拟播放
   */
  stopSimulation() {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
    this.isSimulating = false;
    console.log('模拟播放已停止');
  }

  /**
   * 下一步（手动控制）
   */
  nextStep() {
    if (this.simulationIndex >= this.getMaxDataLength() - 1) {
      // 播放完毕，重置到开始
      this.simulationIndex = 0;
      console.log('模拟播放完成，重置到开始');
    } else {
      this.simulationIndex++;
    }

    // 触发所有回调函数
    this.triggerCallbacks();
  }

  /**
   * 设置播放索引
   * @param {number} index - 目标索引
   */
  setSimulationIndex(index) {
    const maxLength = this.getMaxDataLength();
    if (index >= 0 && index < maxLength) {
      this.simulationIndex = index;
      this.triggerCallbacks();
    }
  }

  /**
   * 获取最大数据长度
   * @returns {number} 最大数据长度
   */
  getMaxDataLength() {
    let maxLength = 0;
    for (const [, data] of this.originalData) {
      maxLength = Math.max(maxLength, data.data.length);
    }
    return maxLength;
  }

  /**
   * 获取当前播放进度
   * @returns {Object} 播放进度信息
   */
  getProgress() {
    const maxLength = this.getMaxDataLength();
    return {
      currentIndex: this.simulationIndex,
      totalLength: maxLength,
      progress: maxLength > 0 ? (this.simulationIndex + 1) / maxLength : 0,
      isSimulating: this.isSimulating,
    };
  }

  /**
   * 设置播放速度
   * @param {number} speed - 新的播放速度（毫秒）
   */
  setSpeed(speed) {
    this.simulationSpeed = speed;
    if (this.isSimulating) {
      // 重新启动模拟播放
      this.stopSimulation();
      this.startSimulation(speed);
    }
  }

  /**
   * 添加数据更新回调
   * @param {Function} callback - 回调函数
   */
  addCallback(callback) {
    if (typeof callback === 'function') {
      this.callbacks.add(callback);
    }
  }

  /**
   * 移除数据更新回调
   * @param {Function} callback - 回调函数
   */
  removeCallback(callback) {
    this.callbacks.delete(callback);
  }

  /**
   * 触发所有回调函数
   */
  triggerCallbacks() {
    const currentData = this.getAllCurrentSimulationData();
    const progress = this.getProgress();

    this.callbacks.forEach((callback) => {
      try {
        callback(currentData, progress);
      } catch (error) {
        console.error('模拟数据回调执行错误:', error);
      }
    });
  }

  /**
   * 清理资源
   */
  destroy() {
    this.stopSimulation();
    this.originalData.clear();
    this.callbacks.clear();
    this.isSimulationMode = false;
    console.log('模拟数据代理已销毁');
  }

  /**
   * 重置所有数据
   */
  reset() {
    this.stopSimulation();
    this.simulationIndex = 0;
    this.originalData.clear();
    this.isSimulationMode = false;
    console.log('模拟数据代理已重置');
  }
}

// 创建全局单例实例
const simulationProxy = new SimulationDataProxy();

// 导出单例和类
export default simulationProxy;
export { SimulationDataProxy };
