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
  const session = getAccountSession();
  const activeAccountId = session.loggedIn ? session.user.id : "";
  return context.revision === identityRevision()
    && activeAccountId === context.scope.accountId
    && session.token === context.session.token;
}
export function publicAccountSession() {
  const { loggedIn, expiresAt, user } = getAccountSession();
  return { loggedIn, expiresAt, user, identityRevision: identityRevision() };
}
