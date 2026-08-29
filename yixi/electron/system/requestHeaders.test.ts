import { describe, expect, it } from "vitest";
import { mergeRequestHeaders } from "./requestHeaders";

describe("mergeRequestHeaders", () => {
  it("按大小写不敏感规则合并 Authorization", () => {
    const headers = mergeRequestHeaders(
      { authorization: "Bearer session-token" },
      { Authorization: "Bearer explicit-token" },
    );

    expect(headers).toEqual({ authorization: "Bearer explicit-token" });
    expect(new Headers(headers).get("authorization")).toBe("Bearer explicit-token");
  });

  it("保留普通 Header 并允许调用方覆盖", () => {
    expect(mergeRequestHeaders(
      { "x-pm-random": "base", accept: "application/json" },
      { "X-PM-RANDOM": "override", "x-pm-device-id": "device" },
    )).toEqual({
      "x-pm-random": "override",
      accept: "application/json",
      "x-pm-device-id": "device",
    });
  });
});
