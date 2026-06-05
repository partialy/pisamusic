import { randomUUID } from "node:crypto";
import path from "node:path";
import * as qiniu from "qiniu";
import type { DesktopUpdateAssetType, ReleasePlatform } from "../db/configStore";

const PROVIDER = "qiniu" as const;
const TOKEN_TTL_SECONDS = 3600;
const DOWNLOAD_TTL_SECONDS = 3600;
const ACCOUNT_AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS: Record<ReleasePlatform, string[]> = {
  android: [".apk", ".aab"],
  desktop: [".exe", ".msi", ".zip", ".7z"],
};
const DESKTOP_UPDATE_ALLOWED_EXTENSIONS = [".yml", ".exe", ".blockmap"];
const ACCOUNT_AVATAR_ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ACCOUNT_AVATAR_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type QiniuUploadTokenInput = {
  platform: ReleasePlatform;
  fileName: string;
  fileSize: number;
  mimeType?: string;
};

export type DesktopUpdateUploadTokenInput = {
  version: string;
  platform: "win32";
  arch: "x64";
  fileType: DesktopUpdateAssetType;
  fileName: string;
  fileSize: number;
  mimeType?: string;
};

export type AccountAvatarUploadTokenInput = {
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
};

export type QiniuUploadTokenInfo = {
  provider: typeof PROVIDER;
  uploadToken: string;
  uploadUrl: string;
  key: string;
  bucket: string;
  domain: string;
  cdnDomain: string;
  downloadUrl: string;
  expiresAt: number;
};

function requireEnv(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`缺少七牛配置：${name}`);
  return value;
}

function optionalEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function normalizeDomain(domain: string): string {
  let value = domain.trim();
  if (!value) return "";
  if (value.startsWith("//")) value = `https:${value}`;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  return value.replace(/\/+$/, "");
}

function getPublicDomain(): { domain: string; cdnDomain: string; baseUrl: string } {
  const domain = normalizeDomain(optionalEnv("QINIU_DOMAIN"));
  const cdnDomain = normalizeDomain(optionalEnv("QINIU_DOMAIN_CDN"));
  const baseUrl = cdnDomain || domain;
  if (!baseUrl) throw new Error("缺少七牛配置：QINIU_DOMAIN 或 QINIU_DOMAIN_CDN");
  return { domain, cdnDomain, baseUrl };
}

function getMac(): qiniu.auth.digest.Mac {
  return new qiniu.auth.digest.Mac(requireEnv("QINIU_ACCESS_KEY"), requireEnv("QINIU_SECRET_KEY"));
}

function getBucket(): string {
  return requireEnv("QINIU_BUCKET");
}

function getPublicImageBucket(): string {
  return requireEnv("QINIU_PUBLIC_IMAGE_BUCKET");
}

function getUploadUrl(): string {
  return optionalEnv("QINIU_UPLOAD_URL") || "https://upload.qiniup.com";
}

function getExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

export function validateReleaseFile(platform: ReleasePlatform, fileName: string, fileSize: number): void {
  if (!fileName.trim()) throw new Error("文件名不能为空");
  if (!Number.isFinite(fileSize) || fileSize <= 0) throw new Error("文件大小不正确");
  const ext = getExtension(fileName);
  if (!ALLOWED_EXTENSIONS[platform].includes(ext)) {
    throw new Error(`${platform === "desktop" ? "PC 版" : "Android"} 安装包仅支持 ${ALLOWED_EXTENSIONS[platform].join("、")}`);
  }
}

export function inferDesktopUpdateAssetType(fileName: string): DesktopUpdateAssetType {
  const lower = fileName.toLowerCase();
  if (lower === "latest.yml") return "latest-yml";
  if (lower.endsWith(".blockmap")) return "blockmap";
  return "installer";
}

export function validateDesktopUpdateAsset(fileName: string, fileSize: number): DesktopUpdateAssetType {
  if (!fileName.trim()) throw new Error("文件名不能为空");
  if (!Number.isFinite(fileSize) || fileSize <= 0) throw new Error("文件大小不正确");
  const ext = getExtension(fileName);
  if (!DESKTOP_UPDATE_ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`PC 自动更新文件仅支持 ${DESKTOP_UPDATE_ALLOWED_EXTENSIONS.join("、")}`);
  }
  const fileType = inferDesktopUpdateAssetType(fileName);
  if (fileType === "latest-yml" && fileName !== "latest.yml") throw new Error("YML 文件名必须是 latest.yml");
  return fileType;
}

function buildObjectKey(platform: ReleasePlatform, fileName: string): string {
  const ext = getExtension(fileName);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `pisamusic/releases/${platform}/${day}/${randomUUID()}${ext}`;
}

function buildDesktopUpdateObjectKey(input: DesktopUpdateUploadTokenInput): string {
  const ext = getExtension(input.fileName);
  const safeName = input.fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return `pisamusic/desktop-updates/${input.platform}/${input.arch}/${encodeURIComponent(input.version)}/${randomUUID()}-${safeName || `asset${ext}`}`;
}

function buildAccountAvatarObjectKey(input: AccountAvatarUploadTokenInput): string {
  const ext = getExtension(input.fileName);
  return `pisamusic/account-avatars/${input.userId}/${randomUUID()}${ext}`;
}

