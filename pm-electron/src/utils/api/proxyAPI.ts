import type { Song } from "@/types/song";
import { WYAPI, KGAPI, KWAPI } from "../webapi";
import { interceptor } from "./directAPI";

class ProxyAPI {
  kg: KGAPI | null = null;
  wy: WYAPI | null = null;
  kw: KWAPI | null = null;
  static instance: ProxyAPI | null = null;

  static getInstanse() {
    if (this.instance) return this.instance;
    this.instance = new ProxyAPI();
    return this.instance;
  }

  constructor() {
    this.kg = new KGAPI({
      baseURL: "https://gateway.partialy.cn/proxy-service/proxy/kg",
    });
    this.wy = new WYAPI({
      baseURL: "https://gateway.partialy.cn/proxy-service/proxy/wy",
    });
    this.kw = new KWAPI({
      baseURL: "https://gateway.partialy.cn/proxy-service/proxy/kw",
    });
    this.kg.getRequest().interceptors.request.use(interceptor);
    this.kw.getRequest().interceptors.request.use(interceptor);
    this.wy.getRequest().interceptors.request.use(interceptor);
  }
}
export const proxyAPI = ProxyAPI.getInstanse();
export async function getUrlByProxy(song: Song) {
  try {
    switch (song.source) {
      case "kg":
        const kr = await proxyAPI.kg?.url({
          hash: song.urlParam,
          quality: "128",
        });
        // @ts-ignore
        if (kr?.fail_process && kr.fail_process.includes("buy")) {
          window.$notification.error({ title: "需要购买", duration: 1000 });
          return "";
        }
        return kr?.url[0] || kr?.backupUrl[0] || "";
      case "wy":
        const yr = await proxyAPI.wy?.songUrl({
          id: song.urlParam,
          br: 128000,
          //@ts-ignore
          realIP: "116.25.146.177",
        });
        return yr?.data[0]?.url || "";
      case "kw":
        const wr = await proxyAPI.kw?.url({
          id: song.urlParam,
          quality: "standard",
        });
        return wr?.url || "";
      default:
        return "";
    }
  } catch (error: any) {
    window.$notification.error({
      title: "发生错误",
      content: "获取播放地址失败：" + error.message,
      duration: 1000,
    });
    return "";
  }
}
