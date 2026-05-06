import { createDiscreteApi } from "naive-ui";

const { message, notification, modal, dialog, loadingBar } = createDiscreteApi([
  "message",
  "dialog",
  "notification",
  "modal",
  "loadingBar",
]);


export { message, notification, modal, dialog, loadingBar };
