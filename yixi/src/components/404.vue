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
  color: var(--text-primary);
  font-family: inherit;
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
  border-radius: 12px;
  background-color: var(--surface-card);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
}

.error-code {
  font-size: 5rem;
  margin: 0;
  line-height: 1;
  color: var(--color-primary);
  font-weight: 800;
}

.error-message {
  font-size: 1.2rem;
  margin: 1rem 0 2rem;
  color: var(--text-secondary);
}

.home-button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  color: var(--text-on-accent);
  background-color: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;

  &:hover {
    background-color: var(--color-primary-hover);
  }

  &:active {
    background-color: var(--color-primary-pressed);
    transform: scale(0.98);
  }
}
</style>