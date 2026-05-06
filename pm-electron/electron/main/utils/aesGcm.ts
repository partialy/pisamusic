import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const SECRET = "pisamusicpartial";
const IV_LENGTH = 12;
const FULL_KEY_HEX_LENGTH = 128;

export function randomFullKey(): string {
  return randomBytes(FULL_KEY_HEX_LENGTH / 2).toString("hex");
}

function deriveAesKey(fullKeyHex: string): Buffer {
  if (fullKeyHex.length !== FULL_KEY_HEX_LENGTH) {
    throw new Error("invalid fullKey length");
  }
  return createHmac("sha256", SECRET).update(fullKeyHex, "utf8").digest().subarray(0, 16);
}

export function encrypt(fullKeyHex: string, plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-128-gcm", deriveAesKey(fullKeyHex), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64url");
}

export function decrypt(fullKeyHex: string, encData: string): string {
  const raw = Buffer.from(encData, "base64url");
  if (raw.length <= IV_LENGTH + 16) {
    throw new Error("encData too short");
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(raw.length - 16);
  const ciphertext = raw.subarray(IV_LENGTH, raw.length - 16);
  const decipher = createDecipheriv("aes-128-gcm", deriveAesKey(fullKeyHex), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
