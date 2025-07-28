/**
 * 股票交易策略集合
 * 包含各种基于技术分析的买卖策略
 */

// 导入所有策略
export {
  analyzeSellPoints,
  convertRawData,
  formatAnalysisResults,
} from './sellPointAnalysis.js';

// 导出皮尔逊相关性算法
export {
  calculatePearsonCorrelation,
  calculateStockSimilarity,
  calculateSimilarityMatrix,
  getMostSimilarStocks,
  getCorrelationLabel,
} from './pearsonCorrelation.js';

// 策略类型枚举
export const STRATEGY_TYPES = {
  SELL_POINT_ANALYSIS: 'sell_point_analysis', // 卖出点分析
  VOLUME_PRICE_ANALYSIS: 'volume_price_analysis', // 量价关系分析
  TECHNICAL_INDICATORS: 'technical_indicators', // 技术指标
  PATTERN_RECOGNITION: 'pattern_recognition', // 形态识别
  PEARSON_CORRELATION: 'pearson_correlation', // 皮尔逊相关性分析
};

/**
 * 策略管理器
 * 统一管理所有交易策略
 */
export class StrategyManager {
  constructor() {
    this.strategies = new Map();
    this.registerStrategies();
  }

  /**
   * 注册所有策略
   */
  registerStrategies() {
    // 注册卖出点分析策略
    this.strategies.set(STRATEGY_TYPES.SELL_POINT_ANALYSIS, {
      name: '卖出点分析',
      description: '基于分时图量价关系的卖出点检测',
      execute: analyzeSellPoints,
    });
    
    // 注册皮尔逊相关性分析策略
    this.strategies.set(STRATEGY_TYPES.PEARSON_CORRELATION, {
      name: '皮尔逊相关性分析',
      description: '基于皮尔逊相关系数的股票相似度分析',
      execute: (data) => {
        const { stocks, dataType = 'changePercent' } = data || {};
        if (!Array.isArray(stocks) || stocks.length < 2) {
          throw new Error('至少需要两只股票才能进行相关性分析');
        }
        return getMostSimilarStocks(stocks, dataType);
      },
    });
  }

  /**
   * 执行指定策略
   * @param {string} strategyType 策略类型
   * @param {Object} data 输入数据
   * @returns {Object} 策略执行结果
   */
  executeStrategy(strategyType, data) {
    const strategy = this.strategies.get(strategyType);
    if (!strategy) {
      throw new Error(`未找到策略: ${strategyType}`);
    }

    return strategy.execute(data);
  }

  /**
   * 获取所有可用策略
   * @returns {Array} 策略列表
   */
  getAvailableStrategies() {
    return Array.from(this.strategies.entries()).map(([type, strategy]) => ({
      type,
      name: strategy.name,
      description: strategy.description,
    }));
  }
}

// 创建默认策略管理器实例
export const strategyManager = new StrategyManager();
