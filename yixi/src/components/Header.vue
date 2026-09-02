<template>
  <div class="header">
    <div class="left">
      <!-- 后退,刷新按钮 -->
      <n-button-group>
        <n-button secondary class="back-btn left-btn" @click="goBack">
          <template #icon>
            <n-icon :component="BackIcon" />
          </template>
        </n-button>
        <n-button secondary class="refresh-btn left-btn" @click="refresh">
          <template #icon>
            <n-icon :component="RefreshIcon" />
          </template>
        </n-button>
      </n-button-group>
      <div style="position: relative">
        <n-input
          ref="searchInput"
          placeholder="搜索"
          class="search-input"
          round
          :style="{
            width: searchFocus ? '300px' : '200px',
            marginLeft: '1rem',
          }"
          @focus="searchFocus = true"
          @blur="mouseInTips ? null : (searchFocus = false)"
          @input="showTips"
          v-model:value="searchText"
          @keyup.enter="handleSearch()"
        >
          <!-- <template #prefix>
            <n-select
              :bordered="false"
              style="width: 60px"
              v-model:value="source"
              :options="sourceOptions"
            />
          </template> -->
          <template #prefix>
            <n-icon
              :component="SearchIcon"
              ref="searchBtn"
              @click="handleSearch"
              style="cursor: pointer"
            />
          </template>
        </n-input>

        <!-- search history -->
        <TipsHistory
          v-show="searchFocus"
          @mouseenter="mouseInTips = true"
          @mouseleave="mouseInTips = false"
          :tips="tips"
          :keywords="keywords"
          class="tips-history"
          @search="handleSearchClick"
        ></TipsHistory>
      </div>
    </div>
    <!-- 右侧内容 -->
    <div class="right">
      <n-dropdown
        v-if="isLogin"
        :options="dropDownOptions"
        trigger="click"
        @select="handleSelect"
        @update:show="handleUserMenuVisible"
        show-arrow
      >
        <div class="user">
          <n-avatar :src="avatar" round :size="34" class="avatar" />
          <span class="username" :title="userInfo.username || '-'">
            {{ userInfo.username || "-" }}
          </span>
          <span v-if="accountVipActive" class="vip-mark" title="VIP" aria-label="VIP">V</span>
        </div>
      </n-dropdown>
      <n-button v-else circle type="primary" class="login-btn" @click="login"
        >登录</n-button
      >
      <n-button
        v-if="development"
        circle
        type="warning"
        style="-webkit-app-region: no-drag; margin-right: 16px; cursor: pointer"
        @click="openDevTools"
      >
        <template #icon>
          <n-icon :component="DebugIcon" class="icon" />
        </template>
      </n-button>
      <!-- 定时关闭入口（位于设置左侧） -->
      <SleepTimerEntry class="sleep-timer-entry" />
      <n-dropdown
        :options="settingOptions"
        @select="handleSetting"
        trigger="click"
        show-arrow
      >
        <n-button secondary circle class="setting-btn">
          <template #icon>
            <n-icon :component="SettingIcon" class="icon" />
          </template>
        </n-button>
      </n-dropdown>
      <ElectronOperation></ElectronOperation>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TipsHistory } from "./search";
import { ElectronOperation } from "@/components";
import { SleepTimerEntry } from "./sleepTimer";
import { useAccountLoginDialog } from "@/composables/useAccountLoginDialog";
import {
  NButtonGroup,
  NButton,
  NInput,
  NIcon,
  NAvatar,
  NDropdown,
  type DropdownOption,
} from "naive-ui";
import { useRouter } from "vue-router";
import {
  AboutIcon,
  BackIcon,
  DebugIcon,
  LevelIcon,
  ListeningDurationIcon,
  MoonIcon,
  RefreshIcon,
  SearchIcon,
  SettingIcon,
  SunIcon,
} from "@/icons";
import {
  NotificationsOutline as AnnouncementIcon,
  Pencil as EditIcon,
  LogOutOutline as LogoutIcon,
  PersonCircleOutline as UserIcon,
} from "@vicons/ionicons5";
import { Sliders as EqualizerIcon } from "lucide-vue-next";
import { computed, onMounted, ref, watch } from "vue";
import type { ListeningSummary } from "@/types/listening";
import avatarImg from "../assets/defaultAdminAvatar.jpg";
import { renderIcon } from "@/utils/common";
import electronAPI from "@/utils/electron";
import { searchSuggest } from "@/utils/api/musicAPI";
import { useEqualizerStore, useThemeStore, useUserStore } from "@/store";
import { isSystemVipActive } from "@/types/account";
import { storeToRefs } from "pinia";

