import type {
  AppConfigJson,
  DesktopUpdateAssetInfo,
  DesktopUpdateAssetType,
  ReleasePlatform,
  UpdateHistoryItem,
} from "../types/config";

export type DesktopStagedFiles = Partial<Record<DesktopUpdateAssetType, File>>;

export type AndroidMatchResult = {
  file: File | null;
  ignoredCount: number;
};

export type DesktopMatchResult = {
  matched: DesktopStagedFiles;
  ignoredCount: number;
  invalidYamlNames: string[];
};

export function formatReleaseFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)}MB`;
  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

export function incrementVersionString(rawVersion: string, fallbackVersion: string): string {
  const trimmed = rawVersion.trim();
  if (!trimmed || trimmed === "v" || trimmed === "V") {
    return fallbackVersion;
  }
  const match = trimmed.match(/^(.*?)(\d+)([^\d]*)$/);
  if (!match) {
    return fallbackVersion;
  }
  const [, prefix, numStr, suffix] = match;
  const nextNum = Number.parseInt(numStr, 10) + 1;
  if (!Number.isFinite(nextNum)) {
    return fallbackVersion;
  }
  return `${prefix}${nextNum}${suffix}`;
}

export function stripVersionPrefix(rawVersion: string): string {
  return rawVersion.trim().replace(/^[vV]+/, "");
}

export function normalizeReleaseVersionWithV(rawVersion: string): string {
  const stripped = stripVersionPrefix(rawVersion);
  return stripped ? `v${stripped}` : "";
}

export function suggestNextVersion(
  platform: ReleasePlatform,
  appConfigServer: AppConfigJson,
  updateHistory: UpdateHistoryItem[],
): string {
  const fallback = "v1.0.0";
  const currentReleaseVer = appConfigServer.releases[platform]?.latestVersion?.trim();
  if (currentReleaseVer && /\d/.test(currentReleaseVer)) {
    return normalizeReleaseVersionWithV(incrementVersionString(currentReleaseVer, fallback));
  }
  for (let i = updateHistory.length - 1; i >= 0; i -= 1) {
    const item = updateHistory[i];
    if (item.platform === platform && item.version && /\d/.test(item.version)) {
      return normalizeReleaseVersionWithV(incrementVersionString(item.version, fallback));
    }
  }
  return fallback;
}

export function parseLatestYmlVersion(yamlText: string): string | null {
  const lines = yamlText.split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // 只匹配顶层 version 字段（行首无缩进）
    const match = rawLine.match(/^version\s*:\s*(.+?)\s*$/);
    if (!match) continue;
    let value = match[1].trim();
    // 去掉行尾注释
    if (!value.startsWith("'") && !value.startsWith('"')) {
      const commentIdx = value.indexOf(" #");
      if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();
    }
    value = value.replace(/^['"]|['"]$/g, "").trim();
    return value || null;
  }
  return null;
}

export function matchAndroidReleaseFiles(files: File[]): AndroidMatchResult {
  let apkFile: File | null = null;
  let aabFile: File | null = null;
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".apk")) {
      if (!apkFile) apkFile = file;
    } else if (lower.endsWith(".aab")) {
      if (!aabFile) aabFile = file;
    }
  }
  const picked = apkFile ?? aabFile;
  const ignoredCount = Math.max(0, files.length - (picked ? 1 : 0));
  return { file: picked, ignoredCount };
}

export function matchDesktopReleaseFiles(files: File[]): DesktopMatchResult {
  const matched: DesktopStagedFiles = {};
  const invalidYamlNames: string[] = [];
  let matchedCount = 0;

  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".exe")) {
      if (!matched.installer) {
        matched.installer = file;
        matchedCount += 1;
      }
      continue;
    }
    if (lower.endsWith(".blockmap")) {
      if (!matched.blockmap) {
        matched.blockmap = file;
        matchedCount += 1;
      }
      continue;
    }
    if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
      if (lower === "latest.yml") {
        if (!matched["latest-yml"]) {
          matched["latest-yml"] = file;
          matchedCount += 1;
        }
      } else {
        invalidYamlNames.push(file.name);
      }
    }
  }

  return {
    matched,
    ignoredCount: Math.max(0, files.length - matchedCount),
    invalidYamlNames,
  };
}

export const DESKTOP_REQUIRED_SLOTS: Array<{
  type: DesktopUpdateAssetType;
  label: string;
}> = [
  { type: "latest-yml", label: "latest.yml" },
  { type: "installer", label: "安装包 EXE" },
  { type: "blockmap", label: "差分 blockmap" },
];

export function getMissingDesktopSlotLabels(
  stagedFiles: DesktopStagedFiles,
  existingAssets: Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>>,
): string[] {
  const missing: string[] = [];
  for (const slot of DESKTOP_REQUIRED_SLOTS) {
    const hasStaged = Boolean(stagedFiles[slot.type]);
    const hasExisting = Boolean(existingAssets[slot.type] && existingAssets[slot.type]!.status === "uploaded");
    if (!hasStaged && !hasExisting) {
      missing.push(slot.label);
    }
  }
  return missing;
}
