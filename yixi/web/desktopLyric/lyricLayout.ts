import type {
  DesktopLyricLine,
} from "../../src/types/desktopLyric";

export interface TextMeasure {
  measure(text: string): number;
}

export interface TimedGlyphRun {
  text: string;
  x: number;
  width: number;
  startTimeMs: number;
  endTimeMs: number;
}

export interface LineLayout {
  text: string;
  totalWidth: number;
  runs: TimedGlyphRun[];
  startTimeMs: number;
  endTimeMs: number;
}

export function buildLineLayout(
  line: DesktopLyricLine | null | undefined,
  measure: TextMeasure,
): LineLayout {
  if (!line) {
    return {
      text: "",
      totalWidth: 0,
      runs: [],
      startTimeMs: 0,
      endTimeMs: 0,
    };
  }

  const startTimeMs = line.startTimeMs;
  const endTimeMs = line.endTimeMs;

  if (Array.isArray(line.words) && line.words.length > 0) {
    let currentX = 0;
    const runs: TimedGlyphRun[] = [];
    const textPieces: string[] = [];

    for (const word of line.words) {
      const wordText = String(word.text ?? "");
      if (!wordText) continue;
      const width = measure.measure(wordText);
      runs.push({
        text: wordText,
        x: currentX,
        width,
        startTimeMs: word.startTimeMs,
        endTimeMs: word.endTimeMs,
      });
      currentX += width;
      textPieces.push(wordText);
    }

    const fullText = line.text || textPieces.join("");
    return {
      text: fullText,
      totalWidth: currentX,
      runs,
      startTimeMs,
      endTimeMs,
    };
  }

  const text = String(line.text ?? "");
  const totalWidth = measure.measure(text);
  const runs: TimedGlyphRun[] = text
    ? [
        {
          text,
          x: 0,
          width: totalWidth,
          startTimeMs,
          endTimeMs,
        },
      ]
    : [];

  return {
    text,
    totalWidth,
    runs,
    startTimeMs,
    endTimeMs,
  };
}

export function findLineIndex(
  lines: DesktopLyricLine[],
  positionMs: number,
  hintIndex = -1,
): number {
  if (!Array.isArray(lines) || lines.length === 0) {
    return -1;
  }

  const len = lines.length;

  if (positionMs < lines[0].startTimeMs) {
    return 0;
  }

  if (positionMs >= lines[len - 1].startTimeMs) {
    return len - 1;
  }

  // Fast path: hint checks (current line and next line)
  if (hintIndex >= 0 && hintIndex < len) {
    const cur = lines[hintIndex];
    const next = hintIndex + 1 < len ? lines[hintIndex + 1] : null;

    if (cur && positionMs >= cur.startTimeMs) {
      if (!next || positionMs < next.startTimeMs) {
        return hintIndex;
      }
      if (next && hintIndex + 2 < len && positionMs < lines[hintIndex + 2].startTimeMs) {
        return hintIndex + 1;
      }
    }
  }

  // Binary search
  let low = 0;
  let high = len - 1;
  let candidate = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].startTimeMs <= positionMs) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return candidate;
}