const userStore = useUserStore();
const themeStore = useThemeStore();
const equalizerStore = useEqualizerStore();
const { isLogin, userInfo } = storeToRefs(userStore);

const avatar = computed(() => userInfo.value.avatarUrl || userInfo.value.avatar || avatarImg);
const accountVipActive = computed(() => isSystemVipActive(userStore));
const router = useRouter();
const emit = defineEmits<{
  refresh: [];
}>();
const development = import.meta.env.DEV;
const isLocalMode = ref(false);

const openDevTools = () => {
  if(!development) return;
  electronAPI.openDevTools();
};
const { openAccountLogin: login } = useAccountLoginDialog();
const goBack = () => {
  router.back();
};

const refresh = () => {
  emit("refresh");
};

const searchFocus = ref(false);
const searchText = ref("");
const keywords = ref("");
const searchInput = ref<HTMLInputElement>();
const source = ref("kg");

const tips = ref<
  {
    key: string;
    name: string;
    singer: string;
  }[]
>([
  //   {
  //   key:"12",
  //   name:"13",
  //   singer:"155"
  // },{
  //   key:"13",
  //   name:"16",
  //   singer:"175"
  // }
]);
let suggestRequestId = 0;
const showTips = async () => {
  if (searchText.value) {
    const requestId = ++suggestRequestId;
    const res: any = await searchSuggest(searchText.value);
    if (requestId !== suggestRequestId) return;
    const l = res?.result.songs.map((s: any) => {
      return {
        key: s.id.toString(),
        name: s.name,
        singer: s.artists.map((item: any) => item.name).join(","),
      };
    });
    tips.value = l || [];
  } else {
    suggestRequestId++;
    tips.value = [];
  }
};
const mouseInTips = ref(false);
const handleSearch = () => {
  if (!searchText.value) return;
  keywords.value = searchText.value;
  searchInput.value?.blur();
  router.push({
    path: "/search",
    query: { key: searchText.value, tab: source.value },
  });
};

const handleSearchClick = (key: string) => {
  searchText.value = key;
  searchFocus.value = false;
  handleSearch();
};

const listeningSummary = ref<ListeningSummary>({
  totalMs: 0,
  totalMinutes: 0,
  level: { level: 1, minMinutes: 0, maxMinutes: null },
});
let latestSummaryRequestId = 0;

const loadListeningSummary = async () => {
  if (!isLogin.value) return;
  const requestId = ++latestSummaryRequestId;
  try {
    const summary = await electronAPI.getListeningSummary?.();
    if (requestId === latestSummaryRequestId && summary && typeof summary.totalMinutes === "number") {
      listeningSummary.value = summary;
    }
  } catch {
    // Keep cached summary on failure
  }
};

const handleUserMenuVisible = (visible: boolean) => {
  if (visible) {
    void loadListeningSummary();
  }
};

watch(
  () => userInfo.value.id,
  (newId) => {
    listeningSummary.value = {
      totalMs: 0,
      totalMinutes: 0,
      level: { level: 1, minMinutes: 0, maxMinutes: null },
    };
    if (newId) {
      void loadListeningSummary();
    }
  },
  { immediate: true }
);

const dropDownOptions = computed<DropdownOption[]>(() => [
  {
    label: `等级：Lv ${listeningSummary.value.level.level}`,
    key: "listening-level",
    disabled: true,
    icon: renderIcon(LevelIcon),
  },
  {
    label: `累计听歌：${listeningSummary.value.totalMinutes}分钟`,
    key: "listening-total",
    disabled: true,
    icon: renderIcon(ListeningDurationIcon),
  },
  {
    key: "listening-divider",
    type: "divider",
  },
  {
    label: "用户资料",
    key: "profile",
    icon: renderIcon(UserIcon),
  },
  {
    label: "编辑用户资料",
    key: "editProfile",
    icon: renderIcon(EditIcon),
  },
  {
    key: "header-divider",
    type: "divider",
  },
  {
    label: "退出登录",
    key: "logout",
    props: {
      style: { color: "red" },
    },
    icon: renderIcon(LogoutIcon, {
      style: { color: "red" },
    }),
  },
]);

