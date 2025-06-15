<template>
  <nav class="navbar" :class="{ collapsed: isCollapsed }">
    <div class="nav-content">
      <div class="nav-items">
        <router-link 
          v-for="item in navItems" 
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          <el-icon>
            <component :is="item.icon" />
          </el-icon>
          <span v-show="!isCollapsed">{{ item.title }}</span>
        </router-link>
      </div>
      <div class="collapse-btn" @click="$emit('toggle-collapse')">
        <el-icon>
          <component :is="isCollapsed ? 'ArrowRight' : 'ArrowLeft'" />
        </el-icon>
      </div>
    </div>
  </nav>
</template>

<script>
import { ArrowLeft, ArrowRight, Monitor, TrendCharts, DataLine } from '@element-plus/icons-vue'

export default {
  name: 'NavBar',
  components: {
    ArrowLeft,
    ArrowRight,
    Monitor,
    TrendCharts,
    DataLine
  },
  props: {
    isCollapsed: {
      type: Boolean,
      default: false
    }
  },
  watch: {
    isCollapsed(newValue) {
      localStorage.setItem('navCollapsed', newValue.toString())
    }
  },
  created() {
    const savedState = localStorage.getItem('navCollapsed')
    if (savedState !== null) {
      this.$emit('update:isCollapsed', savedState === 'true')
    }
  },
  data() {
    return {
      navItems: [
        {
          path: '/window-control',
          title: '窗口控制调试',
          icon: 'Monitor'
        },
        {
          path: '/trading-strategy',
          title: '交易策略',
          icon: 'TrendCharts'
        },
        {
          path: '/stock-pool',
          title: '股票池管理',
          icon: 'DataLine'
        },
        {
          path: '/asset-management',
          title: '资产管理',
          icon: 'DataLine'
        }
      ]
    }
  },
  methods: {
    isActive(path) {
      return this.$route.path === path
    }
  }
}
</script>

<style lang="less" scoped>
@primary-color: #2c3e50;
@hover-color: #34495e;
@active-color: #3498db;

.navbar {
  width: 200px;
  height: 100vh;
  background-color: @primary-color;
  color: #fff;
  position: fixed;
  left: 0;
  top: 0;
  transition: width 0.3s ease;

  &.collapsed {
    width: 60px;

    .nav-item {
      padding: 0.75rem;
      justify-content: center;

      .el-icon {
        margin-right: 0;
      }
    }
  }
}

.nav-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  cursor: pointer;
  transition: background-color 0.3s;
  border-top: 1px solid rgba(255, 255, 255, 0.1);

  &:hover {
    background-color: @hover-color;
  }

  .el-icon {
    font-size: 1.2rem;
  }
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 0;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  color: #fff;
  text-decoration: none;
  transition: background-color 0.3s;

  &:hover {
    background-color: @hover-color;
  }

  &.active {
    background-color: @active-color;
  }

  .el-icon {
    margin-right: 0.75rem;
    width: 20px;
    text-align: center;
  }

  span {
    font-size: 0.9rem;
  }
}
</style>