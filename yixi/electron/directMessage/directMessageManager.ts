import type {
  DirectMessageItem,
  DirectMessageUnreadPage,
} from "../../src/types/directMessage";
import type { DirectMessageClient, DirectMessageIdentitySnapshot } from "./directMessageClient";
import { normalizeQueue, retryDelaysMs } from "./directMessageRules";

type DirectMessageClientLike = Pick<DirectMessageClient, "listUnread" | "markRead">;

type DirectMessageManagerOptions = {
  client?: DirectMessageClientLike;
  getIdentity?: () => DirectMessageIdentitySnapshot;
  sleep?: (delayMs: number) => Promise<void>;
  warn?: (event: string, metadata: Record<string, unknown>) => void;
};

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export class DirectMessageManager {
  private readonly client: DirectMessageClientLike;
  private readonly getIdentity: () => DirectMessageIdentitySnapshot;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly warn: (event: string, metadata: Record<string, unknown>) => void;
  private readonly dismissedThisProcess = new Set<string>();
  private readonly identityByMessageId = new Map<string, DirectMessageIdentitySnapshot>();
  private readonly inFlightAckIds = new Set<string>();
  private queue: DirectMessageItem[] = [];
  private generation = 0;

  constructor(options: DirectMessageManagerOptions = {}) {
    if (!options.client || !options.getIdentity) {
      throw new Error("DirectMessageManager requires a client and identity provider");
    }
    this.client = options.client;
    this.getIdentity = options.getIdentity;
    this.sleep = options.sleep ?? sleep;
    this.warn = options.warn ?? (() => undefined);
  }

  currentQueue(): readonly DirectMessageItem[] {
    return [...this.queue];
  }

  filterDismissed(items: readonly DirectMessageItem[]): DirectMessageItem[] {
    return items.filter((item) => !this.dismissedThisProcess.has(item.id));
  }

  async listUnread(): Promise<DirectMessageUnreadPage> {
    const requestGeneration = this.generation;
    const identity = this.getIdentity();
    const page = await this.client.listUnread(identity);
    if (requestGeneration !== this.generation) {
      return { items: [], hasMore: false };
    }

    const items = this.filterDismissed(normalizeQueue(page.items));
    this.queue = items;
    this.identityByMessageId.clear();
    for (const item of items) {
      this.identityByMessageId.set(item.id, identity);
    }
    return { items: [...items], hasMore: page.hasMore };
  }

  dismiss(id: string): void {
    if (!id || this.dismissedThisProcess.has(id)) return;
    this.dismissedThisProcess.add(id);
    this.queue = this.queue.filter((item) => item.id !== id);
    const identity = this.identityByMessageId.get(id);
    if (!identity || this.inFlightAckIds.has(id)) return;
    this.inFlightAckIds.add(id);
    void this.acknowledge(id, identity);
  }

  onAccountSessionChanged(): void {
    this.generation += 1;
    this.queue = [];
    this.identityByMessageId.clear();
  }

  private async acknowledge(id: string, identity: DirectMessageIdentitySnapshot): Promise<void> {
    try {
      for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
        const delay = retryDelaysMs[attempt];
        if (delay > 0) await this.sleep(delay);
        try {
          await this.client.markRead(identity, id);
          return;
        } catch {
          if (attempt === retryDelaysMs.length - 1) {
            this.warn("direct message receipt failed", { messageId: id, attempts: retryDelaysMs.length });
          }
        }
      }
    } finally {
      this.inFlightAckIds.delete(id);
    }
  }
}
