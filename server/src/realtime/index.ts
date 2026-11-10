import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "./middlewares/socketAuthMiddleware";
import { registerListenTogetherSocket } from "./listenTogether/listenTogetherSocket";
import { initListenTogetherPublisher } from "./listenTogether/listenTogetherPublisher";
import type { AuthedRealtimeSocket } from "./socketTypes";
import { isMaintenanceMode } from "../operations/maintenance";

export function initRealtimeServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  initListenTogetherPublisher(io);

  io.use((socket, next) => {
    if (isMaintenanceMode()) return next(new Error("SERVICE_UNAVAILABLE"));
    next();
  });
  io.use(socketAuthMiddleware);
  io.on("connection", (socket) => {
    registerListenTogetherSocket(io, socket as AuthedRealtimeSocket);
  });

  return io;
}
