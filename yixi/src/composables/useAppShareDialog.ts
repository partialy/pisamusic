import { ref } from "vue";

// Header 持有唯一弹窗实例，关于页和设置菜单共用这个入口。
const visible = ref(false);
export function useAppShareDialog() {
  return { appShareVisible: visible, openAppShare: () => { visible.value = true; } };
}
