export type AnnouncementPage = "discover" | "settings";
export type AnnouncementGotoAction =
  | { type: "url"; url: string; openMode: "browser" | "app"; label?: string; showHeaderBar?: boolean }
  | { type: "page"; page: AnnouncementPage; label?: string };

export type AnnouncementWebAction =
  | Extract<AnnouncementGotoAction, { type: "url" }>
  | { type: "protocol"; label: string; value: string };

export type AnnouncementAction =
  | { type: "none" }
  | { type: "copy"; label: string; value: string }
  | AnnouncementGotoAction
  | Extract<AnnouncementWebAction, { type: "protocol" }>;

export type AnnouncementBlock =
  | { type: "text"; text: string; bold?: boolean; color?: string; italic?: boolean }
  | { type: "image"; fileId: string; alt: string; url?: string }
  | { type: "highlight"; color: string; text: string; action: AnnouncementAction };

export type AnnouncementContent = {
  schemaVersion: 1;
  blocks: AnnouncementBlock[];
};

export type Announcement = {
  id: string;
  content: AnnouncementContent;
  time: string;
  publisher: string;
  confirmText: string;
  showEveryTime?: boolean;
  showGotoButton: boolean;
  gotoUrl?: string;
  gotoAction?: AnnouncementGotoAction;
  waitSeconds?: number;
  enabled: boolean;
};
