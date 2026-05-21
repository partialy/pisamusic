// ============================================================
// lyric-parser.ts — 多格式歌词解析工具
// 支持：LRC 单行歌词 / KRC 逐字歌词 / YRC 逐字歌词（Y 格式）
// 用法：LyricParser.parseLrc(text) / LyricParser.parseKrc(text) / LyricParser.parseYrc(text)
// ============================================================

/** 一个歌词单词 */
export interface LyricWord {
  /** 单词的起始时间，单位为毫秒 */
  startTime: number;
  /** 单词的结束时间，单位为毫秒 */
  endTime: number;
  /** 单词内容 */
  word: string;
}

/** 一行歌词，存储多个单词 */
export interface LyricLine {
  /**
   * 该行的所有单词
   * 如果是 LyRiC 等只能表达一行歌词的格式，这里就只会有一个单词，
   * 且通常其始末时间和本结构的 `startTime` 和 `endTime` 相同
   */
  words: LyricWord[];
  /** 句子的起始时间，单位为毫秒 */
  startTime: number;
  /** 句子的结束时间，单位为毫秒 */
  endTime: number;
}

export class LyricParser {
  // ─────────────────────────────────────────────────────────
  // 工具：统一换行符，兼容以下三种情况：
  //   1. 真实换行符  \r\n / \n（正常文件读取）
  //   2. 字面量转义  \\r\\n / \\n（JSON 字符串、网络传输等场景）
  // ─────────────────────────────────────────────────────────
  private static normalizeNewlines(text: string): string {
    return (
      text
        // 先把字面量 \r\n（4个字符：\  r  \  n）替换成真实换行
        .replace(/\\r\\n/g, "\n")
        // 再把剩余字面量 \n（2个字符：\  n）替换成真实换行
        .replace(/\\n/g, "\n")
        // 最后把真实 \r\n 也统一成 \n，方便后续 split('\n')
        .replace(/\r\n/g, "\n")
    );
  }

  // ─────────────────────────────────────────────────────────
  // 工具：将 "mm:ss.xx" 或 "mm:ss.xxx" 格式时间戳转换为毫秒
  // ─────────────────────────────────────────────────────────
  private static parseTimestamp(ts: string): number {
    // 匹配 mm:ss.xx / mm:ss.xxx 两种精度
    const m = ts.match(/^(\d+):(\d+)\.(\d+)$/);
    if (!m) return 0;
    const minutes = parseInt(m[1], 10);
    const seconds = parseInt(m[2], 10);
    // 小数部分：统一转换成毫秒（支持 2 位 / 3 位小数）
    const ms = parseInt(m[3].padEnd(3, "0").slice(0, 3), 10);
    return minutes * 60_000 + seconds * 1_000 + ms;
  }

  /**
   * 解析 LRC 格式歌词（单行歌词，每行只有整句时间戳）
   *
   * @param lrc - 原始 LRC 文本字符串
   * @returns LyricLine 数组，每行包含一个 word，
   *          startTime 取当前行时间戳，endTime 取下一行时间戳（最后一行与 startTime 相同）
   *
   * @example
   * ```ts
   * const lines = LyricParser.parseLrc("[00:19.34]今天我\n[00:22.99]寒夜里看雪飘过");
   * // lines[0] => { startTime: 19340, endTime: 22990, words: [{ word: "今天我", ... }] }
   * ```
   */
  static parseLrc(lrc: string): LyricLine[] {
    // 统一换行符（兼容真实换行与字面量 \r\n / \n），再按行拆分
    const rawLines = this.normalizeNewlines(lrc).split("\n");

    // 收集所有有效的 [时间戳]歌词 行（跳过元数据标签如 [ti:xxx]）
    const timestampLineRegex = /^\[(\d+:\d+\.\d+)\](.*)$/;
    const entries: { time: number; text: string }[] = [];

    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line) continue;

      // 跳过元数据行，例如 [ti:...] [ar:...] [offset:...]
      // 元数据标签冒号后跟的不是纯数字（时间），可以通过是否匹配时间格式来区分
      const match = line.match(timestampLineRegex);
      if (!match) continue;

      const time = this.parseTimestamp(match[1]);
      const text = match[2].trim();

