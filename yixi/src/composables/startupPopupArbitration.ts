export class StartupPopupArbitrator {
  private directMessagesSettled = false;
  private announcementVisible = false;

  setDirectMessagesSettled(settled: boolean) {
    this.directMessagesSettled = settled;
  }

  setAnnouncementVisible(visible: boolean) {
    this.announcementVisible = visible;
  }

  canScheduleAnnouncement() {
    return this.directMessagesSettled && !this.announcementVisible;
  }

  canPresentDirectMessages() {
    return !this.announcementVisible;
  }
}

type TimeoutHandle = ReturnType<typeof setTimeout>;

type AnnouncementSchedulerOptions = {
  delayMs: number;
  isEligible: () => boolean;
  load: () => Promise<(() => void) | null>;
  onError: (error: unknown) => void;
};

/**
 * Schedules the startup announcement only while its gate remains open.
 * A pending timer and an in-flight load are invalidated whenever the gate closes.
 */
export class AnnouncementAutoPopupScheduler {
  private timer: TimeoutHandle | undefined;
  private generation = 0;
  private loading = false;
  private readonly options: AnnouncementSchedulerOptions;

  constructor(options: AnnouncementSchedulerOptions) {
    this.options = options;
  }

  reconcile() {
    if (!this.options.isEligible()) {
      this.invalidate();
      return;
    }
    if (this.timer || this.loading) return;

    const generation = ++this.generation;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.loadAndPresent(generation);
    }, this.options.delayMs);
  }

  stop() {
    this.invalidate();
  }

  private invalidate() {
    this.generation += 1;
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async loadAndPresent(generation: number) {
    if (!this.isCurrentAndEligible(generation)) return;
    this.loading = true;
    try {
      const present = await this.options.load();
      if (present && this.isCurrentAndEligible(generation)) present();
    } catch (error) {
      if (this.isCurrentAndEligible(generation)) this.options.onError(error);
    } finally {
      this.loading = false;
      if (this.options.isEligible()) this.reconcile();
    }
  }

  private isCurrentAndEligible(generation: number) {
    return generation === this.generation && this.options.isEligible();
  }
}
