import { configManager } from "../config/configManager";
import { readOperationState, trackBusinessRequest } from "../operations/maintenance";
import { isInstallationReady } from "./setupService";
import { cleanupSyncHistory } from "./syncService";
let started = false;
/** 后台清理与业务维护门禁共存；不在模块加载时访问数据库。 */
export function startSyncCleanup(): void {
  if (started)
    return;
  started = true;
  let running = false, lastDay = "";
  const tick = async () => {
    if (running || !configManager.isInitialized() || readOperationState().maintenance || !await isInstallationReady())
      return;
    const day = new Date().toISOString().slice(0, 10);
    if (day === lastDay)
      return;
    running = true;
    const release = trackBusinessRequest();
    try {
      if (!readOperationState().maintenance) {
        await cleanupSyncHistory();
        lastDay = day;
      }
    }
    catch (error) {
      console.error("[sync] 历史清理失败", error);
    }
    finally {
      release();
      running = false;
    }
  };
  const timer = setInterval(() => { void tick().catch(error => console.error("[sync] 清理门禁失败", error)); }, 3600000);
  timer.unref();
}
