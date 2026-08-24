import { describe, expect, it, vi } from "vitest";
import { EMBEDDED_DISCOVERY_DOCUMENT } from "./config";
import { resolveServiceDiscovery } from "./resolver";
import type { DiscoveryDocumentV1 } from "./types";

function makeDocument(configVersion = 1) {
  return {
    ...structuredClone(EMBEDDED_DISCOVERY_DOCUMENT),
    configVersion,
  };
}

function makeDependencies() {
  return {
    fetchRemoteDocument: vi.fn<() => Promise<unknown>>(),
    readCachedDocument: vi.fn<() => unknown | null>().mockReturnValue(null),
    writeCachedDocument: vi.fn<(document: DiscoveryDocumentV1) => void>(),
    probeHealth: vi.fn<(url: string) => Promise<boolean>>().mockResolvedValue(true),
  };
}

describe("resolveServiceDiscovery", () => {
  it("正式环境优先使用可达的远程配置", async () => {
    const result = await resolveServiceDiscovery(
      { mode: "production", explicitBaseUrl: "" },
      {
        fetchRemoteDocument: vi.fn().mockResolvedValue(EMBEDDED_DISCOVERY_DOCUMENT),
        readCachedDocument: vi.fn().mockReturnValue(null),
        writeCachedDocument: vi.fn(),
        probeHealth: vi.fn().mockResolvedValue(true),
      },
    );
    expect(result.source).toBe("remote");
    expect(result.apiBaseUrl).toBe("https://pm-server.hs.partialy.cn");
  });

  it("远程失败时使用合法缓存", async () => {
    const dependencies = makeDependencies();
    dependencies.fetchRemoteDocument.mockRejectedValue(new Error("offline"));
    dependencies.readCachedDocument.mockReturnValue(makeDocument(2));
    const result = await resolveServiceDiscovery(
      { mode: "production", explicitBaseUrl: "" },
      dependencies,
    );
    expect(result.source).toBe("cache");
    expect(result.configVersion).toBe(2);
  });

  it("远程和缓存都非法时使用 embedded", async () => {
    const dependencies = makeDependencies();
    dependencies.fetchRemoteDocument.mockResolvedValue({});
    dependencies.readCachedDocument.mockReturnValue({ schemaVersion: 99 });
    const result = await resolveServiceDiscovery(
      { mode: "production", explicitBaseUrl: "" },
      dependencies,
    );
    expect(result.source).toBe("embedded");
    expect(result.configVersion).toBe(EMBEDDED_DISCOVERY_DOCUMENT.configVersion);
  });

  it("远程 configVersion 低于缓存时使用缓存", async () => {
    const dependencies = makeDependencies();
    dependencies.fetchRemoteDocument.mockResolvedValue(makeDocument(2));
    dependencies.readCachedDocument.mockReturnValue(makeDocument(3));
    const result = await resolveServiceDiscovery(
      { mode: "production", explicitBaseUrl: "" },
      dependencies,
    );
    expect(result.source).toBe("cache");
    expect(result.configVersion).toBe(3);
    expect(dependencies.writeCachedDocument).not.toHaveBeenCalled();
  });

  it("第一候选健康检查失败时选择下一候选", async () => {
    const document = makeDocument();
    document.desktop.serviceOrigins.push({
      id: "backup",
      priority: 200,
      apiBaseUrl: "https://backup-api.example.com",
      realtimeBaseUrl: "https://backup-socket.example.com",
    });
    const dependencies = makeDependencies();
    dependencies.fetchRemoteDocument.mockResolvedValue(document);
    dependencies.probeHealth.mockImplementation(async (url) => url.includes("backup-api"));
    const result = await resolveServiceDiscovery(
      { mode: "production", explicitBaseUrl: "" },
      dependencies,
    );
    expect(result.originId).toBe("backup");
  });

  it("所有候选不可达时仍返回第一候选", async () => {
    const dependencies = makeDependencies();
    dependencies.fetchRemoteDocument.mockResolvedValue(makeDocument());
    dependencies.probeHealth.mockResolvedValue(false);
    const result = await resolveServiceDiscovery(
      { mode: "production", explicitBaseUrl: "" },
      dependencies,
    );
    expect(result.originId).toBe("primary");
  });

  it("开发模式不拉远程配置并返回 localhost", async () => {
    const dependencies = makeDependencies();
    const result = await resolveServiceDiscovery(
      { mode: "development", explicitBaseUrl: "" },
      dependencies,
    );
    expect(result.source).toBe("development");
    expect(result.apiBaseUrl).toBe("http://127.0.0.1:53380");
    expect(dependencies.fetchRemoteDocument).not.toHaveBeenCalled();
  });

  it("显式环境变量覆盖开发默认地址", async () => {
    const result = await resolveServiceDiscovery(
      { mode: "development", explicitBaseUrl: "http://127.0.0.1:59999" },
      makeDependencies(),
    );
    expect(result.source).toBe("environment");
    expect(result.apiBaseUrl).toBe("http://127.0.0.1:59999");
  });
});
