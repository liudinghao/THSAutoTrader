# 股票交易策略模块

本目录包含各种基于技术分析的股票买卖策略方法。

## 目录结构

```
strategies/
├── index.js              # 策略管理器主入口
├── sellPointAnalysis.js  # 卖出点分析策略
└── README.md            # 说明文档
```

## 策略列表

### 1. 竞价选股策略 (auctionPreselect.js)

基于集合竞价涨跌幅进行股票筛选的策略，适用于短线交易策略：

- **数据获取**：从外部API获取预选股票列表
- **行情计算**：分批获取历史行情数据，计算竞价涨跌幅
- **智能过滤**：根据竞价涨跌幅范围筛选股票
- **性能优化**：批处理和错误容错机制

#### 使用方法

```javascript
import { executeAuctionPreselect } from '@/strategies/auctionPreselect.js';

// 执行竞价选股策略
const result = await executeAuctionPreselect({
  date: '2025-09-16',
  minChange: 3,
  maxChange: 5,
  onProgress: (message, progress) => {
    console.log(`[${progress}%] ${message}`)
  }
});

console.log('策略结果:', result);
```

#### 返回结果格式

```javascript
{
  date: "2025-09-16",
  originalCount: 150,
  filteredCount: 25,
  stocks: [
    {
      code: "300033",
      name: "同花顺",
      zsz: "2000000000",
      reason_type: "技术突破,量价齐升",
      auction_change: 4.23,
      close_change: 5.67,
      next_day_return: null
    }
  ],
  filterCriteria: {
    minChange: 3,
    maxChange: 5
  },
  executionTime: 5420
}
```

### 2. 卖出点分析策略 (sellPointAnalysis.js)

基于分时图量价关系的卖出点检测策略，包含以下检测逻辑：

- **高位放量滞涨**（可多次出现，30 分钟内只出现一次）：

  - 检测最高价附近成交量放大但价格停滞的情况，且最高价未接近涨停。
  - 逻辑：每次满足条件时记录信号，但同一信号之间需间隔 30 分钟（30 根 K 线），即 30 分钟内只出现一次。

- **首次回调**（只出现一次）：

  - 检测从最高点回落 1%以上的首次回调信号。
  - 逻辑：最高点后首次出现价格回落超过 1%。

- **反弹乏力**（只出现一次，依赖首次回调）：

  - 首次回调后，先找到最低点，再从最低点后首次反弹 1%以上且成交量低于最高点量能时判为反弹乏力。
  - 逻辑：首次回调后，若出现一次像样反弹但量能不足，提示买盘乏力。

- **尾盘破位**（可多次出现）：

  - 检测最后 30 分钟内，价格跌破均价 1%，且成交量大于均量 1.2 倍的所有时刻。
  - 逻辑：尾盘出现多次放量下跌均会被记录。

- **盘中急跌放量**（可多次出现）：

  - 检测盘中任意时刻，某一分钟价格较前一分钟下跌超 1%，且成交量大于 5 均量 1.5 倍。
  - 逻辑：盘中每次急跌且放量都会被记录。

- **涨停打开且放量**（可多次出现）：
  - 检测每次涨停开板且放量的时刻。
  - 逻辑：前一分钟在涨停价（误差 0.01 元内），当前分钟低于涨停价 0.01 元且放量。

#### 信号出现次数说明

- 高位放量滞涨（30 分钟内只出现一次）、首次回调、反弹乏力：**只会出现一次**（或 30 分钟内只出现一次），并严格依赖逻辑链条。
- 尾盘破位、盘中急跌放量、涨停打开且放量：**可多次出现**，每次满足条件都会记录。

#### 使用方法

```javascript
import {
  analyzeSellPoints,
  convertRawData,
} from '@/strategies/sellPointAnalysis.js';

// 转换原始数据
const stockData = convertRawData(rawData);

// 执行分析
const results = analyzeSellPoints(stockData);

// 查看结果
console.log('分析结果:', results);
```

#### 返回结果格式

```javascript
{
  peakVolumeStagnation: {
    time: "2024-01-01 14:30:00",
    price: 10.50,
    volume: "1000000",
    description: "高位放量但价格停滞，主力可能出货",
    signal: "strong"
  },
  firstPullback: { /* ... */ },
  weakRebound: { /* ... */ },
  endBreakdown: { /* ... */ },
  summary: {
    riskLevel: "medium",  // low, medium, high
    sellSignals: 2,
    recommendations: ["检测到高位放量滞涨，建议减仓", "检测到首次回调，注意风险"]
  }
}
```

## 策略管理器

使用策略管理器可以统一管理所有策略：

```javascript
import { strategyManager, STRATEGY_TYPES } from '@/strategies/index.js';

// 获取所有可用策略
const strategies = strategyManager.getAvailableStrategies();

// 执行指定策略
const results = strategyManager.executeStrategy(
  STRATEGY_TYPES.SELL_POINT_ANALYSIS,
  stockData
);
```

## 扩展新策略

要添加新的策略，请按以下步骤操作：

1. 在 `strategies/` 目录下创建新的策略文件
2. 在 `index.js` 中导入并注册新策略
3. 更新 `STRATEGY_TYPES` 枚举
4. 在 `StrategyManager.registerStrategies()` 方法中注册新策略

## 注意事项

- 所有策略函数都应该返回统一格式的结果对象
- 建议包含错误处理和数据验证
- 策略结果应该包含可读的描述信息
- 考虑添加策略的置信度或信号强度指标
