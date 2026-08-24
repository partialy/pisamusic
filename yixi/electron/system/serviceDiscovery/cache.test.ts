import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../database/appDatabase";

let database: AppDatabase | null = null;

afterEach(() => {
  database?.close();
  database = null;
});

describe("service_discovery_cache", () => {
  it("使用 main-only 独立表并以 configVersion 阻止缓存回退", () => {
    database = new AppDatabase(":memory:");

    expect(database.setServiceDiscoveryCache({ configVersion: 3 }, 3)).toBe(true);
    expect(database.setServiceDiscoveryCache({ configVersion: 2 }, 2)).toBe(false);
    expect(database.getServiceDiscoveryCache()).toEqual(expect.objectContaining({
      document: { configVersion: 3 },
      configVersion: 3,
    }));

    database.setSetting("desktop-service-discovery-cache-v1", { configVersion: 99 }, 99);
    expect(database.getServiceDiscoveryCache()).toEqual(expect.objectContaining({
      document: { configVersion: 3 },
      configVersion: 3,
    }));
  });
});
