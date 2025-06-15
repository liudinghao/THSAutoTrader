<template>
  <div class="app-container">
    <NavBar 
      v-model:is-collapsed="isNavCollapsed" 
      @toggle-collapse="toggleNavCollapse" 
    />
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
      isNavCollapsed: localStorage.getItem('navCollapsed') === 'true'
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
  overflow-x: hidden;
}

.app-container {
  display: flex;
  min-height: 100vh;
  overflow-x: hidden;
}

.main-content {
  flex: 1;
  margin-left: 200px;
  background-color: #f8f9fa;
  transition: margin-left 0.3s ease;
  overflow-x: hidden;
  width: calc(100% - 200px);

  &.nav-collapsed {
    margin-left: 60px;
    width: calc(100% - 60px);
  }
}
</style>