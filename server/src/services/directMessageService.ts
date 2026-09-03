import { randomUUID } from "node:crypto";
import { getDeviceDb } from "../db/deviceInfoDb";
import {
  deleteDirectMessage,
  insertDirectMessage,
  listAdminDirectMessages,
  listUnreadDirectMessages,
  markDirectMessageRead,
  type DirectMessageIdentity,
  type DirectMessageTarget,
  type DirectMessageTargetKind,
  type StoredDirectMessage,
} from "../db/directMessageStore";
import { readUserById } from "../db/userStore";

export type DirectMessageItem = {
  id: string;
  targetKind: DirectMessageTargetKind;
  content: string;
  createdAt: number;
};

export type DirectMessageUnreadPage = {
  items: DirectMessageItem[];
  hasMore: boolean;
};

export type AdminDirectMessageItem = DirectMessageItem & {
  targetId: string;
  createdByAdmin: string;
  read: boolean;
  readAt: number | null;
  readPlatform: "android" | "desktop" | null;
  readDeviceId: string | null;
};

export type AdminDirectMessagePage = {
  items: AdminDirectMessageItem[];
  total: number;
  offset: number;
  limit: number;
};

export class DirectMessageValidationError extends Error {}

export class DirectMessageTargetNotFoundError extends Error {}

export class DirectMessageNotFoundError extends Error {}

export type CreateDirectMessageInput = {
  targetKind: unknown;
  targetId: unknown;
  content: unknown;
  createdByAdmin: string;
};

type ListAdminDirectMessagesInput = {
  targetKind?: unknown;
  targetId?: unknown;
  offset?: unknown;
  limit?: unknown;
};

function normalizeText(value: unknown, field: string, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new DirectMessageValidationError(`${field}不能为空`);
  if (text.length > maxLength) throw new DirectMessageValidationError(`${field}不能超过 ${maxLength} 个字符`);
  return text;
}

function normalizeTargetKind(value: unknown): DirectMessageTargetKind {
  if (value === "user" || value === "android_device" || value === "desktop_device") return value;
  throw new DirectMessageValidationError("接收方类型不支持");
}

function normalizeInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = String(value).trim();
  if (!/^-?\d+$/.test(text)) return fallback;
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(parsed, maximum));
}

function targetExists(target: DirectMessageTarget): boolean {
  if (target.kind === "user") return Boolean(readUserById(target.id));
  const table = target.kind === "android_device" ? "device_info" : "desktop_device_info";
  return Boolean(getDeviceDb().prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(target.id));
}

function targetFromStored(item: StoredDirectMessage): { targetKind: DirectMessageTargetKind; targetId: string } {
  return { targetKind: item.target.kind, targetId: item.target.id };
}

function toDirectMessageItem(item: StoredDirectMessage): DirectMessageItem {
  return {
    id: item.id,
    targetKind: targetFromStored(item).targetKind,
    content: item.content,
    createdAt: item.createdAt,
  };
}

function toAdminDirectMessageItem(item: StoredDirectMessage): AdminDirectMessageItem {
  const target = targetFromStored(item);
  return {
    ...toDirectMessageItem(item),
    targetId: target.targetId,
    createdByAdmin: item.createdByAdmin,
    read: item.readAt !== null,
    readAt: item.readAt,
    readPlatform: item.readPlatform,
    readDeviceId: item.readDeviceId,
  };
}

export function createDirectMessage(input: CreateDirectMessageInput): AdminDirectMessageItem {
  const kind = normalizeTargetKind(input.targetKind);
  const target: DirectMessageTarget = { kind, id: normalizeText(input.targetId, "接收方 ID", 128) } as DirectMessageTarget;
  if (!targetExists(target)) throw new DirectMessageTargetNotFoundError("接收方不存在");
  const createdByAdmin = normalizeText(input.createdByAdmin, "管理员", 128);
  const content = normalizeText(input.content, "消息内容", 2_000);
  return toAdminDirectMessageItem(insertDirectMessage({
    id: randomUUID(),
    target,
    content,
    createdByAdmin,
    createdAt: Date.now(),
  }));
}

export function listUnreadForIdentity(identity: DirectMessageIdentity, limit: unknown): DirectMessageUnreadPage {
  if (!identity.userId && !identity.device) throw new DirectMessageValidationError("缺少有效的账号或设备身份");
  const page = listUnreadDirectMessages(identity, normalizeInteger(limit, 50, 1, 50));
  return {
    items: page.items.map(toDirectMessageItem),
    hasMore: page.hasMore,
  };
}

export function markDirectMessageReadForIdentity(identity: DirectMessageIdentity, id: unknown): { id: string; readAt: number } | null {
  if (!identity.userId && !identity.device) throw new DirectMessageValidationError("缺少有效的账号或设备身份");
  const messageId = normalizeText(id, "消息 ID", 128);
  const item = markDirectMessageRead(identity, messageId);
  return item?.readAt == null ? null : { id: item.id, readAt: item.readAt };
}

export function listAdminDirectMessagePage(input: ListAdminDirectMessagesInput = {}): AdminDirectMessagePage {
  const targetKindProvided = input.targetKind !== undefined && input.targetKind !== null && input.targetKind !== "";
  const targetIdProvided = input.targetId !== undefined && input.targetId !== null && input.targetId !== "";
  if (targetKindProvided !== targetIdProvided) {
    throw new DirectMessageValidationError("targetKind 与 targetId 必须同时提供");
  }
  const target = targetKindProvided
    ? { kind: normalizeTargetKind(input.targetKind), id: normalizeText(input.targetId, "接收方 ID", 128) } as DirectMessageTarget
    : undefined;
  const offset = normalizeInteger(input.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = normalizeInteger(input.limit, 30, 1, 100);
  const page = listAdminDirectMessages({ target, offset, limit });
  return {
    items: page.items.map(toAdminDirectMessageItem),
    total: page.total,
    offset,
    limit,
  };
}

export function deleteDirectMessageById(id: unknown): { id: string } {
  const messageId = normalizeText(id, "消息 ID", 128);
  if (!deleteDirectMessage(messageId)) {
    throw new DirectMessageNotFoundError("消息不存在");
  }
  return { id: messageId };
}
