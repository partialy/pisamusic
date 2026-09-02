import { describe, expect, it } from "vitest";
import type { DirectMessageItem } from "../../src/types/directMessage";
import {
  DirectMessageManager,
} from "./directMessageManager";
import type { DirectMessageIdentitySnapshot } from "./directMessageClient";
import { normalizeQueue, retryDelaysMs } from "./directMessageRules";

const identity: DirectMessageIdentitySnapshot = {
  token: "account-token",
  accountId: "user-1",
  deviceToken: "device-token",
};

const older: DirectMessageItem = {
  id: "m1",
  targetKind: "user",
  content: "old",
  createdAt: 1,
};

const newer: DirectMessageItem = {
  id: "m2",
  targetKind: "desktop_device",
  content: "new",
  createdAt: 2,
};

class FakeClient {
  ackIds: string[] = [];

  async listUnread() {
    return { items: [newer, older], hasMore: false };
  }

  async markRead(_identity: DirectMessageIdentitySnapshot, id: string) {
    this.ackIds.push(id);
  }

  pendingAck(id: string) {
    return this.ackIds.includes(id);
  }
}

describe("directMessage rules", () => {
  it("sorts, deduplicates, and exposes the bounded retry plan", () => {
    expect(normalizeQueue([newer, older, older])).toEqual([older, newer]);
    expect(retryDelaysMs).toEqual([0, 2_000, 8_000]);
  });

  it("advances the local queue immediately and suppresses same-process redisplay", async () => {
    const fakeClient = new FakeClient();
    const manager = new DirectMessageManager({
      client: fakeClient,
      getIdentity: () => identity,
    });

    await manager.listUnread();
    manager.dismiss("m1");

    expect(manager.currentQueue()[0]?.id).toBe("m2");
    await Promise.resolve();
    expect(fakeClient.pendingAck("m1")).toBe(true);
    expect(manager.filterDismissed([older, newer])).toEqual([newer]);
  });
});
