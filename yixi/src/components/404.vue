<template>
  <div class="not-found-container">
    <div class="content">
      <h1 class="error-code">404</h1>
      <p class="error-message">页面不存在({{ route.fullPath }})</p>
      <button @click="goHome" class="home-button">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
const route = router.currentRoute.value
console.log(route.fullPath, 'not found route')
const goHome = () => {
  router.push('/')
}
</script>

<style lang="scss" scoped>
.not-found-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  color: #343a40;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  text-align: center;
}

.content {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 2rem;
  width: 20rem;
  height: 20rem;
  border-radius: 8px;
  background-color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.error-code {
  font-size: 5rem;
  margin: 0;
  line-height: 1;
  color: #495057;
}

.error-message {
  font-size: 1.5rem;
  margin: 1rem 0 2rem;
  color: #6c757d;
}

.home-button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  color: white;
  background-color: #4285f4;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #3367d6;
  }

  &:active {
    transform: scale(0.98);
  }
}
</style>