      // 过滤空文本行（部分 LRC 文件末尾有空时间戳行）
      if (text) {
        entries.push({ time, text });
      }
    }

    // 按时间升序排序（部分文件时间戳乱序）
    entries.sort((a, b) => a.time - b.time);

    // 构造 LyricLine[]：endTime = 下一行的 startTime，最后一行 endTime = startTime
    const lines: LyricLine[] = entries.map((entry, idx) => {
      const startTime = entry.time;
      const endTime = idx < entries.length - 1 ? entries[idx + 1].time : entry.time;

      const word: LyricWord = {
        startTime,
        endTime,
        word: entry.text,
      };

      return { startTime, endTime, words: [word] };
    });

    return lines;
  }

  /**
   * 解析 KRC 格式歌词（逐字歌词，酷狗格式）
   *
   * KRC 行格式：`[行起始ms,行时长ms]<字偏移ms,字时长ms,0>字符...`
   *
   * @param krc - 原始 KRC 文本字符串（纯文本，非加密版本）
   * @returns LyricLine 数组，每行 words 包含逐字时间信息
   *
   * @example
   * ```ts
   * const lines = LyricParser.parseKrc("[19340,3650]<0,500,0>今<500,600,0>天<1100,800,0>我");
   * // lines[0].words => [{ word:"今", startTime:19340, endTime:19840 }, ...]
   * ```
   */
  static parseKrc(krc: string): LyricLine[] {
    // 统一换行符后按行拆分
    const rawLines = this.normalizeNewlines(krc).split("\n");
    const lines: LyricLine[] = [];

    // 匹配行头：[起始时间ms, 持续时间ms]
    const lineHeaderRegex = /^\[(\d+),(\d+)\]/;
    // 匹配单字块：<相对偏移ms, 持续时间ms, 0>字符内容
    const wordBlockRegex = /<(\d+),(\d+),\d+>([^<]*)/g;

    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line) continue;

      // 解析行头，获取该行起始时间和总时长
      const headerMatch = line.match(lineHeaderRegex);
      if (!headerMatch) continue;

      const lineStart = parseInt(headerMatch[1], 10);
      const lineDuration = parseInt(headerMatch[2], 10);
      const lineEnd = lineStart + lineDuration;

      // 提取行头之后的逐字内容部分
      const wordsPart = line.slice(headerMatch[0].length);
      const words: LyricWord[] = [];

      // 逐一匹配 <offset,duration,0>text 块
      let wm: RegExpExecArray | null;
      wordBlockRegex.lastIndex = 0; // 重置正则状态
      while ((wm = wordBlockRegex.exec(wordsPart)) !== null) {
        const relOffset = parseInt(wm[1], 10); // 相对于行起始的偏移
        const wordDuration = parseInt(wm[2], 10);
        const wordText = wm[3];

        // 跳过内容为空的块（部分 KRC 末尾有空块）
        if (!wordText) continue;

        const wordStart = lineStart + relOffset;
        const wordEnd = wordStart + wordDuration;

        words.push({ startTime: wordStart, endTime: wordEnd, word: wordText });
      }

      if (words.length === 0) continue;

      lines.push({ startTime: lineStart, endTime: lineEnd, words });
    }

    // 按行起始时间升序排序
    lines.sort((a, b) => a.startTime - b.startTime);

    return lines;
  }

  /**
   * 解析 YRC 格式歌词（逐字歌词，网易云音乐 Y 格式）
   *
   * YRC 行格式：`[行起始ms,行时长ms](字起始ms,字时长ms,0)字符...`
   *
   * 与 KRC 的区别：
   * - 字块使用 `()` 而非 `<>` 包裹
   * - 字块内的时间是**绝对时间**（字自身的起始 ms），而非相对于行的偏移
   *
   * @param yrc - 原始 YRC 文本字符串
   * @returns LyricLine 数组，每行 words 包含逐字时间信息
   *
   * @example
   * ```ts
   * const lines = LyricParser.parseYrc("[19340,3650](19340,500,0)今(19840,600,0)天(20440,800,0)我");
   * // lines[0].words => [{ word:"今", startTime:19340, endTime:19840 }, ...]
   * ```
   */
  static parseYrc(yrc: string): LyricLine[] {
    // 统一换行符后按行拆分
    const rawLines = this.normalizeNewlines(yrc).split("\n");
    const lines: LyricLine[] = [];

    // 匹配行头：[起始时间ms, 持续时间ms]
    const lineHeaderRegex = /^\[(\d+),(\d+)\]/;
    // 匹配单字块：(绝对起始ms, 持续时间ms, 0)字符内容
    const wordBlockRegex = /\((\d+),(\d+),\d+\)([^(]*)/g;

    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line) continue;

      // 解析行头
      const headerMatch = line.match(lineHeaderRegex);
      if (!headerMatch) continue;

      const lineStart = parseInt(headerMatch[1], 10);
      const lineDuration = parseInt(headerMatch[2], 10);
      const lineEnd = lineStart + lineDuration;

      // 提取行头之后的逐字内容
      const wordsPart = line.slice(headerMatch[0].length);
      const words: LyricWord[] = [];

      // 逐一匹配 (startMs,duration,0)text 块
      let wm: RegExpExecArray | null;
      wordBlockRegex.lastIndex = 0; // 重置正则状态
      while ((wm = wordBlockRegex.exec(wordsPart)) !== null) {
        const wordStart = parseInt(wm[1], 10);   // 绝对起始时间
        const wordDuration = parseInt(wm[2], 10);
        const wordText = wm[3];

        if (!wordText) continue;

        const wordEnd = wordStart + wordDuration;
        words.push({ startTime: wordStart, endTime: wordEnd, word: wordText });
      }

      if (words.length === 0) continue;

      lines.push({ startTime: lineStart, endTime: lineEnd, words });
    }

    // 按行起始时间升序排序
    lines.sort((a, b) => a.startTime - b.startTime);

    return lines;
  }
}