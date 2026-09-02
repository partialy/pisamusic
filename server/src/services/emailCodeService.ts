import { randomInt } from "node:crypto";
import { sendVerifyCodeEmail } from "./emailDeliveryService";
import { sendVerifyCodeSms } from "./smsDeliveryService";
import { insertVerificationCodeRecord, markVerificationCodeVerified } from "../db/verificationCodeStore";

export type ContactChannel = "email" | "phone";
export type ContactCodePurpose = "register" | "login" | "profile_email" | "profile_phone" | "reset_password";
export type EmailCodePurpose = Exclude<ContactCodePurpose, "profile_phone">;

export type SendContactCodeMeta = {
  deviceId?: string;
  clientIp?: string;
  userAgent?: string;
  userId?: string | null;
};

type CodeEntry = {
  code: string;
  channel: ContactChannel;
  purpose: ContactCodePurpose;
  expiresAt: number;
  nextSendAt: number;
};

const CODE_TTL_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const codeMap = new Map<string, CodeEntry>();
const sendCooldownMap = new Map<string, number>();

function key(channel: ContactChannel, contact: string, purpose: ContactCodePurpose): string {
  return `${channel}:${purpose}:${channel === "email" ? contact.toLowerCase() : contact}`;
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

export async function sendContactCode(
  channel: ContactChannel,
  contact: string,
  purpose: ContactCodePurpose,
  meta?: SendContactCodeMeta,
): Promise<{ expiresAt: number; nextSendAt: number }> {
  const now = Date.now();
  evictExpired(now);
  const cacheKey = key(channel, contact, purpose);
  const cooldownUntil = sendCooldownMap.get(cacheKey) ?? codeMap.get(cacheKey)?.nextSendAt ?? 0;
  if (cooldownUntil > now) {
    const seconds = Math.ceil((cooldownUntil - now) / 1000);
    throw new Error(`验证码发送过于频繁，请 ${seconds} 秒后再试`);
  }

  const code = makeCode();
  const nextSendAt = now + SEND_COOLDOWN_MS;
  const expiresAt = now + CODE_TTL_MS;
  sendCooldownMap.set(cacheKey, nextSendAt);

  try {
    if (channel === "email") await sendVerifyCodeEmail(contact, code);
    else await sendVerifyCodeSms(contact, code);

    insertVerificationCodeRecord({
      channel,
      target: contact,
      purpose,
      code,
      userId: meta?.userId,
      deviceId: meta?.deviceId,
      clientIp: meta?.clientIp,
      userAgent: meta?.userAgent,
      status: "sent",
      createdAt: now,
      expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "验证码发送失败";
    insertVerificationCodeRecord({
      channel,
      target: contact,
      purpose,
      code,
      userId: meta?.userId,
      deviceId: meta?.deviceId,
      clientIp: meta?.clientIp,
      userAgent: meta?.userAgent,
      status: "failed",
      errorMessage: message,
      createdAt: now,
      expiresAt,
    });
    throw error;
  }

  const entry: CodeEntry = {
    code,
    channel,
    purpose,
    expiresAt,
    nextSendAt,
  };
  codeMap.set(cacheKey, entry);
  if (shouldDebugLogCode()) {
    // eslint-disable-next-line no-console
    console.log(`----验证码----\n${entry.code}\n----------------`);
  }
  return { expiresAt: entry.expiresAt, nextSendAt: entry.nextSendAt };
}

export function verifyContactCode(channel: ContactChannel, contact: string, purpose: ContactCodePurpose, code: string): boolean {
  const now = Date.now();
  evictExpired(now);
  const cacheKey = key(channel, contact, purpose);
  const entry = codeMap.get(cacheKey);
  if (!entry || entry.purpose !== purpose || entry.expiresAt <= now) return false;
  if (entry.code !== code.trim()) return false;
  codeMap.delete(cacheKey);
  markVerificationCodeVerified(channel, contact, purpose, code);
  return true;
}

export async function sendEmailCode(email: string, purpose: EmailCodePurpose, meta?: SendContactCodeMeta) {
  return sendContactCode("email", email, purpose, meta);
}

export function verifyEmailCode(email: string, purpose: EmailCodePurpose, code: string): boolean {
  return verifyContactCode("email", email, purpose, code);
}

function shouldDebugLogCode(): boolean {
  return process.env.EMAIL_CODE_DEBUG_LOG === "1" || process.env.NODE_ENV !== "production";
}
