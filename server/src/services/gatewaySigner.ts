import { createHash, createHmac, randomUUID } from "node:crypto";

export type GatewaySignConfig = {
  secret: string;
  as: string;
};

const RESERVED_QUERY_KEYS = new Set(["s", "t", "n", "enc"]);

export function signGatewayUrl(method: string, rawUrl: string, body: string | Buffer, config: GatewaySignConfig) {
  const url = new URL(rawUrl);
  url.searchParams.set("res-dec", "1");

  const timestamp = Date.now().toString();
  const nonce = randomUUID().replace(/-/g, "");
  const bodyBytes = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  const canonical = [
    "v2",
    method.toUpperCase(),
    url.pathname,
    canonicalQuery(url),
    sha256Base64(bodyBytes),
    timestamp,
    nonce,
    config.as,
  ].join("\n");
  const signature = createHmac("sha256", config.secret).update(canonical, "utf8").digest("base64");

  return {
    url: url.toString(),
    headers: {
      t: timestamp,
      n: nonce,
      s: signature,
    },
  };
}

function canonicalQuery(url: URL) {
  const groups = new Map<string, string[]>();
  url.searchParams.forEach((value, key) => {
    if (RESERVED_QUERY_KEYS.has(key)) return;
    const list = groups.get(key) ?? [];
    list.push(value);
    groups.set(key, list);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, values]) =>
      values.sort().map((value) => `${javaUrlEncode(key)}=${javaUrlEncode(value)}`)
    )
    .join("&");
}

function sha256Base64(bytes: Buffer) {
  if (bytes.length === 0) return "";
  return createHash("sha256").update(bytes).digest("base64");
}

function javaUrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("binary")
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0) & 0xff;
      if (code === 0x20) return "+";
      if (isJavaUrlEncodeSafe(code)) return String.fromCharCode(code);
      return `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
    })
    .join("");
}

function isJavaUrlEncodeSafe(code: number) {
  return (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0x30 && code <= 0x39) ||
    code === 0x2d ||
    code === 0x5f ||
    code === 0x2e ||
    code === 0x2a
  );
}
