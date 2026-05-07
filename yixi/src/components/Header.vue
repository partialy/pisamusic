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
          <template #prefix>
            <n-select
              :bordered="false"
              style="width: 60px"
              v-model:value="source"
              :options="sourceOptions"
            />
          </template>
          <template #suffix>
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
        show-arrow
      >
        <div class="user">
          <n-avatar :src="avatar" round size="large" class="avatar" />
          <span class="username" title="username">{{
            userInfo.username || "-"
          }}</span>
        </div>
      </n-dropdown>
      <n-button v-else circle type="primary" class="login-btn" @click="login"
        >登录</n-button
      >
      <n-button
        circle
        type="warning"
        style="-webkit-app-region: no-drag; margin-right: 16px; cursor: pointer"
        @click="openDevTools"
      >
        <template #icon v-if="development">
          <n-icon :component="DebugIcon" class="icon" />
        </template>
      </n-button>
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
import { ElectronOperation, LoginCard } from "@/components";
import {
  NButtonGroup,
  NButton,
  NInput,
  NIcon,
  NAvatar,
  NDropdown,
  NSelect,
} from "naive-ui";
import { useRouter } from "vue-router";
import {
  AboutIcon,
  BackIcon,
  DebugIcon,
  MoonIcon,
  RefreshIcon,
  SearchIcon,
  SettingIcon,
  SunIcon,
} from "@/icons";
import {
  Pencil as EditIcon,
  LogOutOutline as LogoutIcon,
  PersonCircleOutline as UserIcon,
} from "@vicons/ionicons5";
import { h, onMounted, ref } from "vue";
import avatarImg from "../assets/defaultAdminAvatar.jpg";
import { renderIcon } from "@/utils/common";
import electronAPI from "@/utils/electron";
import { searchSuggest } from "@/utils/api/musicAPI";
import { useUserStore } from "@/store";
import { storeToRefs } from "pinia";

const avatar = ref(avatarImg);
const userStore = useUserStore();
const { isLogin, userInfo } = storeToRefs(userStore);
const router = useRouter();
const development = import.meta.env.DEV;

const openDevTools = () => {
  if(!development) return;
  electronAPI.openDevTools();
};
const login = async () => {
  window.$modal.create({
    style: { borderRadius: "10px" },
    preset: "dialog",
    icon: renderIcon(h("span"), {}, { color: "red" }),
    closable: true,
    content: () => h(LoginCard),
  });
};
const goBack = () => {
  router.back();
};

const refresh = () => {
  window.location.reload();
};

const searchFocus = ref(false);
const searchText = ref("");
const keywords = ref("");
const searchInput = ref<HTMLInputElement>();

const source = ref("kg");
const sourceOptions = [
  { label: "G", value: "kg" },
  { label: "W", value: "wy" },
  { label: "Q", value: "qq" },
  { label: "K", value: "kw" },
];

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

const dropDownOptions = [
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
];

const themeIcon = ref(
  localStorage.getItem("theme") == "light"
    ? renderIcon(MoonIcon)
    : renderIcon(SunIcon)
);

const settingOptions = [
  {
    label: "切换主题",
    key: "theme",
    icon: themeIcon.value,
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
    label: "关于",
    key: "about",
    icon: renderIcon(AboutIcon),
  },
  {
    label: "热重载",
    props: {
      style: { color: "red" },
    },
    key: "exit",
    icon: renderIcon(RefreshIcon, { color: "red" }),
  },
];

const handleSelect = (key: string) => {
  router.push({
    path: `user/${key}`,
  });
};

const handleSetting = (key: string) => {
  if (key == "setting") {
    router.push("/setting");
  } else if (key == "theme") {
    if (localStorage.getItem("theme") == "night") {
      localStorage.setItem("theme", "light");
      themeIcon.value = renderIcon(MoonIcon);
    } else {
      localStorage.setItem("theme", "night");
      themeIcon.value = renderIcon(SunIcon);
    }
    console.log(themeIcon.value);
  } else if (key == "about") {
    router.push("/about");
  } else if (key == "exit") {
    electronAPI.reloadWindow();
  }
};

onMounted(() => {
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
      border-radius: 4px;
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
      display: flex;
      align-items: center;

      .avatar {
        z-index: 1;
        width: 48px;
        height: 48px;
        border: 1px solid #66666666;
        box-shadow: 1px 1px 5px #00000022;
      }

      .username {
        cursor: pointer;
        padding: 0 5px 0 1.5rem;
        border-radius: 16px;
        display: inline-block;
        width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 2rem;
        position: relative;
        left: -20px;
        z-index: 0;
        border: 1px solid #666;
        background-color: #fefefe;
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
