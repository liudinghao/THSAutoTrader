import { createRouter, createWebHistory } from 'vue-router';
import {
  Monitor,
  TrendCharts,
  DataLine,
  Connection,
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
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
