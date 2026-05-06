import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * 端到端加密协议（与 Android 端 SystemEncryptionInterceptor 保持一致）。
 * - SECRET 是双端共识的基础串，仅参与密钥派生，绝不下发到任何接口。
 * - fullKey 为单次随机 128 字符 hex，承载于头 x-pm-random。
 * - aesKey = HMAC_SHA256(SECRET, fullKey_utf8)[0:16] -> AES-128。
 * - encData = base64url(IV(12) || ciphertext || tag(16))。
 */
const SECRET = "pisamusicpartial";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const FULL_KEY_LENGTH = 128;

export function deriveAesKey(fullKeyHex: string): Buffer {
  if (!fullKeyHex || fullKeyHex.length !== FULL_KEY_LENGTH) {
    throw new Error("invalid fullKey length");
  }
  const mac = createHmac("sha256", Buffer.from(SECRET, "utf8"));
  mac.update(Buffer.from(fullKeyHex, "utf8"));
  return mac.digest().subarray(0, 16);
}

export function encrypt(fullKeyHex: string, plain: string): string {
  const key = deriveAesKey(fullKeyHex);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-128-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return base64UrlEncode(Buffer.concat([iv, ct, tag]));
}

export function decrypt(fullKeyHex: string, encDataB64Url: string): string {
  const key = deriveAesKey(fullKeyHex);
  const raw = base64UrlDecode(encDataB64Url);
  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("encData too short");
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(raw.length - TAG_LENGTH);
  const ct = raw.subarray(IV_LENGTH, raw.length - TAG_LENGTH);
  const decipher = createDecipheriv("aes-128-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}

export function randomFullKey(): string {
  return randomBytes(FULL_KEY_LENGTH / 2).toString("hex");
}

export function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64UrlDecode(s: string): Buffer {
  const std = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (std.length % 4)) % 4;
  return Buffer.from(std + "=".repeat(padLen), "base64");
}
