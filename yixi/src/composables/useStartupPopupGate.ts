import { readonly, ref } from "vue";

const directMessagesSettled = ref(false);

export function useStartupPopupGate() {
  function setDirectMessagesSettled(settled: boolean) {
    directMessagesSettled.value = settled;
  }

  return {
    directMessagesSettled: readonly(directMessagesSettled),
    setDirectMessagesSettled,
  };
}
