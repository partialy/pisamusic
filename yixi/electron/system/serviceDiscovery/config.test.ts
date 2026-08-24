import { describe, expect, it } from "vitest";
import { parseDiscoveryDocument, sortServiceOrigins } from "./config";

const validDocument = {
  schemaVersion: 1,
  configVersion: 1,
  publishedAt: "2026-08-24T10:35:00+08:00",
  desktop: {
    minimumSupportedVersion: "1.0.1",
    healthCheckPath: "/api/health",
    bootstrapPath: "/api/config/bootstrap",
    serviceOrigins: [{
      id: "primary",
      priority: 100,
      apiBaseUrl: "https://pm-server.hs.partialy.cn",
      realtimeBaseUrl: "https://pm-server.hs.partialy.cn",
    }],
    updateFeedBaseUrls: [
      "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64",
    ],
  },
};

describe("parseDiscoveryDocument", () => {
  it("接受当前线上 v1 文档", () => {
    expect(parseDiscoveryDocument(validDocument)).toEqual(validDocument);
  });

  it("拒绝 HTTP API 地址", () => {
    const input = structuredClone(validDocument);
    input.desktop.serviceOrigins[0].apiBaseUrl = "http://pm-server.hs.partialy.cn";
    expect(() => parseDiscoveryDocument(input)).toThrow(
      "desktop.serviceOrigins[0].apiBaseUrl 必须使用 HTTPS",
    );
  });

  it("拒绝重复 origin id", () => {
    const input = structuredClone(validDocument);
    input.desktop.serviceOrigins.push({
      ...input.desktop.serviceOrigins[0],
      priority: 200,
    });
    expect(() => parseDiscoveryDocument(input)).toThrow(
      "desktop.serviceOrigins id 不能重复：primary",
    );
  });

  it("拒绝空更新源数组", () => {
    const input = structuredClone(validDocument);
    input.desktop.updateFeedBaseUrls = [];
    expect(() => parseDiscoveryDocument(input)).toThrow("desktop.updateFeedBaseUrls");
  });

  it("按 priority 稳定排序候选 origin", () => {
    const input = structuredClone(validDocument);
    input.desktop.serviceOrigins = [
      { ...input.desktop.serviceOrigins[0], id: "third", priority: 300 },
      { ...input.desktop.serviceOrigins[0], id: "first", priority: 100 },
      { ...input.desktop.serviceOrigins[0], id: "second", priority: 100 },
    ];
    expect(sortServiceOrigins(parseDiscoveryDocument(input)).map((item) => item.id))
      .toEqual(["first", "second", "third"]);
  });

  it("拒绝非 1 schemaVersion", () => {
    expect(() => parseDiscoveryDocument({ ...validDocument, schemaVersion: 2 }))
      .toThrow("schemaVersion 只支持 1");
  });

  it("拒绝 configVersion=0", () => {
    expect(() => parseDiscoveryDocument({ ...validDocument, configVersion: 0 }))
      .toThrow("configVersion 必须是正整数");
  });

  it("拒绝 HTTP realtime 和 update feed", () => {
    const realtimeInput = structuredClone(validDocument);
    realtimeInput.desktop.serviceOrigins[0].realtimeBaseUrl = "http://socket.example.com";
    expect(() => parseDiscoveryDocument(realtimeInput)).toThrow("realtimeBaseUrl 必须使用 HTTPS");

    const feedInput = structuredClone(validDocument);
    feedInput.desktop.updateFeedBaseUrls = ["http://updates.example.com/feed"];
    expect(() => parseDiscoveryDocument(feedInput)).toThrow("updateFeedBaseUrls[0] 必须使用 HTTPS");
  });

  it("拒绝完整 URL 形式的 healthCheckPath", () => {
    const input = structuredClone(validDocument);
    input.desktop.healthCheckPath = "https://example.com/api/health";
    expect(() => parseDiscoveryDocument(input)).toThrow("healthCheckPath 必须是相对路径");
  });

  it("拒绝会被 URL 解析为跨源地址的反斜杠路径", () => {
    const healthInput = structuredClone(validDocument);
    healthInput.desktop.healthCheckPath = "/\\attacker.example/health";
    expect(() => parseDiscoveryDocument(healthInput))
      .toThrow("healthCheckPath 必须是相对路径");

    const bootstrapInput = structuredClone(validDocument);
    bootstrapInput.desktop.bootstrapPath = "/api\\bootstrap";
    expect(() => parseDiscoveryDocument(bootstrapInput))
      .toThrow("bootstrapPath 必须是相对路径");
  });

  it("丢弃远程未知字段", () => {
    const parsed = parseDiscoveryDocument({ ...validDocument, unexpectedSecret: "discard-me" });
    expect("unexpectedSecret" in parsed).toBe(false);
  });
});
