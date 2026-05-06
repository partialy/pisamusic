<template>
  <n-card class="tips-history">
    <template #header>
      <div class="tips-header">
        <div class="tips-title">搜索历史</div>
        <n-button @click="clearHistory">清空</n-button>
      </div>
    </template>
    <template #default v-if="showHistory">
      <div class="history-content">
        <div class="history-item" v-for="h in histroy" :key="h.time" @click="handleClick(h.text)">
          <span class="history-text">{{ h.text }}</span>
          <span class="history-delete" @click="deleteHistory(h)">X</span>
        </div>
      </div>
    </template>
    <template #default v-else>
      <div class="tips-content">
        <div class="tips-item" v-for="t in props.tips" :key="t.key" @click="handleClick(t.name)">
          <div class="tips-info" >
            <span class="tips-text">{{ t.name }} - </span>
            <span class="tips-singer">{{ t.singer }}</span>
          </div>
          <div class="tips-delete">🔥</div>
        </div>
      </div>
    </template>
  </n-card>
</template>

<script setup lang="ts">
import { NCard } from "naive-ui";
import { computed, onMounted, ref, watch } from "vue";

const showHistory = computed(() => {
  return props.tips.length == 0;
});

const emit = defineEmits(["search"]);

const props = withDefaults(
  defineProps<{
    tips: {
      key: string;
      name: string;
      singer: string;
    }[];
    keywords: string;
  }>(),
  {
    tips: () => [],
    keywords: "",
  }
);

watch(
  () => props.keywords,
  () => {
    console.log(props.keywords, "props.keywords");
    saveHistory(props.keywords);
  },
  {
    deep: true,
  }
);

const histroy = ref<
  {
    text: string;
    time: number;
  }[]
>([]);

const handleClick = (text: string) => {
  emit("search", text);
};

const updateHistory = () => {
  const history = localStorage.getItem("search-history");
  if (history) {
    histroy.value = JSON.parse(history);
    histroy.value.sort((a, b) => b.time - a.time);
    histroy.value = histroy.value.slice(0, 10);
  } else {
    localStorage.setItem("search-history", JSON.stringify([]));
    histroy.value = [];
    updateHistory();
  }
};

const deleteHistory = (h: { text: string; time: number }) => {
  const history = localStorage.getItem("search-history");
  if (history) {
    const historyList = JSON.parse(history) as { text: string; time: number }[];
    const exsitIndex = historyList.findIndex((i) => i.text === h.text);
    if (exsitIndex > -1) {
      historyList.splice(exsitIndex, 1);
      localStorage.setItem("search-history", JSON.stringify(historyList));
      updateHistory();
    }
  }
};

const saveHistory = (text: string) => {
  let history = localStorage.getItem("search-history");
  if (!history) history = "[]";
  const historyList = JSON.parse(history) as { text: string; time: number }[];
  const exsitIndex = historyList.findIndex((i) => i.text == text);
  console.log(exsitIndex,"exsitIndex");
  if (exsitIndex > -1) {
    historyList[exsitIndex] = { text, time: Date.now() };
    localStorage.setItem("search-history", JSON.stringify(historyList));
  } else {
    historyList.push({ text, time: Date.now() });
    localStorage.setItem("search-history", JSON.stringify(historyList));
  }
  updateHistory();
};

const clearHistory = () => {
  localStorage.setItem("search-history", JSON.stringify([]));
  updateHistory();
};

onMounted(() => {
  updateHistory();
});
</script>

<style lang="scss" scoped>
.tips-history {
  .tips-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .tips-title {
      font-size: 16px;
      font-weight: 600;
    }
  }
  .history-content {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 10px;
    .history-item {
      display: flex;
      align-items: center;
      cursor: pointer;
      justify-content: space-between;
      height: 28px;
      line-height: 28px;
      border: 1px solid #eee;
      padding: 4px 0 4px 1rem;
      max-width: 140px;
      border-radius: 14px;
      font-size: 12px;
      color: var(--color-text-secondary);

      .history-text {
        width: 100%;
        max-width: 120px;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      }
      .history-delete {
        width: 20px;
        text-align: left;
        cursor: pointer;
        color: red;
        opacity: 0;
      }
      &:hover {
        background-color: var(--color-bg-hover);

        .history-delete {
          opacity: 1;
        }
      }
    }
  }
  .tips-content {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 5px;
    .tips-item {
      display: flex;
      align-items: center;
      width: 100%;
      height: 40px;
      padding: 0 1rem;
      flex-direction: row;

      &:hover {
        background-color: var(--color-bg-hover);
        border-radius: 8px;
      }
      .tips-info {
        width: calc(100% - 20px);
        overflow: hidden;
        text-overflow: ellipsis;
        .tips-text {
          font-size: 16px;
          font-weight: 600;
        }
        .tips-singer {
          font-size: 14px;
          font-weight: 400;
          color: var(--color-text-secondary);
        }
      }
      .tips-delete {
        width: 20px;
      }
    }
  }
}
</style>
