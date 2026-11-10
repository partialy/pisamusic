import type { ExtendedError, Socket } from "socket.io";
import { verifyUserToken } from "../../middleware/requireUserJwt";
import { userFromPublicUser } from "../listenTogether/listenTogetherTypes";

function normalizeToken(value: unknown): string {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) return "";
  return token.startsWith("Bearer ") ? token.slice("Bearer ".length).trim() : token;
}

export async function socketAuthMiddleware(socket: Socket, next: (err?: ExtendedError) => void): Promise<void> {
  const token = normalizeToken(socket.handshake.auth?.token);
  const user = (await verifyUserToken(token));
  if (!user) {
    next(new Error("UNAUTHORIZED"));
    return;
  }
  socket.data.user = userFromPublicUser(user);
  next();
}
