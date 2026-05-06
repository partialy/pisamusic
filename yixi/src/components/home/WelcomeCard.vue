<template>
  <div class="welcome-card-container">
    <n-card class="welcome-card hello-card">
      <template #header>
        <strong>{{ greet.username }}</strong>
        <span>，</span>
        <span>{{ greet.greeting }}</span>
      </template>
      <div>{{ greet.public }}</div>
    </n-card>
    <n-card class="welcome-card">
      <template #header>
        <div class="title">热门歌曲</div>
      </template>
      <div>这里可以展示一些热门歌曲的列表，供用户快速访问和播放。</div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { mainAPI } from "@/utils/api/mainAPI";
import { NCard } from "naive-ui";
import { onMounted, reactive } from "vue";
const greet = reactive({
  username: "游客",
  greeting: "早上好",
  public: "暂无公告",
})

const fetchData = async () => {
  const res = await mainAPI.getHomeData(window.$mainServer);
  greet.username = localStorage.getItem("username") || "游客";
  greet.greeting = getGreeting();
  greet.public = res.data?.public || "暂无公告";
}

const getGreeting = () => { 
  const time = new Date().getHours();
  if(time >= 6 && time < 12){
    return "上午好";
  }else if(time >= 12 && time < 18){
    return "下午好";
  }else if(time >= 18 && time < 24){
    return "晚上好";
  } else{
    return "夜深了，早点休息";
  }
}

onMounted(() => {
  fetchData();
})
</script>

<style lang="scss" scoped>

.welcome-card-container {
  display: flex;
  height: 100%;
  width: 100%;
  gap: 1.5rem;

  .welcome-card {
    width: 40%;
    height: 200px;
    border-radius: 12px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.3s ease;
    background: #ffffff30;
    &:hover {
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
      transform: scale(1.1);
    }
    animation: slide-in 0.5s ease-in-out forwards;
    transition: all 0.2s ease;
  }
  .hello-card {
    flex: 1;
  }
}
</style>
