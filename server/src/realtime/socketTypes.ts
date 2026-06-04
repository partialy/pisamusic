import type { Socket } from "socket.io";
import type { ListenTogetherSocketUser } from "./listenTogether/listenTogetherTypes";

export type RealtimeSocketData = {
  user: ListenTogetherSocketUser;
};

export type AuthedRealtimeSocket = Socket & {
  data: RealtimeSocketData;
};
