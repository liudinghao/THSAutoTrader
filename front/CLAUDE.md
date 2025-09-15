# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 提供在此代码库中工作的指导。
语言：简体中文

## 项目概述

这是一个基于 Vue 3 + Vite 的自动化控制面板，用于管理交易系统操作。作为股票交易自动化系统的前端界面。

## 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **Vite** - 现代化构建工具
- **Element Plus** - UI 组件库
- **Vue Router** - 客户端路由
- **Axios** - HTTP 客户端
- **ECharts** - 数据可视化
- **Less** - CSS 预处理器

## 架构设计

应用采用模块化 Vue 3 架构，包含：

- **单页应用 (SPA)** - 基于哈希的路由系统
- **组件化结构** - 可复用的 UI 组件
- **集中式路由** - 配置在 `src/router/index.js`
- **API 层** - `src/api/` 目录中的后端通信模块
- **服务层** - `src/services/` 目录中的业务逻辑
- **工具模块** - `src/utils/` 目录中的通用功能

### 主要目录

- `src/views/` - 各路由的页面组件
- `src/components/` - 可复用的 Vue 组件
- `src/api/` - API 服务模块
- `src/services/` - 业务逻辑服务
- `src/utils/` - 工具函数
- `src/config/` - 配置文件

## 开发命令

### 开发环境

```bash
npm run dev         # 启动开发服务器，端口 3000
npm run preview     # 本地预览生产构建
```

### 构建命令

```bash
npm run build       # 生产环境构建（输出到 ../html）
npm run build:prod  # 构建并提示完成
```

### 依赖管理

```bash
npm install         # 安装所有依赖
```

## 核心功能

- **交易自动化**: `TradingMonkey/Index.vue` - 主要交易界面
- **策略管理**: `TradingStrategy.vue` - 配置交易策略
- **股票池**: `StockPool.vue` - 管理股票关注列表
- **资产管理**: `AssetManagement.vue` - 投资组合跟踪
- **相似度分析**: `MultiStockChart.vue` - 股票相似度计算与可视化
- **LLM 接口**: `LLMInterface.vue` - AI 模型调试
- **数据更新**: `DataUpdate.vue` - 市场数据同步

## TradingMonkey 模块架构

### 目录结构
```
src/views/TradingMonkey/
├── Index.vue                    # 主入口组件
├── components/                  # 子组件
│   ├── StockMonitor.vue        # 股票监控组件
│   ├── PositionManager.vue     # 持仓管理组件
│   ├── MarketOverview.vue      # 市场概况组件
│   └── TradingAdvice.vue       # 交易建议组件
├── services/                    # 业务服务层
│   ├── dataSourceService.js    # 数据源服务
│   ├── stockAnalysisService.js # 股票分析服务
│   ├── marketAnalysisService.js # 市场分析服务
│   ├── tradingService.js       # 交易服务
│   ├── riskManager.js          # 风险管理
│   └── decisionEngine.js       # 决策引擎
└── composables/                 # 组合式API
    └── useStockMonitor.js      # 股票监控状态管理
```

### 设计原则

1. **组件职责分离**
   - 组件只负责 UI 展示和事件发射
   - 业务逻辑封装在 services 层
   - 状态管理使用 composables

2. **数据流设计**
   - 采用单向数据流
   - 父组件管理全局状态
   - 子组件通过事件与父组件通信

3. **状态管理**
   - 使用组合式API管理复杂状态
   - 业务相关的 composable 放在对应模块下
   - 通用的 composable 可放在根 composables 目录

### 股票监控模块（已重构）

#### useStockMonitor Composable
```javascript
// src/views/TradingMonkey/composables/useStockMonitor.js
export function useStockMonitor() {
  // 集中管理股票监控的所有状态和操作
  return {
    stocks,          // 响应式股票列表
    loading,         // 加载状态
    stockCodes,      // 计算属性：股票代码列表
    hasStocks,       // 计算属性：是否有股票
    
    // 方法
    fetchStocks,          // 获取股票数据
    updateRealTimeData,   // 更新实时数据
    addStock,             // 添加监控股票
    removeStock,          // 删除监控股票
    // ... 其他方法
  }
}
```

