import type { ApiResponse } from "../types/api";

export type InstallationStatus = {
  initialized: boolean;
  installationId?: string;
  databaseType: "SQLITE" | "MYSQL";
  transferStatus: "ready" | "incomplete" | null;
  requiresSetupToken: boolean;
};
export type SetupInput = { setupToken: string; username: string; password: string; confirmPassword: string };

async function request(path: string, input?: SetupInput): Promise<InstallationStatus> {
  const response = await fetch(`/api/setup/${path}`, {
    method: input ? "POST" : "GET",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  const body = await response.json() as ApiResponse<InstallationStatus>;
  if (!response.ok || !body.success || !body.data) throw new Error(body.msg || `读取安装状态失败：HTTP ${response.status}`);
  return body.data;
}
export const fetchInstallationStatus = () => request("status");
export const completeInstallation = (input: SetupInput) => request("complete", input);
