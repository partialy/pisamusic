<template>
  <div class="placeholder-page">
    <div class="placeholder-card">
      <n-icon :component="UserRound" size="42" />
      <h1>我的</h1>
      <p>登录、账号资料和个人音乐资产会在这里整理。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon } from "naive-ui";
import { UserRound } from "lucide-vue-next";
</script>

<style scoped lang="scss">
.placeholder-page {
  width: 100%;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-card {
  width: min(420px, 100%);
  padding: 36px;
  border-radius: 16px;
  background: #fff;
  text-align: center;
  color: #2f343d;
  box-shadow: 0 16px 40px rgba(28, 38, 58, 0.08);

  h1 {
    margin: 16px 0 8px;
    font-size: 28px;
    letter-spacing: 0;
  }

  p {
    margin: 0;
    color: #7d838c;
  }
}
</style>
