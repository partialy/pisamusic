<template>
  <div class="collect-con">
    <div class="title-con">
      <div class="title" v-if="showTitle">
        <h1>我的收藏</h1>
        <span>(共{{ songs.length }}首)</span>
      </div>
      <div class="title-bar">
        <div class="bar-left">
          <n-button round secondary>
            <template #icon>
              <n-icon
                size="28"
                color="var(--color-primary)"
                :component="PlaylistPlayIcon"></n-icon> </template
            >播放
          </n-button>
        </div>
        <div class="bar-right">
          <n-button>筛选</n-button>
          <n-button>下载</n-button>
          <n-input
            class="search-input"
            clearable
            v-model:value="searchKey"
            placeholder="搜索"
            round
            :style="{ width: searchFocus ? '160px' : '80px' }"
            @blur="searchFocus = false"
            @focus="searchFocus = true"
            @clear="searchKey = ''" />
        </div>
      </div>
    </div>
    <div class="content-con">
      <SongList v-show="change"
        :songs="songs"
        :search-key="searchKey"
        :min-size="64"
        show-footer
        show-header />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCollectStore } from "@/store";
import { storeToRefs } from "pinia";
import { NButton, NIcon, NInput } from "naive-ui";
import { PlaylistPlayIcon } from "@/icons";
import { SongList } from "@/components";
import { nextTick, onMounted, ref } from "vue";

const collector = useCollectStore();
const { songs } = storeToRefs(collector);
const showTitle = ref(true);
const searchKey = ref("");
const searchFocus = ref(false);
const change = ref(false);

onMounted(() => {
  change.value = false;
  nextTick(() => {
    change.value = true;
  });
});
</script>

<style lang="scss" scoped>
.collect-con {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .title-con {
    .title {
      display: flex;
      align-items: baseline;
      justify-content: start;

      h1 {
        font-size: 30px;
        line-height: 30px;
        font-weight: 600;
      }

      span {
        margin-left: 0.5rem;
        color: #999;
      }
    }

    .title-bar {
      margin-top: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .bar-left {
      }

      .bar-right {
        display: flex;
        align-items: center;
        gap: 1rem;
        justify-content: flex-end;

        .search-input {
          will-change: auto;
          transition: width 0.3s ease-in-out;
        }
      }
    }
  }

  .content-con {
    flex: 1;
    margin-top: 1rem;
    overflow: hidden;
  }
}
</style>
