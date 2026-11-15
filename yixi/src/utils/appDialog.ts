import { shallowReactive, reactive } from "vue";
import type { DialogApi, DialogOptions, DialogReactive } from "naive-ui";
import { reportError } from "./errorReporter";

type DialogEntry = { dialog: DialogReactive; show: boolean; busy: boolean };
export const appDialogs = shallowReactive<DialogEntry[]>([]);
let nextKey = 0;

function create(options: DialogOptions): DialogReactive {
  const entry = reactive<DialogEntry>({
    dialog: { ...options, key: `app-dialog-${++nextKey}`, destroy: () => { entry.show = false; } },
    show: true,
    busy: false,
  });
  appDialogs.push(entry);
  return entry.dialog;
}

export const appDialog: DialogApi = {
  create,
  destroyAll: () => { appDialogs.forEach(({ dialog }) => dialog.destroy()); },
  info: (options) => create({ ...options, type: "info" }),
  success: (options) => create({ ...options, type: "success" }),
  warning: (options) => create({ ...options, type: "warning" }),
  error: (options) => create({ ...options, type: "error" }),
};

export async function runDialogAction(entry: DialogEntry, action: "positive" | "negative" | "close", event?: MouseEvent) {
  if (entry.busy || entry.dialog.loading) return;
  entry.busy = true;
  try {
    const result = action === "close"
      ? await entry.dialog.onClose?.()
      : await entry.dialog[action === "positive" ? "onPositiveClick" : "onNegativeClick"]?.(event!);
    if (result !== false) entry.dialog.destroy();
  } catch (error) {
    reportError(error);
    window.$message?.error("操作失败，请重试");
  } finally {
    entry.busy = false;
  }
}

export function removeDialog(entry: DialogEntry) {
  const index = appDialogs.indexOf(entry);
  if (index < 0) return;
  appDialogs.splice(index, 1);
  entry.dialog.onAfterLeave?.();
}
