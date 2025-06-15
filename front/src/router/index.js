import { createRouter, createWebHistory } from 'vue-router';

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
    },
  },
  {
    path: '/trading-strategy',
    name: 'TradingStrategy',
    component: () => import('../views/TradingStrategy.vue'),
    meta: {
      title: '交易策略',
    },
  },
  {
    path: '/stock-pool',
    name: 'StockPool',
    component: () => import('../views/StockPool.vue'),
    meta: {
      title: '股票池管理',
    },
  },
  {
    path: '/asset-management',
    name: 'AssetManagement',
    component: () => import('../views/AssetManagement.vue'),
    meta: {
      title: '资产管理',
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
