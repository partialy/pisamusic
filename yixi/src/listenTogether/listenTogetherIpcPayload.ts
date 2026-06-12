import type { ListenTogetherSocketCommand } from "@/types/listenTogether";

/**
 * contextBridge 会在进入 preload 函数前先克隆参数，因此 preload 内再清理 Vue Proxy 已经太晚。
 * 所有一起听命令必须先在 renderer 中转为纯 JSON DTO，再跨 contextBridge / IPC。
 */
export function toSerializableListenTogetherCommand(
  command: ListenTogetherSocketCommand,
): ListenTogetherSocketCommand {
  return JSON.parse(JSON.stringify(command)) as ListenTogetherSocketCommand;
}
