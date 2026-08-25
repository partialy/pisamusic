export type AccountUser = {
  id: string;
  username: string;
  email: string;
  avatar: string;
  avatarKey: string;
  avatarUrl: string;
  createdAt: number;
  vip: boolean;
  vipExpiresAt: number | null;
};

export type AccountAuthResult = {
  token: string;
  expiresAt: number;
  user: AccountUser;
};

export type AccountSession = AccountAuthResult & {
  loggedIn: boolean;
};

export type AccountSessionLike =
  | { loggedIn: boolean; user: AccountUser }
  | { isLogin: boolean; userInfo: AccountUser };

export function isSystemVipActive(
  session: AccountSessionLike | null | undefined,
  now = Date.now(),
): boolean {
  if (!session) return false;
  const loggedIn = "loggedIn" in session ? session.loggedIn : session.isLogin;
  const user = "user" in session ? session.user : session.userInfo;
  if (!loggedIn || !user) return false;
  return (
    user.vip === true &&
    typeof user.vipExpiresAt === "number" &&
    Number.isFinite(user.vipExpiresAt) &&
    user.vipExpiresAt > now
  );
}
