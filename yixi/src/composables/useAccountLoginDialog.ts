import { h } from "vue";
import LoginCard from "@/components/home/LoginCard.vue";
import { UserRound } from "lucide-vue-next";
import { appModalProps, renderModalTitle } from "@/utils/appModal";

export interface AccountLoginDialogOptions {
  onAfterLeave?: () => void;
}

export function useAccountLoginDialog() {
  function openAccountLogin(options?: AccountLoginDialogOptions | Event | unknown) {
    const opts =
      options && typeof options === "object" && !("target" in options) && !("nativeEvent" in options)
        ? (options as AccountLoginDialogOptions)
        : undefined;

    return window.$modal.create({
      ...appModalProps,
      style: { width: "min(446px, calc(100vw - 32px))" },
      title: () => renderModalTitle("登录 PisaMusic", UserRound),
      closable: true,
      content: () => h(LoginCard),
      onAfterLeave: opts?.onAfterLeave,
    });
  }

  return {
    openAccountLogin,
  };
}
