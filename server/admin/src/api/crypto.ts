const SECRET = "pisamusicpartial";
const HEADER_RANDOM = "x-pm-random";
const HEADER_VER = "x-pm-enc-ver";
const ENC_VER = "1";

type EncryptionEnvelope = {
  isEnc: true;
  encData: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const std = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function deriveAesKey(fullKeyHex: string): Promise<CryptoKey> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, textEncoder.encode(fullKeyHex)));
  return crypto.subtle.importKey("raw", mac.slice(0, 16), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function randomFullKey(): string {
  return bytesToHex(randomBytes(64));
}

export async function encrypt(fullKeyHex: string, plain: string): Promise<string> {
  const key = await deriveAesKey(fullKeyHex);
  const iv = randomBytes(12);
  const cipherText = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plain)));
  return base64UrlEncode(concatBytes(iv, cipherText));
}

export async function decrypt(fullKeyHex: string, encData: string): Promise<string> {
  const raw = base64UrlDecode(encData);
  if (raw.length < 12 + 16) throw new Error("encData too short");
  const iv = raw.slice(0, 12);
  const cipherText = raw.slice(12);
  const key = await deriveAesKey(fullKeyHex);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherText);
  return textDecoder.decode(plain);
}

function isEnvelope(v: unknown): v is EncryptionEnvelope {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.isEnc === true && typeof o.encData === "string" && o.encData.length > 0;
}

function parseJsonBody(body: BodyInit | null | undefined): unknown {
  if (body == null) return undefined;
  if (typeof body !== "string") {
    throw new Error("Encrypted admin request only supports JSON string bodies");
  }
  if (!body.trim()) return {};
  return JSON.parse(body);
}

export async function encryptedFetch(url: string, init?: RequestInit): Promise<Response> {
  const reqKey = randomFullKey();
  const headers = new Headers(init?.headers);
  headers.set(HEADER_RANDOM, reqKey);
  headers.set(HEADER_VER, ENC_VER);

  const method = (init?.method ?? "GET").toUpperCase();
  let body = init?.body;
  if (method !== "GET" && method !== "HEAD" && body != null) {
    const payload = {
      ts: Date.now(),
      nonce: crypto.randomUUID(),
      p: parseJsonBody(body),
    };
    body = JSON.stringify({
      isEnc: true,
      encData: await encrypt(reqKey, JSON.stringify(payload)),
    });
    headers.set("Content-Type", "application/json");
  }

  const rawResponse = await fetch(url, { ...init, method, headers, body });
  const contentType = rawResponse.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("json")) return rawResponse;

  const rawText = await rawResponse.text();
  const parsed = rawText ? (JSON.parse(rawText) as unknown) : null;
  if (!isEnvelope(parsed)) {
    throw new Error("Admin API returned plaintext response");
  }

  const respKey = rawResponse.headers.get(HEADER_RANDOM);
  if (!respKey) throw new Error("Encrypted admin response missing x-pm-random");

  const plain = await decrypt(respKey, parsed.encData);
  return new Response(plain, {
    status: rawResponse.status,
    statusText: rawResponse.statusText,
    headers: rawResponse.headers,
  });
}
