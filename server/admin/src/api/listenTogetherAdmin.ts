import { fetchWithAuth, parseJson } from "./client";

export type AdminOnlineRoomListItem = {
  recordId: string;
  roomId: string;
  roomName: string;
  host: {
    userId: string;
    username: string;
    nickname: string;
    avatarUrl: string;
  };
  song: {
    source: string;
    id: string;
    name: string;
    singer: string;
    album: string;
    duration: number;
    cover: string;
  } | null;
  playbackStatus: "playing" | "paused" | "ended";
  position: number;
  onlinePeople: number;
  currentPeople: number;
  maxPeople: number;
  memberOperation: boolean;
  peakPeople: number;
  totalJoinCount: number;
  uniquePeople: number;
  createdAt: number;
  updatedAt: number;
};

export type AdminOnlineRoomMember = {
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string;
  role: "host" | "member";
  online: boolean;
  joinedAt: number;
  lastSeenAt: number;
};

export type AdminOnlineRoomDetail = AdminOnlineRoomListItem & {
  version: number;
  members: AdminOnlineRoomMember[];
};

export type AdminRoomHistoryListItem = {
  recordId: string;
  roomId: string;
  roomName: string;
  lifecycleStatus: "active" | "closed";
  initialHost: {
    userId: string;
    username: string;
    nickname: string;
    avatarUrl: string;
  };
  finalHost: {
    userId: string;
    username: string;
    nickname: string;
    avatarUrl: string;
  };
  maxPeople: number;
  memberOperation: boolean;
  peakPeople: number;
  totalJoinCount: number;
  uniquePeople: number;
  finalPeople: number;
  createdAt: number;
  updatedAt: number;
  endedAt: number | null;
  durationMs: number;
  endReason: "empty" | "host_left" | "admin_dissolved" | "server_restart" | "timeout" | null;
  endedByAdmin: string | null;
  lastSong: {
    source: string;
    id: string;
    name: string;
    singer: string;
    album: string;
    duration: number;
    cover: string;
  } | null;
  finalPlaybackStatus: "playing" | "paused" | "ended";
  finalPosition: number;
};

export type AdminRoomMemberHistoryItem = {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string;
  role: "host" | "member";
  joinedAt: number;
  leftAt: number | null;
  lastSeenAt: number;
  leaveReason: string | null;
  durationSeconds: number;
};

export type AdminRoomHistoryDetail = AdminRoomHistoryListItem & {
  members: AdminRoomMemberHistoryItem[];
};

export type AdminOnlineRoomsPage = {
  items: AdminOnlineRoomListItem[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminRoomHistoryPage = {
  items: AdminRoomHistoryListItem[];
  total: number;
  offset: number;
  limit: number;
};

export async function fetchAdminOnlineRooms(params: {
  keyword?: string;
  offset?: number;
  limit?: number;
}): Promise<AdminOnlineRoomsPage> {
  const query = new URLSearchParams();
  if (params.keyword?.trim()) query.set("keyword", params.keyword.trim());
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  const res = await fetchWithAuth(`/api/admin/listen-together/online?${query.toString()}`);
  const body = await parseJson<AdminOnlineRoomsPage>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminOnlineRoomDetail(recordId: string): Promise<AdminOnlineRoomDetail> {
  const res = await fetchWithAuth(`/api/admin/listen-together/online/${encodeURIComponent(recordId)}`);
  const body = await parseJson<AdminOnlineRoomDetail>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function dissolveAdminOnlineRoom(recordId: string): Promise<{ recordId: string; roomId: string; endedAt: number }> {
  const res = await fetchWithAuth(`/api/admin/listen-together/online/${encodeURIComponent(recordId)}/dissolve`, {
    method: "POST",
  });
  const body = await parseJson<{ recordId: string; roomId: string; endedAt: number }>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminRoomHistory(params: {
  keyword?: string;
  endReason?: string;
  startFrom?: number;
  startTo?: number;
  offset?: number;
  limit?: number;
}): Promise<AdminRoomHistoryPage> {
  const query = new URLSearchParams();
  if (params.keyword?.trim()) query.set("keyword", params.keyword.trim());
  if (params.endReason?.trim()) query.set("endReason", params.endReason.trim());
  if (params.startFrom !== undefined) query.set("startFrom", String(params.startFrom));
  if (params.startTo !== undefined) query.set("startTo", String(params.startTo));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  const res = await fetchWithAuth(`/api/admin/listen-together/history?${query.toString()}`);
  const body = await parseJson<AdminRoomHistoryPage>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

export async function fetchAdminRoomHistoryDetail(recordId: string): Promise<AdminRoomHistoryDetail> {
  const res = await fetchWithAuth(`/api/admin/listen-together/history/${encodeURIComponent(recordId)}`);
  const body = await parseJson<AdminRoomHistoryDetail>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}
