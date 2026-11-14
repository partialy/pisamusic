import { shallowRef } from "vue";
import type { ConfigProviderProps } from "naive-ui";

// 离散 API 独立于主应用注入树；由 App setup 同步，不在模块加载时访问 Pinia。
export const discreteThemeConfig = shallowRef<ConfigProviderProps>({});
