export function reportAnnouncementRead(announcementId: string): void {
  void window.electronAPI.markAnnouncementRead(announcementId).catch((error) => {
    void window.electronAPI.reportError(error, {
      scope: "announcement",
      action: "markRead",
      announcementId,
    });
  });
}
