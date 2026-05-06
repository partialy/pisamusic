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
        <div class="history-item" v-for="h in history" :key="h.id" @click="handleClick(h.text)">
          <span class="history-text">{{ h.text }}</span>
          <span class="history-delete" @click.stop="deleteHistory(h.id)">X</span>
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
import { computed, onMounted, watch } from "vue";
import { useLibraryStore } from "@/store";
import { storeToRefs } from "pinia";

const showHistory = computed(() => {
  return props.tips.length == 0;
});

const emit = defineEmits(["search"]);
const libraryStore = useLibraryStore();
const { searchHistory: history } = storeToRefs(libraryStore);

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
  async () => {
    await saveHistory(props.keywords);
  },
  {
    deep: true,
  }
);

const handleClick = (text: string) => {
  emit("search", text);
};

const deleteHistory = async (id: number) => {
  await libraryStore.deleteSearchHistory(id);
};

const saveHistory = async (text: string) => {
  await libraryStore.addSearchHistory(text);
};

const clearHistory = async () => {
  await libraryStore.clearSearchHistory();
};

onMounted(async () => {
  await libraryStore.loadSearchHistory();
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
