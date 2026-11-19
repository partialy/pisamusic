import jwt from "jsonwebtoken";
import { readInstallation } from "../db/installationStore";
import { toPublicUser, type PublicUser, type UserRecord } from "../db/userStore";
import { getUserJwtSecret } from "../middleware/requireUserJwt";

export const USER_JWT_EXPIRES_SECONDS = 7 * 24 * 60 * 60;
const USER_JWT_EXPIRES_IN = "7d";

export type UserAuthTokenResult = {
  token: string;
  expiresAt: number;
  user: PublicUser;
};

/** 签发用户 JWT（供登录、注册、刷新令牌及启动聚合复用）。 */
export async function issueUserAuthToken(
  user: UserRecord | PublicUser,
): Promise<UserAuthTokenResult> {
  const publicUser = "passwordHash" in user ? toPublicUser(user) : user;
  const installation = await readInstallation();
  const token = jwt.sign(
    { sub: publicUser.id, installationId: installation?.installation_id },
    getUserJwtSecret(),
    { expiresIn: USER_JWT_EXPIRES_IN },
  );
  return {
    token,
    expiresAt: Date.now() + USER_JWT_EXPIRES_SECONDS * 1000,
    user: publicUser,
  };
}
