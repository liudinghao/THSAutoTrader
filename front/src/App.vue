<template>
  <div class="app-container">
    <NavBar :is-collapsed="isNavCollapsed" @toggle-collapse="toggleNavCollapse" />
    <main class="main-content" :class="{ 'nav-collapsed': isNavCollapsed }">
      <router-view></router-view>
    </main>
  </div>
</template>

<script>
import NavBar from './components/NavBar.vue'

export default {
  name: 'App',
  components: {
    NavBar
  },
  data() {
    return {
      isNavCollapsed: false
    }
  },
  methods: {
    toggleNavCollapse() {
      this.isNavCollapsed = !this.isNavCollapsed
    }
  }
}
</script>

<style lang="less" scoped>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.5;
  color: #333;
}

.app-container {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  margin-left: 200px;
  background-color: #f8f9fa;
  transition: margin-left 0.3s ease;

  &.nav-collapsed {
    margin-left: 60px;
  }
}
</style>