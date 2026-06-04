import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "./middlewares/socketAuthMiddleware";
import { registerListenTogetherSocket } from "./listenTogether/listenTogetherSocket";
import type { AuthedRealtimeSocket } from "./socketTypes";

export function initRealtimeServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);
  io.on("connection", (socket) => {
    registerListenTogetherSocket(io, socket as AuthedRealtimeSocket);
  });

  return io;
}
