<template>
  <div class="playlist-container mw1600">
    <div class="tags" ref="tagsRef">
      <n-popover
        style="max-width: 600px"
        placement="bottom"
        trigger="click"
        v-for="tag in tags"
        :key="tag.tag_id"
        :arrow-style="{ background: '#EDE8FB99' }"
        :style="{
          background: 'linear-gradient(to top,#EDE8FB99,#F4F3F6cc)',
          'border-radius': '6px',
          'backdrop-filter': 'blur(10px)',
        }">
        <template #trigger>
          <n-button
            >{{ tag.tag_name }}
            <template #icon>
              <n-icon :component="chooseIcon(tag.tag_name)"></n-icon>
            </template>
          </n-button>
        </template>
        <div
          style="
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 8px;
            background: transparent;
          ">
          <n-button
            quaternary
            size="small"
            round
            v-for="item in tag.son"
            :key="item.tag_id"
            @click="handleClickTag(item)">
            {{ item.tag_name }}
          </n-button>
        </div>
      </n-popover>
    </div>
    <PlaylistCollect :playlist="playlists" />
    <div class="end-line" ref="endLineRef">
      <template v-if="hasNext">
        <n-spin :show="moreLoading">
          <template #icon>
            <n-icon
              :component="LoadingIcon"
              color="var(--color-primary)"></n-icon>
          </template>
          <template #description> 正在加载更多()... </template>
        </n-spin>
      </template>

      <div v-else class="no-more">没有更多了~</div>
    </div>
    <n-back-top class="scroll-top-btn" :right="20" :bottom="120"></n-back-top>
  </div>
</template>

<script setup lang="ts">
import { PlaylistCollect } from "@/components";
import { NPopover, NButton, NSpin, NBackTop } from "naive-ui";
import type { KGTag } from "@/utils/webapi";
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  SceneIcon,
  EmotionIcon,
  StyleIcon,
  YearIcon,
  ThemeIcon,
  LanguageIcon,
  QuestionIcon,
} from "@/icons";
import LoadingIcon from "@/icons/common/LoadingIcon.vue";
import { debounce } from "@/utils/common";
import type { CommonPlaylist } from "@/types/song";
import { convertor } from "@/utils/convertor";
import { getKgPlaylistTags, getTopPlaylists } from "@/utils/api/musicAPI";

const chooseIcon = (tagName: string) => {
  switch (tagName) {
    case "风格":
      return StyleIcon;
    case "场景":
      return SceneIcon;
    case "主题":
      return ThemeIcon;
    case "心情":
      return EmotionIcon;
    case "语种":
      return LanguageIcon;
    case "年代":
      return YearIcon;
    default:
      return QuestionIcon;
  }
};
const tags = ref<KGTag[]>([]);
const playlists = ref<CommonPlaylist[]>([]);
const getTags = async () => {
  const res: any = await getKgPlaylistTags();
  tags.value = res?.data || [];
};
getTags();

const curretTage = ref<KGTag>();
const hasNext = ref(true);
const moreLoading = ref(false);
const pagination = ref({
  page: 1,
  pageSize: 30,
});

const handleClickTag = async (tag: KGTag) => {
  curretTage.value = tag;
  pagination.value.page = 1;
  const res: any = await getTopPlaylists({
    source: "kg",
    categoryId: tag?.tag_id || 0,
    page: 1,
  });
  const l = (res?.data.special_list || []).map((i: any) =>
    convertor.KG.convertKGPlaylist(i, "item")
  );
  playlists.value = l;
};

const loadMore = debounce(async () => {
  try {
    if (moreLoading.value) return;
    moreLoading.value = true;
    if (!hasNext.value) return;
    pagination.value.page += 1;
    const res: any = await getTopPlaylists({
      source: "kg",
      categoryId: curretTage.value?.tag_id || 0,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    });
    if (res?.data.special_list) {
      playlists.value = playlists.value.concat(
        (res?.data.special_list || []).map((i: any) =>
          convertor.KG.convertKGPlaylist(i, "item")
        )
      );
      hasNext.value = res?.data.has_next == 1;
    }
  } catch (e) {
    console.error(e);
  } finally {
    setTimeout(() => {
      moreLoading.value = false;
    }, 500);
  }
}, 500);

const endLineRef = ref<HTMLElement | null>(null);
const tagsRef = ref<HTMLElement | null>(null);
let observerEndLine: IntersectionObserver;
let observerTags: IntersectionObserver;
const showScollTop = ref(false);
onMounted(async () => {
  handleClickTag({} as KGTag);
  observeEndLine();
  observeTags();
});

function observeEndLine() {
  observerEndLine = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      });
    },
    {
      root: null,
      threshold: 0.3,
    }
  );
  if (endLineRef.value) {
    observerEndLine.observe(endLineRef.value);
  }
}

function observeTags() {
  observerTags = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          showScollTop.value = false;
        } else {
          showScollTop.value = true;
        }
      });
    },
    {
      root: null,
      threshold: 0.1,
    }
  );
  if (tagsRef.value) {
    observerTags.observe(tagsRef.value);
  }
}

onBeforeUnmount(() => {
  if (observerEndLine && endLineRef.value) {
    observerEndLine.unobserve(endLineRef.value);
  }
  if (observerTags && endLineRef.value) {
    observerTags.unobserve(endLineRef.value);
  }
});
</script>

<style lang="scss" scoped>
.playlist-container {
  width: 100%;
  height: 100%;
  scroll-behavior: smooth;
  will-change: transform;

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px 0;
  }

  .end-line {
    height: 60px;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 1rem;

    .no-more {
      font-size: 14px;
      color: #999;
    }
  }

  .scroll-top-btn {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
    z-index: 20;
    background-color: var(--color-bg-default);
    border: none;
    opacity: 0.5;

    &:hover {
      opacity: 1;
    }
  }
}
</style>
