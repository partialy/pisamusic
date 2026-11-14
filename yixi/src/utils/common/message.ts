import { createDiscreteApi } from "naive-ui";
import { discreteThemeConfig } from "@/theme/discreteTheme";

const { message, notification, modal, dialog, loadingBar } = createDiscreteApi([
  "message",
  "dialog",
  "notification",
  "modal",
  "loadingBar",
], { configProviderProps: discreteThemeConfig });


export { message, notification, modal, dialog, loadingBar };
