import type { MessageApi, NotificationApi, ModalApi,DialogApi,LoadingBarApi } from "naive-ui";

declare global {
  interface Window {
    $message: MessageApi;
    $notification: NotificationApi;
    $modal: ModalApi;
    $dialog: DialogApi;
    $loadingBar: LoadingBarApi;
    $mainServer: string;
  }
}