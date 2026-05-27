import { randomInt } from "node:crypto";
import { sendVerifyCodeEmail } from "./emailDeliveryService";

export type EmailCodePurpose = "register" | "login" | "profile_email";

type CodeEntry = {
  code: string;
  purpose: EmailCodePurpose;
  expiresAt: number;
  nextSendAt: number;
};

const CODE_TTL_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const codeMap = new Map<string, CodeEntry>();
const sendCooldownMap = new Map<string, number>();

function key(email: string, purpose: EmailCodePurpose): string {
  return `${purpose}:${email.toLowerCase()}`;
}

function makeCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function evictExpired(now = Date.now()): void {
  for (const [k, entry] of codeMap.entries()) {
    if (entry.expiresAt <= now) codeMap.delete(k);
  }
  for (const [k, nextSendAt] of sendCooldownMap.entries()) {
    if (nextSendAt <= now) sendCooldownMap.delete(k);
  }
}

export async function sendEmailCode(email: string, purpose: EmailCodePurpose): Promise<{ expiresAt: number; nextSendAt: number }> {
  const now = Date.now();
  evictExpired(now);
  const cacheKey = key(email, purpose);
  const cooldownUntil = sendCooldownMap.get(cacheKey) ?? codeMap.get(cacheKey)?.nextSendAt ?? 0;
  if (cooldownUntil > now) {
    const seconds = Math.ceil((cooldownUntil - now) / 1000);
    throw new Error(`验证码发送过于频繁，请 ${seconds} 秒后再试`);
  }

  const code = makeCode();
  const nextSendAt = now + SEND_COOLDOWN_MS;
  sendCooldownMap.set(cacheKey, nextSendAt);
  await sendVerifyCodeEmail(email, code);

  const entry: CodeEntry = {
    code,
    purpose,
    expiresAt: now + CODE_TTL_MS,
    nextSendAt,
  };
  codeMap.set(cacheKey, entry);
  if (shouldDebugLogCode()) {
    // eslint-disable-next-line no-console
    console.log(`----验证码----\n${entry.code}\n----------------`);
  }
  return { expiresAt: entry.expiresAt, nextSendAt: entry.nextSendAt };
}

export function verifyEmailCode(email: string, purpose: EmailCodePurpose, code: string): boolean {
  const now = Date.now();
  evictExpired(now);
  const cacheKey = key(email, purpose);
  const entry = codeMap.get(cacheKey);
  if (!entry || entry.purpose !== purpose || entry.expiresAt <= now) return false;
  if (entry.code !== code.trim()) return false;
  codeMap.delete(cacheKey);
  return true;
}

function shouldDebugLogCode(): boolean {
  return process.env.EMAIL_CODE_DEBUG_LOG === "1" || process.env.NODE_ENV !== "production";
}
