import { message } from "@/utils/pure/message";
import type { MessageApi, NotificationApi, ModalApi,DialogApi,LoadingBarApi } from "naive-ui";

declare global {
  interface Window {
    $message: typeof message;
    $notification: NotificationApi;
    $modal: ModalApi;
    $dialog: DialogApi;
    $loadingBar: LoadingBarApi;
    $mainServer: string;
  }
}