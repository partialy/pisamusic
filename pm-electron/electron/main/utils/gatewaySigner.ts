import { createHash, createHmac, randomUUID } from "node:crypto";
import type { GatewaySignConfig } from "@shared/system";

const RESERVED_QUERY_KEYS = new Set(["s", "t", "n", "enc"]);

function sha256Base64(body: string): string {
  if (!body) return "";
  return createHash("sha256").update(body).digest("base64");
}

function javaUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/~/g, "%7E")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function canonicalQuery(url: URL): string {
  const groups = new Map<string, string[]>();
  for (const [name, value] of url.searchParams.entries()) {
    if (RESERVED_QUERY_KEYS.has(name)) continue;
    const values = groups.get(name) ?? [];
    values.push(value);
    groups.set(name, values);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([name, values]) =>
      values.sort().map((value) => `${javaUrlEncode(name)}=${javaUrlEncode(value)}`),
    )
    .join("&");
}

export function signGatewayUrl(input: string, config: GatewaySignConfig, method = "GET", body = ""): { url: string; headers: Record<string, string> } {
  const url = new URL(input);
  url.searchParams.set("res-dec", "1");
  const timestamp = Date.now().toString();
  const nonce = randomUUID().replace(/-/g, "");
  const canonical = [
    "v2",
    method.toUpperCase(),
    url.pathname,
    canonicalQuery(url),
    sha256Base64(body),
    timestamp,
    nonce,
    config.as,
  ].join("\n");
  const signature = createHmac("sha256", config.secret).update(canonical).digest("base64");
  return {
    url: url.toString(),
    headers: {
      t: timestamp,
      n: nonce,
      s: signature,
    },
  };
}
