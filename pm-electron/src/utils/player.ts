// AudioPlayer.ts
import { Howl, Howler } from "howler";

type AudioEvent =
  | "load"
  | "play"
  | "pause"
  | "stop"
  | "end"
  | "volume"
  | "seek"
  | "error";

class AudioPlayer {
  private static instance: AudioPlayer;
  private howl: Howl | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private events: Record<AudioEvent, Function[]> = {
    load: [],
    play: [],
    pause: [],
    stop: [],
    end: [],
    volume: [],
    seek: [],
    error: [],
  };

  private playlist: string[] = []; // 播放列表（URL数组）
  private currentIndex: number = -1; // 当前播放的索引

  private constructor() {
    this.setupGlobalVolumeControl();
    this.setupAudioContext();
  }

  public static getInstance(): AudioPlayer {
    if (!AudioPlayer.instance) {
      AudioPlayer.instance = new AudioPlayer();
    }
    return AudioPlayer.instance;
  }

  private setupGlobalVolumeControl() {
    Howler.volume(0.7); // 默认音量
  }

  private setupAudioContext() {
    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
  }

  public load(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.dispose();

      this.howl = new Howl({
        src: [url],
        html5: true,
        format: ["mp3", "flac", "wav", "ogg", "aac"],
        onload: () => {
          this.connectAudioNodes();
          this.emit("load");
          resolve();
        },
        onplay: () => this.emit("play"),
        onpause: () => this.emit("pause"),
        onstop: () => this.emit("stop"),
        onend: () => this.emit("end"),
        onseek: () => this.emit("seek"),
        onvolume: () => this.emit("volume", this.getVolume()),
        onloaderror: (err) => {
          this.emit("error", err);
          reject(err);
        },
        onplayerror: (err) => {
          this.emit("error", err);
          reject(err);
        },
      });
    });
  }

  public next(): void {
    if (this.playlist.length === 0) return;

    const nextIndex = (this.currentIndex + 1) % this.playlist.length;
    this.playTrack(nextIndex);
  }

  public prev(): void {
    if (this.playlist.length === 0) return;

    const prevIndex =
      (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.playTrack(prevIndex);
  }

  private playTrack(index: number): Promise<void> {
    this.currentIndex = index;
    return this.load(this.playlist[index]);
  }

  private connectAudioNodes() {
    if (!this.howl || !this.audioContext || !this.analyser) return;

    // 使用 Howler 的 WebAudio 集成
    Howler.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  public play(): void {
    if (!this.howl) return;
    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume();
    }
    this.howl.play();
  }

  public pause(): void {
    this.howl?.pause();
  }

  public stop(): void {
    this.howl?.stop();
  }

  public seek(position: number): void {
    if (!this.howl) return;
    this.howl.seek(position);
  }

  public getCurrentTime(): number {
    return this.howl?.seek() || 0;
  }

  public getDuration(): number {
    return this.howl?.duration() || 0;
  }

  public setVolume(volume: number): void {
    Howler.volume(volume);
  }

  public getVolume(): number {
    return Howler.volume();
  }

  public on(event: AudioEvent, callback: Function): void {
    this.events[event].push(callback);
  }

  private emit(event: AudioEvent, ...args: any[]): void {
    this.events[event].forEach((callback) => callback(...args));
  }

  public dispose(): void {
    this.howl?.unload();
    this.howl = null;
  }
}

export default AudioPlayer.getInstance();
