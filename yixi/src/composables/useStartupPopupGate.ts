import { readonly, ref } from "vue";
import { StartupPopupArbitrator } from "./startupPopupArbitration";

const directMessagesSettled = ref(false);
const announcementVisible = ref(false);
const arbitrator = new StartupPopupArbitrator();

export function useStartupPopupGate() {
  function setDirectMessagesSettled(settled: boolean) {
    arbitrator.setDirectMessagesSettled(settled);
    directMessagesSettled.value = settled;
  }

  function setAnnouncementVisible(visible: boolean) {
    arbitrator.setAnnouncementVisible(visible);
    announcementVisible.value = visible;
  }

  return {
    directMessagesSettled: readonly(directMessagesSettled),
    announcementVisible: readonly(announcementVisible),
    setDirectMessagesSettled,
    setAnnouncementVisible,
    canScheduleAnnouncement: () => arbitrator.canScheduleAnnouncement(),
    canPresentDirectMessages: () => arbitrator.canPresentDirectMessages(),
  };
}
