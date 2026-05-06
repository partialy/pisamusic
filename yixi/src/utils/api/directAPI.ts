import type { InternalAxiosRequestConfig } from "axios";
import { KGAPI, KWAPI, WYAPI } from "../webapi";

let i: DirectAPI;
class DirectAPI {
  public kg: KGAPI | null = null;
  public wy: WYAPI | null = null;
  public kw: KWAPI | null = null;

  constructor() {
    this.kg = new KGAPI({ baseURL: "https://gateway.partialy.cn/kg-service" });
    this.wy = new WYAPI({ baseURL: "https://gateway.partialy.cn/wy-service" });
    this.kw = new KWAPI({
      baseURL: "https://gateway.partialy.cn/proxy-service/proxy/kw",
    });

    this.kg.getRequest().interceptors.request.use(interceptor);
    this.kw.getRequest().interceptors.request.use(interceptor);
    this.wy.getRequest().interceptors.request.use(interceptor);
  }

  static getInstanse() {
    if (i) return i;
    i = new DirectAPI();
    return i;
  }
}

export function interceptor(config: InternalAxiosRequestConfig) {
  config.headers["x-key"] = "partialy"
  config.params = { ...config.params, ...{ "x-key": "partialy" } };
  return config;
}

export default DirectAPI.getInstanse();