export function buildDownloadUrl(key: string): string {
  const { baseUrl } = getPublicDomain();
  return `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function buildPublicQiniuUrl(key: string): string {
  return buildDownloadUrl(key);
}

export function buildReleaseFileDownloadPath(fileId: string): string {
  return `/api/config/release-files/${encodeURIComponent(fileId)}/download`;
}

export function createQiniuUploadToken(input: QiniuUploadTokenInput): QiniuUploadTokenInfo {
  validateReleaseFile(input.platform, input.fileName, input.fileSize);
  const bucket = getBucket();
  const key = buildObjectKey(input.platform, input.fileName);
  const { domain, cdnDomain } = getPublicDomain();
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${bucket}:${key}`,
    insertOnly: 1,
    expires: TOKEN_TTL_SECONDS,
    fsizeLimit: input.fileSize,
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(x:name)"}',
  });
  return {
    provider: PROVIDER,
    uploadToken: putPolicy.uploadToken(getMac()),
    uploadUrl: getUploadUrl(),
    key,
    bucket,
    domain,
    cdnDomain,
    downloadUrl: "",
    expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
  };
}

export function createDesktopUpdateUploadToken(input: DesktopUpdateUploadTokenInput): QiniuUploadTokenInfo {
  validateDesktopUpdateAsset(input.fileName, input.fileSize);
  const bucket = getBucket();
  const key = buildDesktopUpdateObjectKey(input);
  const { domain, cdnDomain } = getPublicDomain();
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${bucket}:${key}`,
    insertOnly: 1,
    expires: TOKEN_TTL_SECONDS,
    fsizeLimit: input.fileSize,
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(x:name)"}',
  });
  return {
    provider: PROVIDER,
    uploadToken: putPolicy.uploadToken(getMac()),
    uploadUrl: getUploadUrl(),
    key,
    bucket,
    domain,
    cdnDomain,
    downloadUrl: "",
    expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
  };
}

export function isAccountAvatarObjectKey(userId: string, key: string): boolean {
  return key.startsWith(`pisamusic/account-avatars/${userId}/`) && ACCOUNT_AVATAR_ALLOWED_EXTENSIONS.includes(getExtension(key));
}

export function validateAccountAvatarFile(fileName: string, fileSize: number, mimeType?: string): void {
  if (!fileName.trim()) throw new Error("头像文件名不能为空");
  if (!Number.isFinite(fileSize) || fileSize <= 0) throw new Error("头像文件大小不正确");
  if (fileSize > ACCOUNT_AVATAR_MAX_SIZE) throw new Error("头像文件不能超过 5MB");
  const ext = getExtension(fileName);
  if (!ACCOUNT_AVATAR_ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error("头像仅支持 jpg、png、webp");
  }
  const normalizedMime = (mimeType ?? "").trim().toLowerCase();
  if (normalizedMime && !ACCOUNT_AVATAR_ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    throw new Error("头像文件类型不支持");
  }
}

export function createAccountAvatarUploadToken(input: AccountAvatarUploadTokenInput): QiniuUploadTokenInfo {
  validateAccountAvatarFile(input.fileName, input.fileSize, input.mimeType);
  const bucket = getPublicImageBucket();
  const key = buildAccountAvatarObjectKey(input);
  const { domain, cdnDomain } = getPublicDomain();
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${bucket}:${key}`,
    insertOnly: 1,
    expires: TOKEN_TTL_SECONDS,
    fsizeLimit: input.fileSize,
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(x:name)"}',
  });
  return {
    provider: PROVIDER,
    uploadToken: putPolicy.uploadToken(getMac()),
    uploadUrl: getUploadUrl(),
    key,
    bucket,
    domain,
    cdnDomain,
    downloadUrl: buildPublicQiniuUrl(key),
    expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
  };
}

function isQiniuNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; statusCode?: unknown; resp?: { statusCode?: unknown } };
  return e.code === 612 || e.statusCode === 612 || e.resp?.statusCode === 612;
}

export async function deleteQiniuObject(bucket: string, key: string): Promise<void> {
  const bucketManager = new qiniu.rs.BucketManager(getMac(), new qiniu.conf.Config({ useHttpsDomain: true }));
  try {
    const result = await bucketManager.delete(bucket, key);
    const statusCode = result.resp.statusCode;
    if (statusCode !== 200 && statusCode !== 612) {
      throw new Error(`七牛删除失败：HTTP ${statusCode}`);
    }
  } catch (e) {
    if (isQiniuNotFoundError(e)) return;
    throw e;
  }
}

export async function deleteAccountAvatarObject(key: string): Promise<void> {
  await deleteQiniuObject(getPublicImageBucket(), key);
}

export function createPrivateQiniuDownloadUrl(key: string, ttlSeconds = DOWNLOAD_TTL_SECONDS): string {
  const { baseUrl } = getPublicDomain();
  const deadline = Math.floor(Date.now() / 1000) + ttlSeconds;
  const bucketManager = new qiniu.rs.BucketManager(getMac(), new qiniu.conf.Config({ useHttpsDomain: true }));
  return bucketManager.privateDownloadUrl(baseUrl, key, deadline);
}
