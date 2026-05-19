import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { writeCoverImageToFile, writeTags } from "@yortyrh/tagpilot-lib";

export type AudioMetadata = {
  title: string;
  artist: string;
  album: string;
  source: string;
  songId: string;
  qualityKey: string;
  lyrics: string;
  cover: {
    data: Buffer;
    mimeType: string;
  } | null;
};

export type AudioMetadataWriteOptions = {
  embedCover: boolean;
  embedLyrics: boolean;
};

export type AudioMetadataWriteResult = {
  ok: boolean;
  warnings: string[];
};

const CUSTOM_FIELDS = ["PISAMUSIC_SOURCE", "PISAMUSIC_SONG_ID", "PISAMUSIC_QUALITY_KEY"];

export async function writeAudioMetadata(
  filePath: string,
  metadata: AudioMetadata,
  options: AudioMetadataWriteOptions
): Promise<AudioMetadataWriteResult> {
  const warnings: string[] = [];
  await writeBaseTags(filePath, metadata, options);

  if (options.embedLyrics || metadata.source || metadata.songId || metadata.qualityKey) {
    const customResult = await writeFormatSpecificMetadata(filePath, metadata, options);
    warnings.push(...customResult.warnings);
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
}

async function writeBaseTags(
  filePath: string,
  metadata: AudioMetadata,
  options: AudioMetadataWriteOptions
) {
  await writeTags(filePath, {
    title: metadata.title,
    artists: metadata.artist ? [metadata.artist] : [],
    album: metadata.album,
    comment: metadataComment(metadata),
    image: options.embedCover && metadata.cover
      ? {
          data: metadata.cover.data,
          mimeType: metadata.cover.mimeType,
          picType: "CoverFront" as any,
          description: "Cover",
        }
      : undefined,
  });
  if (options.embedCover && metadata.cover) {
    await writeCoverImageToFile(filePath, metadata.cover.data);
  }
}

async function writeFormatSpecificMetadata(
  filePath: string,
  metadata: AudioMetadata,
  options: AudioMetadataWriteOptions
): Promise<AudioMetadataWriteResult> {
  const extension = path.extname(filePath).toLowerCase();
  try {
    if (extension === ".mp3") {
      await writeMp3CustomMetadata(filePath, metadata, options);
      return { ok: true, warnings: [] };
    }
    if (extension === ".flac") {
      await writeFlacCustomMetadata(filePath, metadata, options);
      return { ok: true, warnings: [] };
    }
    if (extension === ".m4a" || extension === ".aac" || extension === ".mp4") {
      await writeM4aCustomMetadata(filePath, metadata, options);
      return { ok: true, warnings: [] };
    }
    return {
      ok: false,
      warnings: [`${extension || "未知格式"} 暂不支持歌词和自定义字段写入`],
    };
  } catch (error) {
    return {
      ok: false,
      warnings: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function metadataComment(metadata: AudioMetadata) {
  return `source=${metadata.source}; songId=${metadata.songId}; quality=${metadata.qualityKey}`;
}

async function writeMp3CustomMetadata(
  filePath: string,
  metadata: AudioMetadata,
  options: AudioMetadataWriteOptions
) {
  const buffer = await readFile(filePath);
  const parsed = parseId3Tag(buffer);
  const frames = parsed.frames.filter((frame) => !shouldReplaceId3Frame(frame));
  frames.push(createTxxxFrame("PISAMUSIC_SOURCE", metadata.source));
  frames.push(createTxxxFrame("PISAMUSIC_SONG_ID", metadata.songId));
  frames.push(createTxxxFrame("PISAMUSIC_QUALITY_KEY", metadata.qualityKey));
  if (options.embedLyrics && metadata.lyrics) {
    frames.push(createUsltFrame(metadata.lyrics));
  }
  const tag = buildId3v23Tag(frames);
  await writeFile(filePath, Buffer.concat([tag, parsed.audio]));
}

type Id3Frame = {
  id: string;
  data: Buffer;
};

function parseId3Tag(buffer: Buffer) {
  if (buffer.subarray(0, 3).toString("latin1") !== "ID3") {
    return { frames: [] as Id3Frame[], audio: buffer };
  }
  const major = buffer[3];
  const tagSize = decodeSynchsafe(buffer.subarray(6, 10));
  const tagEnd = 10 + tagSize;
  const frameBuffer = buffer.subarray(10, Math.min(tagEnd, buffer.length));
  const frames: Id3Frame[] = [];
  let offset = 0;
  while (offset + 10 <= frameBuffer.length) {
    const id = frameBuffer.subarray(offset, offset + 4).toString("latin1");
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = major === 4
      ? decodeSynchsafe(frameBuffer.subarray(offset + 4, offset + 8))
      : frameBuffer.readUInt32BE(offset + 4);
    if (size <= 0 || offset + 10 + size > frameBuffer.length) break;
    frames.push({
      id,
      data: frameBuffer.subarray(offset + 10, offset + 10 + size),
    });
    offset += 10 + size;
  }
  return { frames, audio: buffer.subarray(tagEnd) };
}

function shouldReplaceId3Frame(frame: Id3Frame) {
  if (frame.id === "USLT") return true;
  if (frame.id !== "TXXX") return false;
  const text = decodeId3Text(frame.data.subarray(1));
  return CUSTOM_FIELDS.some((field) => text.startsWith(field));
}

function createTxxxFrame(description: string, value: string): Id3Frame {
  return {
    id: "TXXX",
    data: Buffer.concat([
      Buffer.from([1, 0xff, 0xfe]),
      Buffer.from(description, "utf16le"),
      Buffer.from([0, 0]),
      Buffer.from(value, "utf16le"),
    ]),
  };
}

function createUsltFrame(lyrics: string): Id3Frame {
  return {
    id: "USLT",
    data: Buffer.concat([
      Buffer.from([1]),
      Buffer.from("chi", "latin1"),
      Buffer.from([0xff, 0xfe, 0, 0]),
      Buffer.from(lyrics, "utf16le"),
    ]),
  };
}

function buildId3v23Tag(frames: Id3Frame[]) {
  const body = Buffer.concat(frames.map((frame) => {
    const header = Buffer.alloc(10);
    header.write(frame.id, 0, 4, "latin1");
    header.writeUInt32BE(frame.data.length, 4);
    header.writeUInt16BE(0, 8);
    return Buffer.concat([header, frame.data]);
  }));
  const header = Buffer.alloc(10);
  header.write("ID3", 0, 3, "latin1");
  header[3] = 3;
  header[4] = 0;
  header[5] = 0;
  encodeSynchsafe(body.length).copy(header, 6);
  return Buffer.concat([header, body]);
}

function decodeId3Text(buffer: Buffer) {
  if (!buffer.length) return "";
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  return buffer.toString("utf8");
}

function decodeSynchsafe(buffer: Buffer) {
  return ((buffer[0] & 0x7f) << 21) | ((buffer[1] & 0x7f) << 14) | ((buffer[2] & 0x7f) << 7) | (buffer[3] & 0x7f);
}

function encodeSynchsafe(value: number) {
  return Buffer.from([
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ]);
}

async function writeFlacCustomMetadata(
  filePath: string,
  metadata: AudioMetadata,
  options: AudioMetadataWriteOptions
) {
  const buffer = await readFile(filePath);
  if (buffer.subarray(0, 4).toString("latin1") !== "fLaC") {
    throw new Error("FLAC 文件头无效，跳过自定义元数据写入");
  }
  const { blocks, audioOffset } = parseFlacBlocks(buffer);
  const nextBlocks = upsertVorbisCommentBlock(blocks, metadata, options);
  await writeFile(filePath, Buffer.concat([
    Buffer.from("fLaC", "latin1"),
    ...serializeFlacBlocks(nextBlocks),
    buffer.subarray(audioOffset),
  ]));
}

type FlacBlock = {
  type: number;
  data: Buffer;
};

function parseFlacBlocks(buffer: Buffer) {
  const blocks: FlacBlock[] = [];
  let offset = 4;
  while (offset + 4 <= buffer.length) {
    const header = buffer[offset];
    const length = buffer.readUIntBE(offset + 1, 3);
    blocks.push({
      type: header & 0x7f,
      data: buffer.subarray(offset + 4, offset + 4 + length),
    });
    offset += 4 + length;
    if ((header & 0x80) !== 0) break;
  }
  return { blocks, audioOffset: offset };
}

function upsertVorbisCommentBlock(
  blocks: FlacBlock[],
  metadata: AudioMetadata,
  options: AudioMetadataWriteOptions
) {
  const index = blocks.findIndex((block) => block.type === 4);
  const comments = new Map<string, string>();
  let vendor = "PisaMusic";
  if (index >= 0) {
    const parsed = parseVorbisComment(blocks[index].data);
    vendor = parsed.vendor || vendor;
    parsed.comments.forEach((value, key) => comments.set(key, value));
  }
  comments.set("PISAMUSIC_SOURCE", metadata.source);
  comments.set("PISAMUSIC_SONG_ID", metadata.songId);
  comments.set("PISAMUSIC_QUALITY_KEY", metadata.qualityKey);
  if (options.embedLyrics && metadata.lyrics) {
    comments.set("LYRICS", metadata.lyrics);
  } else {
    comments.delete("LYRICS");
  }
  const block: FlacBlock = {
    type: 4,
    data: buildVorbisComment(vendor, comments),
  };
  if (index >= 0) {
    return blocks.map((item, itemIndex) => itemIndex === index ? block : item);
  }
  const [first, ...rest] = blocks;
  return first ? [first, block, ...rest] : [block];
}

function parseVorbisComment(buffer: Buffer) {
  let offset = 0;
  const vendorLength = buffer.readUInt32LE(offset);
  offset += 4;
  const vendor = buffer.subarray(offset, offset + vendorLength).toString("utf8");
  offset += vendorLength;
  const count = buffer.readUInt32LE(offset);
  offset += 4;
  const comments = new Map<string, string>();
  for (let index = 0; index < count && offset + 4 <= buffer.length; index += 1) {
    const length = buffer.readUInt32LE(offset);
    offset += 4;
    const raw = buffer.subarray(offset, offset + length).toString("utf8");
    offset += length;
    const separator = raw.indexOf("=");
    if (separator > 0) {
      comments.set(raw.slice(0, separator).toUpperCase(), raw.slice(separator + 1));
    }
  }
  return { vendor, comments };
}

function buildVorbisComment(vendor: string, comments: Map<string, string>) {
  const vendorBuffer = Buffer.from(vendor, "utf8");
  const entries = [...comments.entries()].map(([key, value]) => Buffer.from(`${key}=${value}`, "utf8"));
  const header = Buffer.alloc(8);
  header.writeUInt32LE(vendorBuffer.length, 0);
  header.writeUInt32LE(entries.length, 4);
  return Buffer.concat([
    header.subarray(0, 4),
    vendorBuffer,
    header.subarray(4),
    ...entries.flatMap((entry) => {
      const length = Buffer.alloc(4);
      length.writeUInt32LE(entry.length, 0);
      return [length, entry];
    }),
  ]);
}

function serializeFlacBlocks(blocks: FlacBlock[]) {
  return blocks.map((block, index) => {
    const header = Buffer.alloc(4);
    header[0] = block.type | (index === blocks.length - 1 ? 0x80 : 0);
    header.writeUIntBE(block.data.length, 1, 3);
    return Buffer.concat([header, block.data]);
  });
}

async function writeM4aCustomMetadata(
  filePath: string,
  metadata: AudioMetadata,
  options: AudioMetadataWriteOptions
) {
  const buffer = await readFile(filePath);
  const atoms = parseMp4Atoms(buffer, 0, buffer.length);
  const moovIndex = atoms.findIndex((atom) => atom.type === "moov");
  if (moovIndex < 0) throw new Error("M4A 文件缺少 moov atom，跳过自定义元数据写入");

  const nextTopLevel = atoms.map((atom, index) => {
    if (index !== moovIndex) return atom.raw;
    const nextContent = upsertMoovMetadata(atom.content, metadata, options);
    const nextAtom = rebuildMp4Atom(atom, nextContent);
    const sizeDelta = nextAtom.length - atom.raw.length;
    return sizeDelta === 0
      ? nextAtom
      : rebuildMp4Atom(atom, adjustMp4ChunkOffsets(nextContent, sizeDelta, atom.start));
  });
  await writeFile(filePath, Buffer.concat(nextTopLevel));
}

type Mp4Atom = {
  type: string;
  start: number;
  raw: Buffer;
  content: Buffer;
};

function upsertMoovMetadata(
  moovContent: Buffer,
  metadata: AudioMetadata,
  options: AudioMetadataWriteOptions
) {
  return upsertChildAtom(moovContent, "udta", (udtaContent) =>
    upsertChildAtom(udtaContent, "meta", (metaContent) => {
      const fullHeader = metaContent.length >= 4 ? metaContent.subarray(0, 4) : Buffer.alloc(4);
      const children = metaContent.length >= 4 ? metaContent.subarray(4) : Buffer.alloc(0);
      return Buffer.concat([
        fullHeader,
        upsertChildAtom(children, "ilst", (ilstContent) => upsertIlstMetadata(ilstContent, metadata, options)),
      ]);
    })
  );
}

function upsertIlstMetadata(
  ilstContent: Buffer,
  metadata: AudioMetadata,
  options: AudioMetadataWriteOptions
) {
  const atoms = parseMp4Atoms(ilstContent, 0, ilstContent.length);
  const filtered = atoms.filter((atom) => !shouldReplaceIlstAtom(atom));
  const additions = [
    createFreeformAtom("PISAMUSIC_SOURCE", metadata.source),
    createFreeformAtom("PISAMUSIC_SONG_ID", metadata.songId),
    createFreeformAtom("PISAMUSIC_QUALITY_KEY", metadata.qualityKey),
  ];
  if (options.embedLyrics && metadata.lyrics) {
    additions.push(createMp4TextAtom("©lyr", metadata.lyrics));
  }
  return Buffer.concat([...filtered.map((atom) => atom.raw), ...additions]);
}

function shouldReplaceIlstAtom(atom: Mp4Atom) {
  if (atom.type === "©lyr") return true;
  if (atom.type !== "----") return false;
  const children = parseMp4Atoms(atom.content, 0, atom.content.length);
  const name = children.find((child) => child.type === "name");
  if (!name) return false;
  const value = readMp4MeanNameText(name.content);
  return CUSTOM_FIELDS.includes(value);
}

function upsertChildAtom(
  content: Buffer,
  childType: string,
  update: (childContent: Buffer) => Buffer
) {
  const atoms = parseMp4Atoms(content, 0, content.length);
  const index = atoms.findIndex((atom) => atom.type === childType);
  if (index < 0) {
    return Buffer.concat([...atoms.map((atom) => atom.raw), createMp4Atom(childType, update(Buffer.alloc(0)))]);
  }
  return Buffer.concat(atoms.map((atom, atomIndex) => (
    atomIndex === index ? rebuildMp4Atom(atom, update(atom.content)) : atom.raw
  )));
}

function parseMp4Atoms(buffer: Buffer, start: number, end: number) {
  const atoms: Mp4Atom[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const size32 = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("latin1");
    const headerSize = size32 === 1 ? 16 : 8;
    const size = size32 === 1 ? Number(buffer.readBigUInt64BE(offset + 8)) : size32;
    if (size < headerSize || offset + size > end) break;
    atoms.push({
      type,
      start: offset,
      raw: buffer.subarray(offset, offset + size),
      content: buffer.subarray(offset + headerSize, offset + size),
    });
    offset += size;
  }
  return atoms;
}

function rebuildMp4Atom(atom: Mp4Atom, content: Buffer) {
  return createMp4Atom(atom.type, content);
}

function createMp4Atom(type: string, content: Buffer) {
  const size = content.length + 8;
  if (size > 0xffffffff) throw new Error(`${type} atom 过大，无法写入`);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(size, 0);
  header.write(type, 4, 4, "latin1");
  return Buffer.concat([header, content]);
}

function createMp4TextAtom(type: string, value: string) {
  return createMp4Atom(type, createMp4DataAtom(value));
}

function createFreeformAtom(name: string, value: string) {
  return createMp4Atom("----", Buffer.concat([
    createMp4MeanNameAtom("mean", "com.pisamusic"),
    createMp4MeanNameAtom("name", name),
    createMp4DataAtom(value),
  ]));
}

function createMp4DataAtom(value: string) {
  return createMp4Atom("data", Buffer.concat([
    Buffer.from([0, 0, 0, 1, 0, 0, 0, 0]),
    Buffer.from(value, "utf8"),
  ]));
}

function createMp4MeanNameAtom(type: "mean" | "name", value: string) {
  return createMp4Atom(type, Buffer.concat([
    Buffer.alloc(4),
    Buffer.from(value, "utf8"),
  ]));
}

function readMp4MeanNameText(content: Buffer) {
  if (content.length <= 4) return "";
  return content.subarray(4).toString("utf8");
}

function adjustMp4ChunkOffsets(content: Buffer, delta: number, threshold: number): Buffer {
  const atoms = parseMp4Atoms(content, 0, content.length);
  if (!atoms.length) return content;
  return Buffer.concat(atoms.map((atom) => {
    if (atom.type === "stco") return rebuildMp4Atom(atom, adjustStcoContent(atom.content, delta, threshold));
    if (atom.type === "co64") return rebuildMp4Atom(atom, adjustCo64Content(atom.content, delta, threshold));
    if (isMp4ContainerAtom(atom.type)) {
      const prefixLength = atom.type === "meta" ? 4 : 0;
      const prefix = atom.content.subarray(0, prefixLength);
      const children = atom.content.subarray(prefixLength);
      return rebuildMp4Atom(atom, Buffer.concat([
        prefix,
        adjustMp4ChunkOffsets(children, delta, threshold),
      ]));
    }
    return atom.raw;
  }));
}

function adjustStcoContent(content: Buffer, delta: number, threshold: number) {
  if (content.length < 8) return content;
  const next = Buffer.from(content);
  const count = next.readUInt32BE(4);
  for (let index = 0; index < count; index += 1) {
    const offset = 8 + index * 4;
    if (offset + 4 > next.length) break;
    const value = next.readUInt32BE(offset);
    if (value > threshold) next.writeUInt32BE(value + delta, offset);
  }
  return next;
}

function adjustCo64Content(content: Buffer, delta: number, threshold: number) {
  if (content.length < 8) return content;
  const next = Buffer.from(content);
  const count = next.readUInt32BE(4);
  for (let index = 0; index < count; index += 1) {
    const offset = 8 + index * 8;
    if (offset + 8 > next.length) break;
    const value = next.readBigUInt64BE(offset);
    if (value > BigInt(threshold)) next.writeBigUInt64BE(value + BigInt(delta), offset);
  }
  return next;
}

function isMp4ContainerAtom(type: string) {
  return [
    "moov",
    "trak",
    "mdia",
    "minf",
    "stbl",
    "edts",
    "udta",
    "meta",
    "ilst",
  ].includes(type);
}
