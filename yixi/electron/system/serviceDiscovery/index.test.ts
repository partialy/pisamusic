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
    const setServiceDiscoveryCache = vi.fn();
    vi.doMock("electron", () => ({ app: { isPackaged: true } }));
    vi.doMock("../../database", () => ({
      getAppDatabase: () => ({
        getServiceDiscoveryCache: () => null,
        setServiceDiscoveryCache,
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
    expect(setServiceDiscoveryCache).toHaveBeenCalledTimes(1);
    expect(setServiceDiscoveryCache).toHaveBeenLastCalledWith(
      expect.objectContaining({ configVersion: 2 }),
      2,
    );
  });

  it("串行执行并合并并发 refresh，慢速旧请求不会晚到覆盖新快照", async () => {
    let releaseFirstRequest: () => void = () => {};
    const firstRequestGate = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });
    let discoveryRequestCount = 0;

    vi.doMock("electron", () => ({ app: { isPackaged: true } }));
    vi.doMock("../../database", () => ({
      getAppDatabase: () => ({
        getServiceDiscoveryCache: () => null,
        setServiceDiscoveryCache: vi.fn(),
      }),
    }));
    vi.doMock("../../utils/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn() },
    }));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === DISCOVERY_DOCUMENT_URL) {
        discoveryRequestCount += 1;
        if (discoveryRequestCount === 1) {
          await firstRequestGate;
          return new Response(JSON.stringify(makeDocument(2)), { status: 200 });
        }
        return new Response(JSON.stringify(makeDocument(3)), { status: 200 });
      }
      return new Response(null, { status: 200 });
    }));

    const { getServiceDiscoverySnapshot, initializeServiceDiscovery, refreshServiceDiscovery } =
      await import("./index");
    const initialization = initializeServiceDiscovery();
    const firstRefresh = refreshServiceDiscovery();
    const mergedRefresh = refreshServiceDiscovery();

    expect(firstRefresh).toBe(mergedRefresh);
    expect(discoveryRequestCount).toBe(1);
    releaseFirstRequest();

    expect((await initialization).configVersion).toBe(2);
    expect((await firstRefresh).configVersion).toBe(3);
    expect(getServiceDiscoverySnapshot().configVersion).toBe(3);
    expect(discoveryRequestCount).toBe(2);
  });
});
