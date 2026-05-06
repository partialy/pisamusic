import { randomUUID } from "node:crypto";
import { decrypt, encrypt, randomFullKey } from "./aesGcm";

type Envelope = {
  isEnc?: unknown;
  encData?: unknown;
};

const HEADER_RANDOM = "x-pm-random";
const HEADER_VER = "x-pm-enc-ver";
const ENC_VER = "1";

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export async function fetchSystemJson<T>(url: string, init?: RequestInit & { encryptBody?: boolean }): Promise<T> {
  const fullKey = randomFullKey();
  const headers = new Headers(init?.headers);
  headers.set(HEADER_RANDOM, fullKey);
  headers.set(HEADER_VER, ENC_VER);

  let body = init?.body;
  if (init?.encryptBody && body !== undefined) {
    const payload = {
      ts: Date.now(),
      nonce: randomUUID().replace(/-/g, ""),
      p: typeof body === "string" ? JSON.parse(body) : body,
    };
    headers.set("content-type", "application/json");
    body = JSON.stringify({ isEnc: true, encData: encrypt(fullKey, JSON.stringify(payload)) });
  }

  const response = await fetch(url, { ...init, headers, body });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const json = (await response.json()) as Envelope | T;
  if (isEnvelope(json)) {
    const respKey = response.headers.get(HEADER_RANDOM) ?? fullKey;
    return JSON.parse(decrypt(respKey, json.encData)) as T;
  }
  return json as T;
}

function isEnvelope(value: unknown): value is { isEnc: true; encData: string } {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Envelope;
  return envelope.isEnc === true && typeof envelope.encData === "string";
}