#### 组件通信模式
```javascript
// 父组件 (Index.vue)
const stockMonitor = useStockMonitor()

// 子组件 (StockMonitor.vue) - 只负责展示
<StockMonitor
  :stocks="stockMonitor.stocks.value"
  :loading="stockMonitor.loading.value.fetch"
  @add-stock="handleAddStock"
  @remove-stock="handleRemoveStock"
/>
```

### 开发指南

1. **添加新组件**
   - 组件放在 `components/` 目录
   - 只处理 UI 逻辑，业务逻辑放在 services
   - 使用事件与父组件通信

2. **添加新服务**
   - 服务类放在 `services/` 目录
   - 每个服务负责特定的业务域
   - 服务之间可以相互调用

3. **状态管理**
   - 复杂状态使用 composables 管理
   - 简单状态可以直接在组件中使用 ref/reactive
   - 跨组件状态提升到父组件

### 性能优化

1. **实时数据更新**
   - 使用 Map 优化数据查找
   - 只在交易时间进行轮询
   - 防抖处理避免频繁更新

2. **组件渲染**
   - 合理使用计算属性
   - 避免在模板中进行复杂计算
   - 大列表使用虚拟滚动（如需要）

## API 集成

- 后端 API 端点配置在 `src/api/` 目录
- 股票数据获取通过 `src/utils/quoteApi.js`
- IndexedDB 存储通过 `src/utils/indexedDB.js`

### quoteApi.js 函数清单

**⚠️ 在添加新功能前，请先检查此列表，避免重复造轮子！**

#### 时间工具函数
- `formatTimestamp(timestamp, format)` - 时间戳转换工具，支持自定义格式
- `timestampToTimeString(timestamp)` - 时间戳转换为 HH:mm:00 格式
- `timestampToDateTime(timestamp)` - 时间戳转换为完整日期时间格式

#### 交易日期相关
- `getLatestTradeDate(date)` - 获取最近一个交易日（YYYYMMDD格式）
- `getPreTradeDate(date)` - 获取上一个交易日
- `getPreviousTradeDates(date, count)` - 获取最近N个交易日列表
- `isTradingDay()` - 判断当前是否为交易日（基于真实交易日历）
- `isTradeTime(stockCode)` - 检查是否在交易时间内（调用同花顺API，最准确）

#### 行情数据获取
- `fetchMinuteData(stockCodes, date)` - 获取股票分时数据，支持多股票
- `fetchRealTimeQuote(stockCodes)` - 获取实时行情数据
- `fetchHistoryData(stockCodes, beginDate, endDate)` - 获取历史K线数据

#### 推送与监控
- `registerPush(codes, callback)` - 注册股票推送监听
- `unregisterPush(sessionId)` - 取消推送监听

#### 股票操作
- `jumpToQuote(code, stockCode)` - 跳转到分时图
- `placeOrder(cmdStatus, stockCode, price, amount)` - 调起下单窗口

#### 自选股管理
- `getSelfStocks()` - 获取自选股列表
- `addSelfStock(codes)` - 添加自选股
- `removeSelfStock(codes)` - 删除自选股

#### 股票代码获取
- `getAllStockCodes(needMarket)` - 获取所有股票代码（集合竞价策略用）
- `getStocksByConceptCode(conceptCode)` - 根据概念代码获取股票列表

#### 使用建议
1. **交易时间判断**：优先使用 `isTradeTime()` 而非自己写时间判断
2. **交易日判断**：使用 `isTradingDay()` 获取准确的交易日状态
3. **行情数据**：根据需求选择分时、实时或历史数据接口
4. **时间处理**：使用内置的时间转换函数，格式统一

## 构建配置

- **输出**: 构建到 `../html` 目录，使用哈希文件名
- **端口**: 开发服务器运行在 3000 端口
- **别名**: `@` 映射到 `src/` 目录
- **资源**: CSS 文件输出到 `css/` 目录，JS 到 `js/` 目录

## 导航结构

应用使用可折叠侧边栏导航，包含以下主要部分：

