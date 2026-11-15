import { createDiscreteApi } from "naive-ui";
import { discreteThemeConfig } from "@/theme/discreteTheme";

import { appDialog as dialog } from "@/utils/appDialog";

const { message, notification, modal, loadingBar } = createDiscreteApi([
  "message",
  "notification",
  "modal",
  "loadingBar",
], { configProviderProps: discreteThemeConfig });


export { message, notification, modal, dialog, loadingBar };
