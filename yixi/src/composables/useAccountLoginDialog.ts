import { h } from "vue";
import LoginCard from "@/components/home/LoginCard.vue";
import { renderIcon } from "@/utils/common";

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
      style: { borderRadius: "10px" },
      preset: "dialog",
      icon: renderIcon(h("span"), {}, { color: "red" }),
      closable: true,
      content: () => h(LoginCard),
      onAfterLeave: opts?.onAfterLeave,
    });
  }

  return {
    openAccountLogin,
  };
}
