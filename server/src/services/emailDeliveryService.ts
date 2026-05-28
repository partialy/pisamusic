import { readAppConfig } from "../db/configStore";
import { signGatewayUrl, type GatewaySignConfig } from "./gatewaySigner";

const DEFAULT_EMAIL_SERVICE_URL = "https://gateway.partialy.cn/auth-service/api/send/email";
const DEFAULT_EMAIL_PROVIDER = "aliyun";
const DEFAULT_GATEWAY_SIGN: GatewaySignConfig = {
  secret: "partialypartialypartialypartialy",
  as: "yixivip",
};

type GatewayResponse = {
  success?: unknown;
  code?: unknown;
  msg?: unknown;
  message?: unknown;
};

export async function sendVerifyCodeEmail(to: string, code: string): Promise<void> {
  const body = JSON.stringify({
    provider: getEmailProvider(),
    type: "verify_code",
    code,
    to,
  });
  const signed = signGatewayUrl("POST", getEmailServiceUrl(), body, getGatewaySignConfig());
  const response = await fetch(signed.url, {
    method: "POST",
    headers: {
      ...signed.headers,
      "content-type": "application/json",
      accept: "application/json",
    },
    body,
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`email service request failed: ${response.status} ${response.statusText || ""}`.trim());
  }

  const parsed = parseJson(raw);
  const businessError = getGatewayBusinessError(parsed);
  if (businessError) throw new Error(businessError);
}

function getGatewaySignConfig(): GatewaySignConfig {
  const configured = readAppConfig().bootstrap.gatewaySign;
  if (configured?.secret && configured.as) return configured;
  return DEFAULT_GATEWAY_SIGN;
}

function getEmailServiceUrl(): string {
  return readAppConfig().email.serviceUrl || DEFAULT_EMAIL_SERVICE_URL;
}

function getEmailProvider(): string {
  return readAppConfig().email.provider || DEFAULT_EMAIL_PROVIDER;
}

function parseJson(raw: string): unknown {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function getGatewayBusinessError(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as GatewayResponse;
  if (body.success === false) return getGatewayMessage(body);
  if (typeof body.code === "number" && Number.isFinite(body.code) && body.code !== 0) {
    return getGatewayMessage(body);
  }
  return null;
}

function getGatewayMessage(body: GatewayResponse): string {
  const message = typeof body.message === "string" ? body.message : typeof body.msg === "string" ? body.msg : "";
  return message || "email service send failed";
}
