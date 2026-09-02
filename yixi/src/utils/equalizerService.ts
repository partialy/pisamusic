// equalizerService.ts
// Web Audio API 10段图示均衡器核心服务：管理音频节点拓扑、滤波器级联与平滑增益调节

export const EQUALIZER_FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;

export type EqualizerFrequencies = typeof EQUALIZER_FREQUENCIES;
export const BAND_COUNT = EQUALIZER_FREQUENCIES.length; // 10

class EqualizerService {
  private static instance: EqualizerService;
  private audioContext: AudioContext | null = null;
  private preampNode: GainNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private analyserNode: AnalyserNode | null = null;
  private frequencyBuffer: Uint8Array | null = null;

  // 当前激活状态与缓存增益 (dB)
  private isEnabled: boolean = false;
  private currentPreamp: number = 0; // -12 ~ +12 dB
  private currentGains: number[] = new Array(BAND_COUNT).fill(0); // -12 ~ +12 dB

  private constructor() {}

  public static getInstance(): EqualizerService {
    if (!EqualizerService.instance) {
      EqualizerService.instance = new EqualizerService();
    }
    return EqualizerService.instance;
  }

  /**
   * 初始化 Web Audio 上下文与均衡器节点拓扑图谱
   */
  private initContext(): boolean {
    if (this.audioContext && this.preampNode && this.filterNodes.length === BAND_COUNT && this.analyserNode) {
      return true;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        return false;
      }

      this.audioContext = new AudioCtxClass();

      // 1. 前级增益节点 (Preamp)
      this.preampNode = this.audioContext.createGain();
      this.preampNode.gain.value = 1.0; // 0 dB

      // 2. 10 个频段滤波器 (BiquadFilterNode 级联)
      this.filterNodes = EQUALIZER_FREQUENCIES.map((freq, index) => {
        const filter = this.audioContext!.createBiquadFilter();
        filter.frequency.value = freq;

        if (index === 0) {
          filter.type = "lowshelf";
        } else if (index === BAND_COUNT - 1) {
          filter.type = "highshelf";
        } else {
          filter.type = "peaking";
          filter.Q.value = 1.414; // 标准 Q 值，平滑覆盖相邻频段
        }
        filter.gain.value = 0; // 初始 0 dB
        return filter;
      });

      // 3. 频谱分析器节点 (用于全屏频谱仪视觉渲染)
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.78;
      this.frequencyBuffer = new Uint8Array(this.analyserNode.frequencyBinCount);

      // 4. 连接内部链条：
      // Preamp -> Filter[0] -> Filter[1] -> ... -> Filter[9] -> Analyser -> destination
      let prevNode: AudioNode = this.preampNode;
      for (const filter of this.filterNodes) {
        prevNode.connect(filter);
        prevNode = filter;
      }
      prevNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);

      return true;
    } catch (err) {
      console.warn("[EqualizerService] 初始化 AudioContext 失败:", err);
      return false;
    }
  }

  /**
   * 将 HTMLMediaElement (例如 Howler 内部的 <audio> 节点) 连接到均衡器图谱
   */
  public attach(mediaElement: HTMLMediaElement | null | undefined): void {
    if (!mediaElement) return;
    if ((mediaElement as any).__pisa_equalizer_connected) {
      return;
    }

    if (!this.initContext()) return;
    if (!this.audioContext || !this.preampNode) return;

    try {
      // 允许跨域音频分析 (Electron 特权协议或 CORS 响应)
      if (!mediaElement.crossOrigin) {
        mediaElement.crossOrigin = "anonymous";
      }

      const sourceNode = this.audioContext.createMediaElementSource(mediaElement);
      sourceNode.connect(this.preampNode);

      (mediaElement as any).__pisa_equalizer_connected = true;
      (mediaElement as any).__pisa_analyser_connected = true;

      // 挂载后立即同步当前的增益配置
      this.applyCurrentGains();
    } catch (err) {
      console.warn("[EqualizerService] 挂载 AudioElement 失败:", err);
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
        console.warn("[EqualizerService] resume AudioContext 失败:", err);
      }
    }
  }

  /**
   * 设置是否启用均衡器 (启用 / 旁路 Bypass)
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.applyCurrentGains();
  }

  /**
   * 设置前级增益 (-12 ~ +12 dB)
   */
  public setPreamp(preampDb: number): void {
    this.currentPreamp = Math.max(-12, Math.min(12, preampDb));
    this.applyPreampGain();
  }

  /**
   * 设置单个频段增益 (-12 ~ +12 dB)
   */
  public setGain(index: number, gainDb: number): void {
    if (index < 0 || index >= BAND_COUNT) return;
    this.currentGains[index] = Math.max(-12, Math.min(12, gainDb));
    this.applyBandGain(index);
  }

  /**
   * 批量更新所有频段及前级增益
   */
  public setGains(gains: number[], preamp?: number): void {
    for (let i = 0; i < BAND_COUNT; i++) {
      if (typeof gains[i] === "number") {
        this.currentGains[i] = Math.max(-12, Math.min(12, gains[i]));
      }
    }
    if (typeof preamp === "number") {
      this.currentPreamp = Math.max(-12, Math.min(12, preamp));
    }
    this.applyCurrentGains();
  }

  /**
   * 应用前级增益（平滑指数过渡，防止爆音）
   */
  private applyPreampGain(): void {
    if (!this.audioContext || !this.preampNode) return;
    const targetPreampDb = this.isEnabled ? this.currentPreamp : 0;
    // 将 dB 转为线性放大系数: 10^(dB / 20)
    const linearGain = Math.pow(10, targetPreampDb / 20);
    const currentTime = this.audioContext.currentTime;
    this.preampNode.gain.setTargetAtTime(linearGain, currentTime, 0.04);
  }

  /**
   * 应用单个频段增益（平滑过渡）
   */
  private applyBandGain(index: number): void {
    if (!this.audioContext || !this.filterNodes[index]) return;
    const targetGain = this.isEnabled ? this.currentGains[index] : 0;
    const currentTime = this.audioContext.currentTime;
    this.filterNodes[index].gain.setTargetAtTime(targetGain, currentTime, 0.04);
  }

  /**
   * 将当前全部状态同步到 Web Audio 节点
   */
  private applyCurrentGains(): void {
    this.applyPreampGain();
    for (let i = 0; i < BAND_COUNT; i++) {
      this.applyBandGain(i);
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

export const equalizerService = EqualizerService.getInstance();
