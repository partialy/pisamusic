export type DirectMessageTargetKind = "user" | "android_device" | "desktop_device";

export type DirectMessageItem = {
  id: string;
  targetKind: DirectMessageTargetKind;
  content: string;
  createdAt: number;
};

export type DirectMessageUnreadPage = {
  items: DirectMessageItem[];
  hasMore: boolean;
};
