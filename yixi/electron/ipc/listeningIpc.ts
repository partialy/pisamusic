import { ipcMain } from "electron";
import { getListeningManager } from "../listening";
import type { ListeningPlaybackObservation } from "../../src/types/listening";

let registered = false;

export function setupListeningIpc() {
  if (registered) return;
  registered = true;

  ipcMain.on("listening:observe", (_event, observation: ListeningPlaybackObservation) => {
    if (!observation || typeof observation !== "object") return;
    getListeningManager().observe({
      track: observation.track ?? null,
      active: Boolean(observation.active),
      terminalReason: observation.terminalReason ?? null,
    });
  });

  ipcMain.handle("listening:summary", async () => {
    return getListeningManager().getCurrentSummary();
  });
}
