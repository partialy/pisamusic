import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const SECRET = "pisamusicpartial";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const FULL_KEY_LENGTH = 128;

export function randomFullKey() {
  return randomBytes(FULL_KEY_LENGTH / 2).toString("hex");
}

export function encrypt(fullKeyHex: string, plain: string) {
  const key = deriveAesKey(fullKeyHex);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-128-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return base64UrlEncode(Buffer.concat([iv, ct, tag]));
}

export function decrypt(fullKeyHex: string, encData: string) {
  const key = deriveAesKey(fullKeyHex);
  const raw = base64UrlDecode(encData);
  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("encData too short");
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(raw.length - TAG_LENGTH);
  const ct = raw.subarray(IV_LENGTH, raw.length - TAG_LENGTH);
  const decipher = createDecipheriv("aes-128-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

function deriveAesKey(fullKeyHex: string) {
  if (!fullKeyHex || fullKeyHex.length !== FULL_KEY_LENGTH) {
    throw new Error("invalid fullKey length");
  }
  const mac = createHmac("sha256", Buffer.from(SECRET, "utf8"));
  mac.update(Buffer.from(fullKeyHex, "utf8"));
  return mac.digest().subarray(0, 16);
}

function base64UrlEncode(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(s: string) {
  const std = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (std.length % 4)) % 4;
  return Buffer.from(std + "=".repeat(padLen), "base64");
}
