import type { AdminFaultReportDetail, FaultReportLog } from "../types/config";
import { FAULT_REPORT_SCENE_LABELS } from "./faultReports";

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const textEncoder = new TextEncoder();
const crcTable = buildCrcTable();

function buildCrcTable(): number[] {
  const table: number[] = [];
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c >>> 0);
  }
  return table;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function createZip(entries: ZipEntry[]): Blob {
  const now = dosDateTime(new Date());
  const fileParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const checksum = crc32(entry.data);

    const localHeader: number[] = [];
    writeUint32(localHeader, 0x04034b50);
    writeUint16(localHeader, 20);
    writeUint16(localHeader, 0x0800);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, now.time);
    writeUint16(localHeader, now.date);
    writeUint32(localHeader, checksum);
    writeUint32(localHeader, entry.data.length);
    writeUint32(localHeader, entry.data.length);
    writeUint16(localHeader, nameBytes.length);
    writeUint16(localHeader, 0);

    const localPart = concatBytes([new Uint8Array(localHeader), nameBytes, entry.data]);
    fileParts.push(localPart);

    const centralHeader: number[] = [];
    writeUint32(centralHeader, 0x02014b50);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 0x0800);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, now.time);
    writeUint16(centralHeader, now.date);
    writeUint32(centralHeader, checksum);
    writeUint32(centralHeader, entry.data.length);
    writeUint32(centralHeader, entry.data.length);
    writeUint16(centralHeader, nameBytes.length);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, 0);
    writeUint32(centralHeader, offset);
    centralParts.push(concatBytes([new Uint8Array(centralHeader), nameBytes]));

    offset += localPart.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endHeader: number[] = [];
  writeUint32(endHeader, 0x06054b50);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, entries.length);
  writeUint16(endHeader, entries.length);
  writeUint32(endHeader, centralDirectory.length);
  writeUint32(endHeader, offset);
  writeUint16(endHeader, 0);

  return new Blob([...fileParts, centralDirectory, new Uint8Array(endHeader)], { type: "application/zip" });
}

function safeFileName(value: string): string {
  return (value || "-")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+$/, "-");
}

function formatFileTime(value: number): string {
  const date = new Date(value);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function logMethodName(log: FaultReportLog): string {
  return log.methodName || log.failureType || log.clientLogId;
}

export function buildFaultReportLogFileName(log: FaultReportLog, index: number): string {
  return safeFileName(`#${index + 1}-${logMethodName(log)}-${formatFileTime(log.occurredAt)}.json`);
}

function buildFaultReportZipFileName(report: AdminFaultReportDetail): string {
  const scene = FAULT_REPORT_SCENE_LABELS[report.scene] || report.scene;
  const user = report.userId || "匿名";
  return safeFileName(`${scene}-${user}-${formatFileTime(Date.now())}.zip`);
}

function createLogExportData(report: AdminFaultReportDetail, log: FaultReportLog, index: number) {
  return {
    index: index + 1,
    exportedAt: new Date().toISOString(),
    report: {
      id: report.id,
      userId: report.userId,
      scene: report.scene,
      appVersion: report.appVersion,
      appVersionCode: report.appVersionCode,
      osVersion: report.osVersion,
      sdkInt: report.sdkInt,
      brand: report.brand,
      model: report.model,
      networkType: report.networkType,
      logCount: report.logCount,
      status: report.status,
      createdAt: report.createdAt,
      processedAt: report.processedAt,
    },
    log,
  };
}

function createJsonBlob(data: unknown): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
}

export function downloadFaultReportLogJson(report: AdminFaultReportDetail, index: number) {
  const log = report.logs[index];
  if (!log) throw new Error("故障日志不存在");
  triggerDownload(createJsonBlob(createLogExportData(report, log, index)), buildFaultReportLogFileName(log, index));
}

export function downloadFaultReportLogsZip(report: AdminFaultReportDetail) {
  if (report.logs.length === 0) throw new Error("当前批次没有可导出的故障日志");
  const entries = report.logs.map((log, index) => ({
    name: buildFaultReportLogFileName(log, index),
    data: textEncoder.encode(JSON.stringify(createLogExportData(report, log, index), null, 2)),
  }));
  triggerDownload(createZip(entries), buildFaultReportZipFileName(report));
}