const settingOptions = computed(() => {
  const options = [
    {
      label: "均衡器",
      key: "equalizer",
      icon: renderIcon(EqualizerIcon),
    },
    {
      label: themeStore.resolvedMode === "dark" ? "切换浅色" : "切换深色",
      key: "theme",
      icon: themeStore.resolvedMode === "dark"
        ? renderIcon(SunIcon)
        : renderIcon(MoonIcon),
    },
    {
      key: "header-divider",
      type: "divider",
    },
    {
      label: "基本设置",
      key: "setting",
      icon: renderIcon(SettingIcon),
    },
    {
      label: "查看公告",
      key: "announcements",
      icon: renderIcon(AnnouncementIcon),
    },

    {
      label: "关于",
      key: "about",
      icon: renderIcon(AboutIcon),
    },
    {
      label: "热重载",
      props: {
        style: { color: "#D12604" },
      },
      key: "exit",
      icon: renderIcon(RefreshIcon, { color: "#D12604" }),
    },
  ];

  if (isLocalMode.value) {
    options.push({
      label: "重新链接",
      props: {
        style: { color: "#18A058" },
      },
      key: "reconnect",
      icon: renderIcon(RefreshIcon, { color: "#18A058" }),
    });
  }

  return options;
});

const handleSelect = async (key: string) => {
  if (key === "listening-level" || key === "listening-total") return;
  if (key === "logout") {
    await userStore.logout();
    window.$message.success("已退出登录");
    return;
  }
  router.push({
    path: `/user/${key}`,
  });
};

const handleSetting = (key: string) => {
  if (key == "equalizer") {
    equalizerStore.openModal();
  } else if (key == "setting") {
    router.push("/setting");
  } else if (key == "announcements") {
    void router.push({ path: "/setting", query: { tab: "announcements" } });
  } else if (key == "theme") {
    void themeStore.toggleLightDark();
  } else if (key == "about") {
    void router.push({ path: "/setting", query: { tab: "about" } });
  } else if (key == "exit") {
    electronAPI.reloadWindow();
  } else if (key == "reconnect") {
    electronAPI.restartApp();
  }
};


onMounted(async () => {
  const startupServiceState = await electronAPI.getStartupServiceState?.();
  isLocalMode.value = Boolean(startupServiceState?.localMode);
  // const token = localStorage.getItem("token");
  // if (token) {
  //   // 获取用户信息
  //   const user = JSON.parse(localStorage.getItem("user-info") || "{}");
  //   avatar.value = user.avatar || avatarImg;
  //   username.value = user.username || "未登录";
  // }
});
</script>

<style lang="scss" scoped>
.header {
  height: var(--header-height);
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  -webkit-app-region: drag;

  .left {
    display: flex;
    align-items: center;
    padding-left: 16px;
    -webkit-app-region: drag;

    .search-input {
      -webkit-app-region: no-drag;
      transition: all 0.3s ease-in-out;
      
    }

    .tips-history {
      position: absolute;
      top: 40px;
      left: 1rem;
      width: 300px;
      min-height: 100px;
      max-height: 500px;
      overflow-y: auto;
      background-color: var(--color-bg-default);
      border-radius: 12px;
      box-shadow: 0 0 10px #00000033;
      z-index: 100;
    }
  }

  .left-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: transparent;
    -webkit-app-region: no-drag;

    &:hover {
      color: var(--color-primary);
    }
  }

  .right {
    display: flex;
    align-items: center;
    margin-right: 1rem;
    -webkit-app-region: drag;

    .user {
      -webkit-app-region: no-drag;
      margin-right: 1rem;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      max-width: 180px;
      height: 34px;
      box-sizing: border-box;
      padding: 0 12px 0 0;
      border: 1px solid var(--color-border-default);
      border-radius: 999px;
      background-color: var(--color-bg-default);
      cursor: pointer;
      transition: all 0.2s ease-in-out;

      &:hover {
        border-color: var(--color-primary);
      }

      .avatar {
        flex-shrink: 0;
        z-index: 1;
        width: 34px;
        height: 34px;
        border: 1px solid var(--color-border-default);
        box-shadow: 1px 1px 4px rgba(0, 0, 0, 0.08);

        :deep(img) {
          object-fit: cover;
        }
      }

      .username {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-text-default);
        font-size: 14px;
        line-height: 1;
      }

      .vip-mark {
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        border: 1px solid #d7a62e;
        border-radius: 4px;
        background: linear-gradient(145deg, #fff2ad, #d89d21);
        color: #714500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 12px;
        font-style: italic;
        font-weight: 900;
        line-height: 1;
        box-shadow: 0 2px 6px rgba(172, 112, 0, 0.28);
      }
    }

    .login-btn {
      -webkit-app-region: no-drag;
      margin-right: 16px;
      cursor: pointer;
      background-color: var(--color-primary);
    }

    .setting-btn {
      -webkit-app-region: no-drag;
      margin-right: 16px;

      .icon {
        transition: all 0.3s ease-in-out;
      }

      &:hover {
        .icon {
          color: var(--color-primary);
          transform: rotate(270deg);
        }
      }
    }
  }
}
</style>
