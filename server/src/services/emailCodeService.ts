import { randomInt } from "node:crypto";

export type EmailCodePurpose = "register" | "login";

type CodeEntry = {
  code: string;
  purpose: EmailCodePurpose;
  expiresAt: number;
  nextSendAt: number;
};

const CODE_TTL_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const codeMap = new Map<string, CodeEntry>();

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
}

export function sendEmailCode(email: string, purpose: EmailCodePurpose): { expiresAt: number; nextSendAt: number } {
  const now = Date.now();
  evictExpired(now);
  const cacheKey = key(email, purpose);
  const existing = codeMap.get(cacheKey);
  if (existing && existing.nextSendAt > now) {
    const seconds = Math.ceil((existing.nextSendAt - now) / 1000);
    throw new Error(`验证码发送过于频繁，请 ${seconds} 秒后再试`);
  }
  const entry: CodeEntry = {
    code: makeCode(),
    purpose,
    expiresAt: now + CODE_TTL_MS,
    nextSendAt: now + SEND_COOLDOWN_MS,
  };
  codeMap.set(cacheKey, entry);
  // eslint-disable-next-line no-console
  console.log(`----验证码----\n${entry.code}\n----------------`);
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
