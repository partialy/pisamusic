import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

export interface StartupWindowSnapshotPayload {
  mode: "agreement" | "loading";
  animationStyle: string;
  darkAppearance: boolean;
  logoUrl: string;
  appVersion: string;
  agreementTitle: string;
  agreementContent: string;
  agreementVersion: number;
  localModeAvailable: boolean;
  blockedMessage: string;
}

export interface StartupWindowBridge {
  ready(): void;
  agree(): Promise<boolean>;
  reject(): Promise<boolean>;
  quit(): Promise<boolean>;
  enterLocalMode(): Promise<boolean>;
  retry(): Promise<boolean>;
  onSnapshot(callback: (snapshot: StartupWindowSnapshotPayload) => void): () => void;
}

const startupWindowBridge: StartupWindowBridge = {
  ready() {
    ipcRenderer.send("startup:splash-ready");
  },
  agree() {
    return ipcRenderer.invoke("startup:agree");
  },
  reject() {
    return ipcRenderer.invoke("startup:reject");
  },
  quit() {
    return ipcRenderer.invoke("startup:quit");
  },
  enterLocalMode() {
    return ipcRenderer.invoke("startup:enter-local-mode");
  },
  retry() {
    return ipcRenderer.invoke("startup:retry");
  },
  onSnapshot(callback) {
    const handler = (
      _event: IpcRendererEvent,
      snapshot: StartupWindowSnapshotPayload,
    ) => {
      callback(snapshot);
    };
    ipcRenderer.on("startup:snapshot", handler);
    return () => {
      ipcRenderer.removeListener("startup:snapshot", handler);
    };
  },
};

contextBridge.exposeInMainWorld("startupWindowBridge", startupWindowBridge);
