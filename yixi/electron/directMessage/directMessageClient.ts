import type {
  DirectMessageUnreadPage,
} from "../../src/types/directMessage";
import { requestSystem, unwrapResponse } from "../system/systemClient";

export type DirectMessageIdentitySnapshot = {
  token: string | undefined;
  accountId: string | null;
  deviceToken: string | undefined;
};

function requestOptions(identity: DirectMessageIdentitySnapshot) {
  return {
    token: identity.token ?? null,
    headers: identity.deviceToken
      ? { "x-pm-device-token": identity.deviceToken }
      : undefined,
    recordFailure: false,
  };
}

export class DirectMessageClient {
  async listUnread(identity: DirectMessageIdentitySnapshot): Promise<DirectMessageUnreadPage> {
    const response = await requestSystem<DirectMessageUnreadPage>("/api/messages/unread?limit=50", {
      method: "GET",
      ...requestOptions(identity),
    });
    return unwrapResponse(response);
  }

  async markRead(identity: DirectMessageIdentitySnapshot, id: string): Promise<void> {
    const response = await requestSystem<{ id: string; readAt: number }>(`/api/messages/${encodeURIComponent(id)}/read`, {
      method: "POST",
      ...requestOptions(identity),
    });
    unwrapResponse(response);
  }
}
