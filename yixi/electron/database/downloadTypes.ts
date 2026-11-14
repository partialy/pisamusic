import type { DownloadTaskSnapshot, DownloadConfiguration, DownloadFileSnapshot } from "../../src/types/download";
import type { TrackSnapshot } from "./types";
export type PersistedDownloadTask = DownloadTaskSnapshot & {
  payload: TrackSnapshot; configuration: DownloadConfiguration; partPath: string; extension: string;
  validator: string; validatorKind: "etag" | "last-modified" | ""; transferComplete: boolean;
  retryAt: number; legacyId: number | null; candidateIdentity: string; candidateSize: number;
  assets: { path: string; identity: string }[];
};
export type PersistedDownloadFile = DownloadFileSnapshot;
