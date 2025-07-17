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

- **交易自动化**: `TradingMonkey.vue` - 主要交易界面
- **策略管理**: `TradingStrategy.vue` - 配置交易策略
- **股票池**: `StockPool.vue` - 管理股票关注列表
- **资产管理**: `AssetManagement.vue` - 投资组合跟踪
- **多股图表**: `MultiStockChart.vue` - 实时价格可视化
- **LLM 接口**: `LLMInterface.vue` - AI 模型调试
- **数据更新**: `DataUpdate.vue` - 市场数据同步

## API 集成

- 后端 API 端点配置在 `src/api/` 目录
- 股票数据获取通过 `src/utils/quoteApi.js`
- IndexedDB 存储通过 `src/utils/indexedDB.js`

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
5. 多品种分时图 - 实时价格监控
6. LLM 调试 - AI 模型接口
7. 涨停天梯 - 涨停股票追踪
8. 数据更新 - 市场数据刷新
9. 窗口控制调试 - 系统调试
