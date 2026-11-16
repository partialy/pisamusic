import type { LyricLine } from "../utils/common/LyricParser";
import type { EffectGlyph, EffectLineLayout } from "./lyricStyleEffects";

interface TimedGlyph extends EffectGlyph { wordIndex: number }

export interface WrappedLyricLayoutOptions {
  maxWidth: number;
  fontSize: number;
  centered: boolean;
}

interface GraphemeSegmenter { segment(text: string): Iterable<{ segment: string }> }
const Segmenter = (Intl as typeof Intl & {
  Segmenter?: new (locale: undefined, options: { granularity: "grapheme" }) => GraphemeSegmenter;
}).Segmenter;
const segmenter = Segmenter ? new Segmenter(undefined, { granularity: "grapheme" }) : null;
const splitGraphemes = (text: string): string[] => segmenter
  ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
const isWordCharacter = (text: string) => /^[\p{Script=Latin}\p{N}'’\-]+$/u.test(text);

/** 二维排版仅改变视觉位置；逐字时间与 logicalX 始终沿整句连续。 */
export function buildWrappedLyricLayout(
  ctx: CanvasRenderingContext2D,
  line: LyricLine,
  options: WrappedLyricLayoutOptions,
): EffectLineLayout {
  const maxWidth = Math.max(1, options.maxWidth);
  const lineHeight = options.fontSize * 1.45;
  let logicalX = 0;
  const glyphs: TimedGlyph[] = [];
  line.words.forEach((word, wordIndex) => {
    const chars = splitGraphemes(word.word.replace(/\r\n?/g, "\n"));
    const duration = Math.max(0, word.endTime - word.startTime);
    chars.forEach((text, index) => {
      const width = text === "\n" ? 0 : ctx.measureText(text).width;
      glyphs.push({
        text, width, x: 0, y: 0, logicalX, wordIndex,
        startTimeMs: word.startTime + duration * index / Math.max(1, chars.length),
        endTimeMs: word.startTime + duration * (index + 1) / Math.max(1, chars.length),
      });
      logicalX += width;
    });
  });

  // 英文尽量整词换行，中文和超过容器宽度的单词按字素折行。
  const tokens: TimedGlyph[][] = [];
  glyphs.forEach((glyph) => {
    const previous = tokens[tokens.length - 1];
    if (isWordCharacter(glyph.text) && previous && isWordCharacter(previous[previous.length - 1].text)) {
      previous.push(glyph);
    } else tokens.push([glyph]);
  });
  const rows: TimedGlyph[][] = [[]];
  let rowWidth = 0;
  const newRow = () => { rows.push([]); rowWidth = 0; };
  for (const token of tokens) {
    const tokenWidth = token.reduce((sum, glyph) => sum + glyph.width, 0);
    if (rowWidth > 0 && tokenWidth <= maxWidth && rowWidth + tokenWidth > maxWidth) newRow();
    for (const glyph of token) {
      if (glyph.text === "\n") { newRow(); continue; }
      if (rowWidth > 0 && rowWidth + glyph.width > maxWidth) newRow();
      glyph.x = rowWidth;
      rows[rows.length - 1].push(glyph);
      rowWidth += glyph.width;
    }
  }

  const runs: EffectGlyph[] = [];
  let width = 0;
  rows.forEach((row, rowIndex) => {
    const rowWidth = row.reduce((sum, glyph) => sum + glyph.width, 0);
    width = Math.max(width, rowWidth);
    const offsetX = options.centered ? Math.max(0, (maxWidth - rowWidth) / 2) : 0;
    let run: EffectGlyph | undefined;
    let wordIndex = -1;
    row.forEach((glyph) => {
      glyph.x += offsetX;
      glyph.y = rowIndex * lineHeight + options.fontSize * 1.1;
      if (run && wordIndex === glyph.wordIndex) {
        run.text += glyph.text;
        run.width += glyph.width;
        run.endTimeMs = glyph.endTimeMs;
      } else {
        run = { ...glyph };
        wordIndex = glyph.wordIndex;
        runs.push(run);
      }
    });
  });
  return { glyphs: rows.flat(), runs, totalWidth: logicalX, width, height: Math.max(1, rows.length) * lineHeight };
}
