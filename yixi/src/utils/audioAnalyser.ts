// audioAnalyser.ts
// Web Audio API 分析器代理：委托给全局 equalizerService，用于提取实时音频频域数据，支持 Canvas 频谱仪渲染

import { equalizerService } from "./equalizerService";

class AudioAnalyserService {
  private static instance: AudioAnalyserService;

  private constructor() {}

  public static getInstance(): AudioAnalyserService {
    if (!AudioAnalyserService.instance) {
      AudioAnalyserService.instance = new AudioAnalyserService();
    }
    return AudioAnalyserService.instance;
  }

  public attach(mediaElement: HTMLMediaElement | null | undefined): void {
    equalizerService.attach(mediaElement);
  }

  public async resume(): Promise<void> {
    await equalizerService.resume();
  }

  public getFrequencyData(): Uint8Array<ArrayBuffer> | null {
    return equalizerService.getFrequencyData();
  }

  public isReady(): boolean {
    return equalizerService.isReady();
  }
}

export const audioAnalyser = AudioAnalyserService.getInstance();