1. 交易猿 - 主要交易界面
2. 策略管理 - 交易策略配置
3. 股票池 - 股票关注列表管理
4. 资产管理 - 投资组合概览
5. 相似度分析 - 股票相似度计算与分析
6. LLM 调试 - AI 模型接口
7. 涨停天梯 - 涨停股票追踪
8. 数据更新 - 市场数据刷新
9. 窗口控制调试 - 系统调试

## UI/UX 规范

### 数据显示规范

**无数据状态显示规范**：
- 当数据获取失败、无数据或数据为空时，应显示 `--` 而不是显示无意义的 `0`
- `--` 表示"数据不可用"或"暂无数据"的状态，避免用户将其误解为实际数值
- ⚠️ **重要**：`0` 是有意义的数值，不应被当作无数据处理
- 适用场景：
  - API 请求失败
  - 数据源返回 null/undefined
  - 计算结果无效
  - 字段值为 null/undefined

**正确与错误的写法对比**：
```vue
<!-- ❌ 错误写法 - 会将 0 误判为无数据 -->
<span>{{ value || '--' }}</span>

<!-- ✅ 正确写法 - 准确判断 null/undefined -->
<span v-if="value !== null && value !== undefined">{{ value }}</span>
<span v-else>--</span>

<!-- ✅ 或使用计算属性 -->
<span>{{ displayValue }}</span>

computed: {
  displayValue() {
    // 明确检查 null 和 undefined，保留 0 值
    return this.value !== null && this.value !== undefined ? this.value : '--'
  }
}

<!-- ✅ 或使用三元运算符 -->
<span>{{ (value !== null && value !== undefined) ? value : '--' }}</span>
```

**常见Bug场景**：
- `value || '--'` 当 value 为 0 时错误显示 `--`
- `value ? value : '--'` 同样会将 0 当作假值处理
- 应该使用严格的 null/undefined 检查

**已实现参考**：
- `src/components/ReasonTags.vue` - 使用 `--` 表示无涨停原因数据

## API 接口字段规范

### 严格使用确定字段名

**🚨 严格禁止事项**：
- **禁止使用兜底代码**：如 `position?.实际数量 || position?.股票余额`
- **禁止字段名猜测**：必须明确后端API返回的确切字段名
- **禁止多重fallback**：不要写 `field1 || field2 || field3` 的代码

**✅ 正确做法**：
1. **API优先确认**：先查看实际API返回数据，确认字段名
2. **使用确定字段**：只使用后端确实返回的字段名
3. **文档同步**：在此文档中记录API字段结构

### 持仓数据API字段 (`/position`)

**确定的字段结构**：
```javascript
{
  "实际数量": "100",        // 真实持股数量
  "股票余额": "0",          // 股票余额（与实际数量含义不同）
  "可用余额": "0",          // 可用余额
  "证券代码": "300049",     // 股票代码
  "证券名称": "福瑞股份",    // 股票名称
  "成本价": "70.287",       // 成本价
  "市价": "82.240",         // 当前市价
  "市值": "8224.000",       // 市值
  "盈亏": "1195.330",       // 盈亏金额
  "盈亏比例(%)": "17.006",  // 盈亏比例
  "仓位占比(%)": "31.76",   // 仓位占比
  "冻结数量": "0",          // 冻结数量
  "序号": "1",              // 序号
  "当日买入": "0",          // 当日买入数量
  "当日卖出": "0",          // 当日卖出数量
  "持股天数": "1",          // 持股天数
  "交易市场": "深圳Ａ股"     // 交易市场
}
```

**字段使用规范**：
- **持股数量**：使用 `position.实际数量`（不是 `position.股票余额`）
- **股票代码**：使用 `position.证券代码`
- **股票名称**：使用 `position.证券名称`
- **成本价格**：使用 `position.成本价`
- **盈亏金额**：使用 `position.盈亏`
- **盈亏比例**：使用 `position['盈亏比例(%)']`

**代码示例**：
```javascript
// ✅ 正确：使用确定字段
const quantity = parseFloat(position.实际数量 || 0)

// ❌ 错误：兜底代码
const quantity = parseFloat(position.实际数量 || position.股票余额 || 0)
```
