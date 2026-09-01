// audioAnalyser.ts
// Web Audio API 分析器单例：用于提取实时音频频域数据，支持 Canvas 频谱仪渲染

class AudioAnalyserService {
  private static instance: AudioAnalyserService;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private frequencyBuffer: Uint8Array | null = null;

  private constructor() {}

  public static getInstance(): AudioAnalyserService {
    if (!AudioAnalyserService.instance) {
      AudioAnalyserService.instance = new AudioAnalyserService();
    }
    return AudioAnalyserService.instance;
  }

  private initContext(): boolean {
    if (this.audioContext && this.analyserNode && this.frequencyBuffer) {
      return true;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        return false;
      }

      this.audioContext = new AudioCtxClass();
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512; // 256 frequency bins (高精度频段细分)
      this.analyserNode.smoothingTimeConstant = 0.78;
      this.frequencyBuffer = new Uint8Array(this.analyserNode.frequencyBinCount);
      return true;
    } catch (err) {
      console.warn("[AudioAnalyser] 初始化 AudioContext 失败:", err);
      return false;
    }
  }

  /**
   * 将 HTMLMediaElement (例如 Howler 内部的 <audio> 节点) 连接到分析器图谱
   */
  public attach(mediaElement: HTMLMediaElement | null | undefined): void {
    if (!mediaElement) return;
    if ((mediaElement as any).__pisa_analyser_connected) {
      return;
    }

    if (!this.initContext()) return;
    if (!this.audioContext || !this.analyserNode) return;

    try {
      // 允许跨域音频分析 (Electron 特权协议或 CORS 响应)
      if (!mediaElement.crossOrigin) {
        mediaElement.crossOrigin = "anonymous";
      }

      const sourceNode = this.audioContext.createMediaElementSource(mediaElement);
      sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);

      (mediaElement as any).__pisa_analyser_connected = true;
    } catch (err) {
      // 若节点在其他生命周期已被挂载，捕获异常避免阻断播放
      console.warn("[AudioAnalyser] 挂载 AudioElement 失败:", err);
    }
  }

  /**
   * 恢复可能处于 suspended 状态的 AudioContext (在用户交互或播放动作时调用)
   */
  public async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch (err) {
        console.warn("[AudioAnalyser] resume AudioContext 失败:", err);
      }
    }
  }

  /**
   * 提取当前帧的频域能量数组 (0~255)
   */
  public getFrequencyData(): Uint8Array | null {
    if (!this.analyserNode || !this.frequencyBuffer) {
      return null;
    }
    this.analyserNode.getByteFrequencyData(this.frequencyBuffer);
    return this.frequencyBuffer;
  }

  /**
   * 判断分析器是否就绪且已连接有效音频节点
   */
  public isReady(): boolean {
    return Boolean(this.analyserNode && this.frequencyBuffer);
  }
}

export const audioAnalyser = AudioAnalyserService.getInstance();
