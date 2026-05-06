import type {
  LyricLine as AMLyricLine,
  LyricWord as AMLyricWordTiming,
} from "@applemusic-like-lyrics/core";

// 类型定义
export interface MyLyricLine {
  index: number; // 索引
  time: number; // 开始时间(秒)
  endTime?: number; // 结束时间(逐字歌词用)
  duration?: number; // 持续时间(逐字歌词用)
  text: string; // 歌词文本
  words?: MyWordTiming[]; // 逐字时间信息
}

export interface MyWordTiming {
  word: string;
  startTime: number;
  endTime: number;
  duration: number;
  delay?: number;
}

// 时间标签转换器（支持多种格式）
const timeRegex = /(\d+):(\d+)([:.]\d+)?/;
const parseTime = (timeStr: string): number => {
  const match = timeStr.match(timeRegex);
  if (!match) return 0;

  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  const milliseconds = match[3] ? parseFloat(match[3].replace(/[:.]/, "")) : 0;

  return minutes * 60 + seconds + milliseconds / 1000;
};

// 标准LRC解析
export const parseLrc = (lrc: string): MyLyricLine[] => {
  const lines = lrc.split("\n");
  const lyrics: MyLyricLine[] = [];
  let lastTime = 0;
  let index = 0;

  lines.forEach((line) => {
    const timeMatch = line.match(/\[(\d+:\d+[:.]\d+)\]/g);
    const text = line.replace(/\[.*?\]/g, "").trim();
    if (timeMatch && text) {
      timeMatch.forEach((timeTag) => {
        const time = parseTime(timeTag.slice(1, -1));
        lyrics.push({
          index: index++,
          time,
          text,
          // 自动计算结束时间为下一句开始时间
          endTime: lastTime > time ? undefined : lastTime,
        });
        lastTime = time;
      });
    }
  });

  // 按时间排序并计算结束时间
  return lyrics
    .sort((a, b) => a.time - b.time)
    .map((line, i, arr) => ({
      ...line,
      endTime: arr[i + 1]?.time || line.time + 5, // 默认5秒间隔
    }));
};

// 逐字歌词解析（支持网易云KRC、QQ逐字格式）
export const parseKrc = (content: string): MyLyricLine[] => {
  // 按行分割内容
  const lines: string[] = content.split("\n");
  const result: MyLyricLine[] = [];
  let index = 0;
  // 遍历每一行
  lines.map((line) => {
    // 检查是否是带时间戳的歌词行
    const timeMatch = line.match(/\[(\d+),(\d+)\]/);
    if (!timeMatch) return;

    // 获取行级时间戳
    const startTime = parseInt(timeMatch[1]);
    const duration = parseInt(timeMatch[2]);

    // 获取歌词内容（移除行级时间戳）
    const textContent = line.substring(line.indexOf("]") + 1);

    // 解析单词级别时间戳
    const words = parseLines(textContent);

    // 只有当这行确实有歌词内容时才添加
    if (words.length > 0) {
      result.push({
        index: index++,
        time: startTime,
        endTime: startTime + duration,
        duration,
        text: textContent,
        words,
      });
    }
  });

  return result;
};

function parseLines(line: string): MyWordTiming[] {
  // 分割每个单词和其时间戳
  const matches = line.match(/<(\d+),(\d+),(\d+)>([^<]+)/g);

  if (!matches) {
    return [];
  }

  const result: MyWordTiming[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i].match(/<(\d+),(\d+),(\d+)>([^<]+)/);

    if (match) {
      let [_, startTime, duration, delay, word] = match;

      // 最后一个词不需要保留结尾空格
      let processedWord = word;

      if (
        i !== matches.length - 1 &&
        !word.endsWith(" ") &&
        /[a-z]/i.test(processedWord)
      ) {
        processedWord = word + " ";
      }

      result.push({
        startTime: parseInt(startTime),
        endTime: parseInt(startTime) + parseInt(duration),
        duration: parseInt(duration),
        word: processedWord,
        delay: parseInt(delay),
      });
    }
  }
  return result;
}

// 工具函数：自动将时间数组统一为毫秒
function normalizeTimeToMs(lyricList: MyLyricLine[]): MyLyricLine[] {
  if (lyricList.length === 0) return lyricList;

  // 找到倒数第二行（若只有一行，则用第一行）
  const referenceLine = lyricList.length >= 2
    ? lyricList[lyricList.length - 2]
    : lyricList[0];

  const refTime = referenceLine.time; // 假设 MyLyricLine 有 time: number

  // 判断：如果参考时间 < 2000，大概率是秒（如 1.5, 120），需要转 ms
  const isSeconds = refTime < 2000 && refTime >= 0;

  if (!isSeconds) {
    // 已经是 ms，直接返回原数据（避免修改原始对象）
    return lyricList.map(line => ({ ...line }));
  }

  // 否则：×1000 转为毫秒
  return lyricList.map(line => {
    const timeMs = Math.round(line.time * 1000);
    const endTimeMs = line.endTime ? Math.round(line.endTime * 1000) : 0;
    const words = line.words?.map(word => ({
      ...word,
      startTime: Math.round(word.startTime * 1000),
      endTime: Math.round(word.endTime * 1000),
    })) || undefined;

    return {
      ...line,
      time: timeMs,
      endTime: endTimeMs,
      words,
    };
  });
}

export const convertKrcToAMLyricLine = (
  lyricList: MyLyricLine[]
): AMLyricLine[] => {
  const normalizedList = normalizeTimeToMs(lyricList);

  return normalizedList.map((item) => {
    const words =
      item.words?.map((word) => ({
        startTime: item.time + word.startTime,
        endTime: item.time + word.endTime,
        word: word.word,
      })) || [];

    return {
      startTime: item.time,
      endTime: item.endTime || 0,
      words,
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    };
  });
};

export const convertLrcToAMLyricLine = (
  lrcList: MyLyricLine[]
): AMLyricLine[] => {
  const normalizedList = normalizeTimeToMs(lrcList);

  return normalizedList.map((item) => {
    const words: AMLyricWordTiming[] = [
      {
        startTime: item.time,
        endTime: item.endTime || 0,
        word: item.text,
      },
    ];

    return {
      startTime: item.time,
      endTime: item.endTime || 0,
      words,
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    };
  });
};

// export const convertKrcToAMLyricLine = (
//   lyricList: MyLyricLine[]
// ): AMLyricLine[] => {
//   return lyricList.map((item) => {
//     const words =
//       item.words?.map((word) => {
//         return {
//           startTime: item.time + word.startTime,
//           endTime: item.time + word.endTime,
//           word: word.word,
//         };
//       }) || [];
//     return {
//       startTime: item.time,
//       endTime: item.endTime || 0,
//       words: words,
//       translatedLyric: "",
//       romanLyric: "",
//       isBG: false,
//       isDuet: false,
//     };
//   });
// };

// export const convertLrcToAMLyricLine = (
//   lrcList: MyLyricLine[]
// ): AMLyricLine[] => {
//   let lyricList: AMLyricLine[] = [];
//   lrcList.map((item) => {
//     const words: AMLyricWordTiming[] = [
//       {
//         startTime: item.time,
//         endTime: item.endTime || 0,
//         word: item.text,
//       },
//     ];
//     lyricList.push({
//       startTime: item.time,
//       endTime: item.endTime || 0,
//       words: words,
//       translatedLyric: "",
//       romanLyric: "",
//       isBG: false,
//       isDuet: false,
//     });
//   });
//   return lyricList;
// };
