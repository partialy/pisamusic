import type {
  CloudMusicAssetReserveRequest,
  CloudMusicTrackDto,
  CloudMusicUploadSession,
  CloudMusicUploadSessionRequest,
  CloudMusicUserSubmitInput,
} from "@/types/cloudMusic";

export function uploadToQiniu(
  file: File,
  ticket: { uploadToken: string; uploadUrl: string; key: string },
  onProgress?: (percent: number) => void,
): Promise<{ key?: string; hash?: string }> {
  const formData = new FormData();
  formData.append("token", ticket.uploadToken);
  formData.append("key", ticket.key);
  formData.append("x:name", file.name);
  formData.append("file", file);
  onProgress?.(0);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", ticket.uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const progress = Math.min(99, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      onProgress?.(progress);
    };

    xhr.onload = () => {
      let body: { key?: string; hash?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch {
        body = {};
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(body.error || `七牛上传失败：HTTP ${xhr.status}`));
        return;
      }
      onProgress?.(100);
      resolve(body);
    };

    xhr.onerror = () => reject(new Error("七牛直传网络异常"));
    xhr.onabort = () => reject(new Error("七牛直传已取消"));
    xhr.send(formData);
  });
}

export async function createSubmitSession(files: {
  audio: File;
  cover?: File | null;
  lyrics?: File | null;
}): Promise<CloudMusicUploadSession> {
  const payload: CloudMusicUploadSessionRequest = {
    audio: {
      fileName: files.audio.name,
      fileSize: files.audio.size,
      mimeType: files.audio.type || "audio/mpeg",
    },
    cover: files.cover
      ? {
          fileName: files.cover.name,
          fileSize: files.cover.size,
          mimeType: files.cover.type || "image/jpeg",
        }
      : undefined,
    lyrics: files.lyrics
      ? {
          fileName: files.lyrics.name,
          fileSize: files.lyrics.size,
          mimeType: files.lyrics.type || "text/plain",
        }
      : undefined,
  };

  return window.electronAPI.createCloudMusicSubmitSession(payload);
}

export async function uploadAndExtractSession(
  session: CloudMusicUploadSession,
  files: {
    audio: File;
    cover?: File | null;
    lyrics?: File | null;
  },
  onProgress?: (phase: "audio" | "cover" | "lyrics" | "processing", percent: number) => void,
): Promise<CloudMusicTrackDto> {
  const audioTicket = session.tickets.find((t) => t.kind === "audio");
  if (!audioTicket) throw new Error("缺少音频上传凭证");

  onProgress?.("audio", 0);
  await uploadToQiniu(files.audio, audioTicket, (percent) => {
    onProgress?.("audio", percent);
  });

  const coverTicket = session.tickets.find((t) => t.kind === "cover-uploaded");
  if (coverTicket && files.cover) {
    onProgress?.("cover", 0);
    await uploadToQiniu(files.cover, coverTicket, (percent) => {
      onProgress?.("cover", percent);
    });
    await window.electronAPI.completeCloudMusicSubmitAsset({
      uuid: session.track.uuid,
      kind: "cover-uploaded",
    });
  }

  const lyricsTicket = session.tickets.find((t) => t.kind === "lyrics");
  if (lyricsTicket && files.lyrics) {
    onProgress?.("lyrics", 0);
    await uploadToQiniu(files.lyrics, lyricsTicket, (percent) => {
      onProgress?.("lyrics", percent);
    });
    await window.electronAPI.completeCloudMusicSubmitAsset({
      uuid: session.track.uuid,
      kind: "lyrics",
    });
  }

  onProgress?.("processing", 100);
  const track = await window.electronAPI.completeCloudMusicSubmitAsset({
    uuid: session.track.uuid,
    kind: "audio",
  });

  return track;
}

export async function replaceSubmitCover(
  uuid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudMusicTrackDto> {
  const reserveInput: CloudMusicAssetReserveRequest = {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "image/jpeg",
    kind: "cover-uploaded",
  };

  const ticket = await window.electronAPI.reserveCloudMusicSubmitAsset({
    uuid,
    input: reserveInput,
  });

  await uploadToQiniu(file, ticket, onProgress);

  return window.electronAPI.completeCloudMusicSubmitAsset({
    uuid,
    kind: "cover-uploaded",
  });
}

export async function removeSubmitCover(uuid: string): Promise<CloudMusicTrackDto> {
  return window.electronAPI.removeCloudMusicSubmitCover({ uuid });
}

export async function replaceSubmitLyrics(
  uuid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudMusicTrackDto> {
  const reserveInput: CloudMusicAssetReserveRequest = {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "text/plain",
    kind: "lyrics",
  };

  const ticket = await window.electronAPI.reserveCloudMusicSubmitAsset({
    uuid,
    input: reserveInput,
  });

  await uploadToQiniu(file, ticket, onProgress);

  return window.electronAPI.completeCloudMusicSubmitAsset({
    uuid,
    kind: "lyrics",
  });
}

export async function saveSubmitTrack(
  uuid: string,
  input: CloudMusicUserSubmitInput,
): Promise<CloudMusicTrackDto> {
  return window.electronAPI.saveCloudMusicSubmission({
    uuid,
    input,
  });
}
