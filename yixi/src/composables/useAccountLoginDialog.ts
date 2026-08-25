import { h } from "vue";
import LoginCard from "@/components/home/LoginCard.vue";
import { renderIcon } from "@/utils/common";

export function useAccountLoginDialog() {
  function openAccountLogin() {
    window.$modal.create({
      style: { borderRadius: "10px" },
      preset: "dialog",
      icon: renderIcon(h("span"), {}, { color: "red" }),
      closable: true,
      content: () => h(LoginCard),
    });
  }

  return {
    openAccountLogin,
  };
}
