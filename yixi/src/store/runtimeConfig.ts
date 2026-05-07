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

export const useRuntimeConfigStore = defineStore("runtimeConfig", {
  state: () => ({
    loaded: false,
    loading: false,
    error: "",
    endpoints: null as RuntimeEndpoints | null,
  }),
  actions: {
    async refresh() {
      if (this.loading) return this.endpoints;
      this.loading = true;
      this.error = "";
      try {
        await electronAPI.getBootstrapConfig();
        const endpoints = await electronAPI.getRuntimeEndpoints(true);
        this.applyEndpoints(endpoints);
        this.loaded = true;
        return endpoints;
      } catch (error) {
        const message = error instanceof Error ? error.message : "服务端配置加载失败";
        this.error = message;
        return this.endpoints;
      } finally {
        this.loading = false;
      }
    },

    applyEndpoints(endpoints: RuntimeEndpoints) {
      this.endpoints = endpoints;
      applyDirectApiEndpoints(endpoints);
      applyProxyApiEndpoints(endpoints);
    },
  },
});
