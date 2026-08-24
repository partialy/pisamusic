import { afterEach, describe, expect, it, vi } from "vitest";
import { EMBEDDED_DISCOVERY_DOCUMENT, DISCOVERY_DOCUMENT_URL } from "./config";

function makeDocument(configVersion: number) {
  return {
    ...structuredClone(EMBEDDED_DISCOVERY_DOCUMENT),
    configVersion,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock("electron");
  vi.doUnmock("../../database");
  vi.doUnmock("../../utils/logger");
});

describe("refreshServiceDiscovery", () => {
  it("已有快照时不接受远程更低版本且缓存不可用的结果", async () => {
    const remoteDocuments = [makeDocument(2), makeDocument(1)];
    const setSetting = vi.fn();
    vi.doMock("electron", () => ({ app: { isPackaged: true } }));
    vi.doMock("../../database", () => ({
      getAppDatabase: () => ({
        getSetting: () => null,
        setSetting,
      }),
    }));
    vi.doMock("../../utils/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn() },
    }));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === DISCOVERY_DOCUMENT_URL) {
        return new Response(JSON.stringify(remoteDocuments.shift()), { status: 200 });
      }
      return new Response(null, { status: 200 });
    }));

    const { getServiceDiscoverySnapshot, initializeServiceDiscovery, refreshServiceDiscovery } =
      await import("./index");
    expect((await initializeServiceDiscovery()).configVersion).toBe(2);
    expect((await refreshServiceDiscovery()).configVersion).toBe(2);
    expect(getServiceDiscoverySnapshot().configVersion).toBe(2);
    expect(setSetting).toHaveBeenCalledTimes(1);
    expect(setSetting).toHaveBeenLastCalledWith(
      "desktop-service-discovery-cache-v1",
      expect.objectContaining({ configVersion: 2 }),
      2,
    );
  });
});
