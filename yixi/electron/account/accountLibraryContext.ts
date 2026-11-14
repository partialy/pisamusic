import { getAppDatabase } from "../database";
import { getAccountSession, getDesktopDeviceClientId } from "../system/systemClient";
import { identityRevision } from "./accountIdentity";
export function captureAccountLibrary() {
  const session = getAccountSession();
  const scope = Object.freeze({ accountId: session.loggedIn ? session.user.id : "", deviceIdentity: getDesktopDeviceClientId() });
  const revision = identityRevision();
  return { session, scope, revision, repo: getAppDatabase().accountLibrary(scope) };
}
export type AccountLibraryContext = ReturnType<typeof captureAccountLibrary>;
export function isCurrentLibrary(context: AccountLibraryContext) {
  return context.revision === identityRevision();
}
export function publicAccountSession() {
  const { loggedIn, expiresAt, user } = getAccountSession();
  return { loggedIn, expiresAt, user, identityRevision: identityRevision() };
}
