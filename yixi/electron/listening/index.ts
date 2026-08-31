import { ListeningManager } from "./listeningManager";

let listeningManager: ListeningManager | null = null;

export function getListeningManager(): ListeningManager {
  if (!listeningManager) {
    listeningManager = new ListeningManager();
  }
  return listeningManager;
}

export * from "./listeningRules";
export * from "./listeningStore";
export * from "./listeningClient";
export * from "./listeningManager";
