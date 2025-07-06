import { createRouter, createWebHashHistory } from 'vue-router';
import {
  Monitor,
  TrendCharts,
  DataLine,
  Connection,
  Refresh,
} from '@element-plus/icons-vue';

const routes = [
  {
    path: '/',
    redirect: '/window-control',
  },
  {
    path: '/window-control',
    name: 'WindowControl',
    component: () => import('../views/WindowControl.vue'),
    meta: {
      title: '窗口控制调试',
      icon: Monitor,
      showInNav: true,
    },
  },
  {
    path: '/trading-strategy',
    name: 'TradingStrategy',
    component: () => import('../views/TradingStrategy.vue'),
    meta: {
      title: '交易策略',
      icon: TrendCharts,
      showInNav: true,
    },
  },
  {
    path: '/stock-pool',
    name: 'StockPool',
    component: () => import('../views/StockPool.vue'),
    meta: {
      title: '股票池管理',
      icon: DataLine,
      showInNav: true,
    },
  },
  {
    path: '/asset-management',
    name: 'AssetManagement',
    component: () => import('../views/AssetManagement.vue'),
    meta: {
      title: '资产管理',
      icon: DataLine,
      showInNav: true,
    },
  },
  {
    path: '/llm-interface',
    name: 'LLMInterface',
    component: () => import('../views/LLMInterface.vue'),
    meta: {
      title: 'deepseek',
      icon: Connection,
      showInNav: true,
    },
  },
  {
    path: '/zt-tian-ti',
    name: 'ZTTianTi',
    component: () => import('../views/ZTTianTi.vue'),
    meta: {
      title: '涨停天梯',
      icon: DataLine,
      showInNav: true,
    },
  },
  {
    path: '/data-update',
    name: 'DataUpdate',
    component: () => import('../views/DataUpdate.vue'),
    meta: {
      title: '数据更新',
      icon: Refresh,
      showInNav: true,
    },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
