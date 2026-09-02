import type { DirectMessageItem } from "../../src/types/directMessage";

export const retryDelaysMs = [0, 2_000, 8_000] as const;

export function normalizeQueue(items: readonly DirectMessageItem[]): DirectMessageItem[] {
  const byId = new Map<string, DirectMessageItem>();
  for (const item of items) {
    if (!item?.id || byId.has(item.id)) continue;
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((left, right) =>
    left.createdAt === right.createdAt
      ? left.id.localeCompare(right.id)
      : left.createdAt - right.createdAt,
  );
}
