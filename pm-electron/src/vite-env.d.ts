/// <reference types="vite/client" />

import type { PisaApi } from "@shared/ipc";

declare global {
  interface Window {
    pisa: PisaApi;
  }
}
