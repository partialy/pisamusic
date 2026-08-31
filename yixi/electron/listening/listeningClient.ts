import type {
  ListeningBatchResult,
  ListeningFragment,
  ListeningSummary,
} from "../../src/types/listening";
import { requestSystem, unwrapResponse } from "../system/systemClient";

export async function uploadListeningFragments(
  deviceId: string,
  fragments: ListeningFragment[]
): Promise<ListeningBatchResult> {
  const response = await requestSystem<ListeningBatchResult>("/api/listening/fragments/batch", {
    method: "POST",
    headers: { "x-pm-device-id": deviceId },
    body: {
      schemaVersion: 1,
      platform: "desktop",
      fragments,
    },
  });
  return unwrapResponse(response);
}

export async function fetchListeningSummary(): Promise<ListeningSummary> {
  const response = await requestSystem<ListeningSummary>("/api/listening/summary");
  return unwrapResponse(response);
}
