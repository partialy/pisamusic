<template>
  <div class="cookie-account-page">
    <section class="account-hero" :style="{ '--source-color': pageInfo.color }">
      <div class="source-icon">
        <n-icon :component="pageInfo.icon" />
      </div>
      <div class="hero-copy">
        <p class="eyebrow">{{ pageInfo.sourceName }}</p>
        <h1>{{ pageInfo.title }}</h1>
        <p>{{ status.loggedIn ? loginDescription : logoutDescription }}</p>
      </div>
      <n-tag :bordered="false" round :color="tagColor">
        {{ status.loggedIn ? "Cookie 已就绪" : "未登录" }}
      </n-tag>
    </section>

    <section class="feature-grid">
      <div v-for="item in pageInfo.features" :key="item.title" class="feature-card">
        <n-icon :component="item.icon" />
        <div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.description }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { NIcon, NTag } from "naive-ui";
import { Heart, ListMusic, Radio, Sparkles } from "lucide-vue-next";
import { KGIcon, NeteaseIcon } from "@/icons";
import { useCookieAccountStatus } from "@/composables/useCookieAccountStatus";
import type { CookieSource } from "@/utils/api/cookieMusicAPI";

const route = useRoute();
const { accounts } = useCookieAccountStatus();

const source = computed<CookieSource>(() => (route.meta.source === "wy" ? "wy" : "kg"));
const status = computed(() => accounts[source.value]);

const sourceConfig = {
  kg: {
    sourceName: "酷狗音乐",
    title: "KG 个人数据",
    color: "#0062ff",
    icon: KGIcon,
    features: [
      { title: "我的歌单", description: "后续展示账号创建和收藏的酷狗歌单。", icon: ListMusic },
      { title: "云盘与资产", description: "预留云盘、会员资源和个人曲库入口。", icon: Sparkles },
      { title: "专属推荐", description: "后续接入登录态下的每日推荐和私人口味。", icon: Radio },
    ],
  },
  wy: {
    sourceName: "网易云音乐",
    title: "WY 个人数据",
    color: "#d71920",
    icon: NeteaseIcon,
    features: [
      { title: "我的歌单", description: "后续展示网易云创建、收藏和协作歌单。", icon: ListMusic },
      { title: "喜欢的音乐", description: "预留红心歌曲、最近播放和收藏内容入口。", icon: Heart },
      { title: "每日推荐", description: "后续接入登录态下的推荐歌单和歌曲。", icon: Radio },
    ],
  },
};

const pageInfo = computed(() => sourceConfig[source.value]);
const loginDescription = computed(() => {
  const name = status.value.nickname || status.value.userId || pageInfo.value.sourceName;
  return `${name} 的个人数据入口已经准备好，后续会逐步接入歌单、收藏和推荐。`;
});
const logoutDescription = computed(() => `登录 ${pageInfo.value.sourceName} 后，这个入口会在侧边栏显示。`);
const tagColor = computed(() => ({
  color: status.value.loggedIn ? `${pageInfo.value.color}18` : "rgba(120, 126, 138, 0.16)",
  textColor: status.value.loggedIn ? pageInfo.value.color : "#7d838c",
}));
</script>

<style scoped lang="scss">
.cookie-account-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.account-hero {
  --source-color: var(--color-primary);
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--source-color) 22%, var(--color-border-default));
  border-radius: 12px;
  background: color-mix(in srgb, var(--source-color) 8%, var(--color-card-bg));
}

.source-icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-card-bg);
  color: var(--source-color);
  font-size: 30px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
}

.hero-copy {
  min-width: 0;
  flex: 1;

  .eyebrow {
    margin: 0 0 4px;
    color: var(--source-color);
    font-size: 13px;
    font-weight: 700;
  }

  h1 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 24px;
    letter-spacing: 0;
  }

  p {
    margin: 8px 0 0;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.feature-card {
  min-height: 132px;
  display: flex;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
  background: var(--color-card-bg);

  > .n-icon {
    flex: 0 0 auto;
    color: var(--color-primary);
    font-size: 22px;
  }

  h2 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 16px;
    letter-spacing: 0;
  }

  p {
    margin: 8px 0 0;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }
}

@media (max-width: 1100px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
