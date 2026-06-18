import type { BrowserWindow } from "electron";
import {
  findListenTogetherInviteInArgs,
  parseListenTogetherInvite,
  type ListenTogetherInvite,
} from "../../src/listenTogether/listenTogetherShareLink";
import {
  findExternalShareInviteInArgs,
  parseExternalShareInvite,
  type ExternalShareInvite,
} from "../../src/share/shareLink";
import { logger } from "../utils/logger";

export const LISTEN_TOGETHER_INVITE_CHANNEL = "listen-together:invite";
export const EXTERNAL_SHARE_INVITE_CHANNEL = "share:invite";

type InviteCoordinatorOptions = {
  getMainWindow: () => BrowserWindow | null;
};

/** 缓冲冷启动/二次启动邀请，并在 renderer 初始化完成后投递最新一条。 */
export class ListenTogetherInviteCoordinator {
  private pendingInvite: ListenTogetherInvite | null = null;
  private pendingShareInvite: ExternalShareInvite | null = null;
  private rendererReady = false;
  private readonly getMainWindow: () => BrowserWindow | null;

  constructor(options: InviteCoordinatorOptions) {
    this.getMainWindow = options.getMainWindow;
  }

  captureArguments(args: readonly string[]): boolean {
    const invite = findListenTogetherInviteInArgs(args);
    const shareInvite = findExternalShareInviteInArgs(args);
    if (invite) this.queue(invite);
    if (shareInvite) this.queueShare(shareInvite);
    return Boolean(invite || shareInvite);
  }

  captureUrl(raw: string): boolean {
    const invite = parseListenTogetherInvite(raw);
    if (invite) {
      this.queue(invite);
      return true;
    }
    const shareInvite = parseExternalShareInvite(raw);
    if (!shareInvite) return false;
    this.queueShare(shareInvite);
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

  private queueShare(invite: ExternalShareInvite): void {
    this.pendingShareInvite = invite;
    this.flush();
  }

  private flush(): void {
    this.flushListenTogetherInvite();
    this.flushShareInvite();
  }

  private flushListenTogetherInvite(): void {
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

  private flushShareInvite(): void {
    const invite = this.pendingShareInvite;
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
      win.webContents.send(EXTERNAL_SHARE_INVITE_CHANNEL, invite);
      this.pendingShareInvite = null;
    } catch (error) {
      logger.warn("deliver share invite failed", {
        message: error instanceof Error ? error.message : String(error),
        uuid: invite.uuid,
      });
    }
  }
}
