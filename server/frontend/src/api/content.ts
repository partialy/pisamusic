import type { ApiResponse } from "../types/update";

export type LegalPageKind = "service-agreement" | "privacy-policy";

export type ContentPage = {
  title: string;
  content: string;
};

export async function fetchContentPage(kind: LegalPageKind): Promise<ContentPage> {
  const res = await fetch(`/api/config/${kind}`, {
    headers: { Accept: "application/json" },
  });
  const body = (await res.json()) as ApiResponse<ContentPage>;

  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }

  return body.data;
}
