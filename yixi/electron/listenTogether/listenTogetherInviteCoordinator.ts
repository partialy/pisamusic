import type { BrowserWindow } from "electron";
import {
  findListenTogetherInviteInArgs,
  parseListenTogetherInvite,
  type ListenTogetherInvite,
} from "../../src/listenTogether/listenTogetherShareLink";
import { logger } from "../utils/logger";

export const LISTEN_TOGETHER_INVITE_CHANNEL = "listen-together:invite";

type InviteCoordinatorOptions = {
  getMainWindow: () => BrowserWindow | null;
};

/** 缓冲冷启动/二次启动邀请，并在 renderer 初始化完成后投递最新一条。 */
export class ListenTogetherInviteCoordinator {
  private pendingInvite: ListenTogetherInvite | null = null;
  private rendererReady = false;
  private readonly getMainWindow: () => BrowserWindow | null;

  constructor(options: InviteCoordinatorOptions) {
    this.getMainWindow = options.getMainWindow;
  }

  captureArguments(args: readonly string[]): boolean {
    const invite = findListenTogetherInviteInArgs(args);
    if (!invite) return false;
    this.queue(invite);
    return true;
  }

  captureUrl(raw: string): boolean {
    const invite = parseListenTogetherInvite(raw);
    if (!invite) return false;
    this.queue(invite);
    return true;
  }

  markRendererReady(): void {
    this.rendererReady = true;
    this.flush();
  }

  resetRenderer(): void {
    this.rendererReady = false;
  }

  private queue(invite: ListenTogetherInvite): void {
    this.pendingInvite = invite;
    this.flush();
  }

  private flush(): void {
    const invite = this.pendingInvite;
    const win = this.getMainWindow();
    if (
      !invite ||
      !this.rendererReady ||
      !win ||
      win.isDestroyed() ||
      win.webContents.isDestroyed()
    ) {
      return;
    }
    try {
      win.webContents.send(LISTEN_TOGETHER_INVITE_CHANNEL, invite);
      this.pendingInvite = null;
    } catch (error) {
      logger.warn("deliver listen-together invite failed", {
        message: error instanceof Error ? error.message : String(error),
        roomId: invite.roomId,
      });
    }
  }
}
