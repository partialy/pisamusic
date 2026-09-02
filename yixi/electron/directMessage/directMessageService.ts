import { getAccountSession, getDesktopDeviceMessageToken } from "../system/systemClient";
import { logger } from "../utils/logger";
import { DirectMessageClient, type DirectMessageIdentitySnapshot } from "./directMessageClient";
import { DirectMessageManager } from "./directMessageManager";

function getIdentity(): DirectMessageIdentitySnapshot {
  const session = getAccountSession();
  return {
    token: session.loggedIn && session.token ? session.token : undefined,
    accountId: session.loggedIn && session.user.id ? session.user.id : null,
    deviceToken: getDesktopDeviceMessageToken(),
  };
}

let manager: DirectMessageManager | null = null;

export function getDirectMessageManager(): DirectMessageManager {
  if (!manager) {
    manager = new DirectMessageManager({
      client: new DirectMessageClient(),
      getIdentity,
      warn: (event, metadata) => logger.warn(event, metadata),
    });
  }
  return manager;
}
