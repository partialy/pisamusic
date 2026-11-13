// 仅构造内存音频标签样本，不连接业务库或七牛。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { parseBuffer } from "music-metadata";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/utils/cloudMusicLyrics.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('"music-metadata"', JSON.stringify(pathToFileURL(require.resolve("music-metadata")).href));
const { extractEmbeddedLyrics, detectLyricsFormat, buildLyricsFileFromDraft } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function uint32(value, little = false) {
  const bytes = Buffer.alloc(4);
  if (little) bytes.writeUInt32LE(value); else bytes.writeUInt32BE(value);
  return bytes;
}
function flac(lyrics) {
  const streamInfo = Buffer.alloc(34);
  streamInfo.writeUInt16BE(4096, 0);
  streamInfo.writeUInt16BE(4096, 2);
  streamInfo.writeBigUInt64BE((44100n << 44n) | (1n << 41n) | (15n << 36n) | 44100n, 10);
  const comment = Buffer.from(`LYRICS=${lyrics}`);
  const comments = Buffer.concat([uint32(0, true), uint32(1, true), uint32(comment.length, true), comment]);
  const header = Buffer.alloc(4);
  header[0] = 0x84;
  header.writeUIntBE(comments.length, 1, 3);
  return Buffer.concat([Buffer.from("fLaC"), Buffer.from([0, 0, 0, 34]), streamInfo, header, comments]);
}
function id3Sylt(unit) {
  const body = Buffer.concat([Buffer.from([3]), Buffer.from("eng"), Buffer.from([unit, 1, 0]),
    Buffer.from("first\0"), uint32(500), Buffer.from("second\0"), uint32(1000), Buffer.from("third\0"), uint32(1500)]);
  const frame = Buffer.concat([Buffer.from("SYLT"), uint32(body.length), Buffer.alloc(2), body]);
  const size = Buffer.from([(frame.length >> 21) & 127, (frame.length >> 14) & 127, (frame.length >> 7) & 127, frame.length & 127]);
  const mpeg = Buffer.alloc(417 * 3);
  for (let n = 0; n < 3; n++) Buffer.from([0xff, 0xfb, 0x90, 0]).copy(mpeg, n * 417);
  return Buffer.concat([Buffer.from([73, 68, 51, 3, 0, 0]), size, frame, mpeg]);
}
const original = "[offset:100]\n[00:00.500][00:01.000]first\n[01:02.345]second\n";
const timed = await parseBuffer(flac("[00:00.500]first\n[01:02.345]second"), "audio/flac");
assert.equal(timed.common.lyrics[0].text.includes("[00:"), false, "确认库的 common.text 已去时间轴");
assert.equal(timed.common.lyrics[0].syncText[0].timestamp, 500);
assert.equal(extractEmbeddedLyrics(await parseBuffer(flac(original), "audio/flac")), original, "保留原始 LRC 的 offset、多标签、尾部换行");
const commonOnly = { ...timed, native: {} };
assert.match(extractEmbeddedLyrics(commonOnly), /^\[00:00\.500\]/, "缺少 native 时优先结构化毫秒时间轴");
const sylt = await parseBuffer(id3Sylt(2), "audio/mpeg");
assert.equal(extractEmbeddedLyrics(sylt), "[00:00.500]first\n[00:01.000]second\n[00:01.500]third");
const frameUnits = await parseBuffer(id3Sylt(1), "audio/mpeg");
assert.equal(extractEmbeddedLyrics(frameUnits), "first\nsecond\nthird", "MPEG 帧编号不得伪装成毫秒");
const plain = await parseBuffer(flac("plain first\nplain second"), "audio/flac");
assert.equal(extractEmbeddedLyrics(plain), "plain first\nplain second");
assert.equal(detectLyricsFormat(extractEmbeddedLyrics(plain)), "txt");
for (const [text, declaredFormat, expected] of [[original, "txt", "lrc"], ["plain lyrics", "lrc", "txt"]]) {
  const file = buildLyricsFileFromDraft({ lyricsText: text, lyricsFormat: declaredFormat, title: "sample", lyricsFileName: "sample.txt" });
  assert.equal(file.name, `sample.${expected}`);
  assert.equal(file.type, "text/plain;charset=utf-8");
  assert.equal(await file.text(), text.trim());
}
console.log("PASS: actual FLAC/LRC + SYLT milliseconds/frame units + plain text + upload File extension/MIME/content");
