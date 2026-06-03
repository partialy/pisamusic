import { defineStore } from "pinia";
import electronAPI from "@/utils/electron";
import { applyDirectApiEndpoints } from "@/utils/api/directAPI";
import { applyProxyApiEndpoints } from "@/utils/api/proxyAPI";

type RuntimeEndpoints = {
  kgServer: string;
  wyServer: string;
  kwServer: string;
  kgProxy: string;
  wyProxy: string;
  kwProxy: string;
};

let pendingRefresh: Promise<RuntimeEndpoints | null> | null = null;

export const useRuntimeConfigStore = defineStore("runtimeConfig", {
  state: () => ({
    loaded: false,
    loading: false,
    error: "",
    endpoints: null as RuntimeEndpoints | null,
    isDev: true,
  }),
  actions: {
    async refresh() {
      if (pendingRefresh) return pendingRefresh;
      this.loading = true;
      this.error = "";
      pendingRefresh = (async () => {
        try {
          await electronAPI.getBootstrapConfig();
          const endpoints = await electronAPI.getRuntimeEndpoints(true);
          const isDev = await electronAPI.isDevelopmentRuntime();
          this.applyEndpoints(endpoints);
          this.loaded = true;
          this.isDev = isDev;
          return endpoints;
        } catch (error) {
          const message = error instanceof Error ? error.message : "服务端配置加载失败";
          this.error = message;
          return this.endpoints;
        } finally {
          this.loading = false;
          pendingRefresh = null;
        }
      })();
      return pendingRefresh;
    },

    applyEndpoints(endpoints: RuntimeEndpoints) {
      this.endpoints = endpoints;
      applyDirectApiEndpoints(endpoints);
      applyProxyApiEndpoints(endpoints);
    },
  },
});
