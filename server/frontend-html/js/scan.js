/**
 * PisaMusic 扫码与音乐分享页面脚本
 */
(function () {
  "use strict";

  const JOIN_TYPE = "listen-together-join";
  const SHARE_TYPE = "music-share";
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type") || "";
  const roomId = params.get("roomId") || "";
  const uuid = params.get("uuid") || "";
  const validRoom = type === JOIN_TYPE && /^\d{4,8}$/.test(roomId);
  const validShare = type === SHARE_TYPE && /^[0-9a-f-]{32,40}$/i.test(uuid);

  const listenView = document.getElementById("listenView");
  const shareView = document.getElementById("shareView");
  const title = document.getElementById("title");
  const status = document.getElementById("status");
  const room = document.getElementById("room");
  const guide = document.getElementById("guide");
  const openButton = document.getElementById("openButton");
  const copyButton = document.getElementById("copyButton");
  const copyStatus = document.getElementById("copyStatus");
  const downloadLink = document.getElementById("downloadLink");

  const shareLoading = document.getElementById("shareLoading");
  const shareError = document.getElementById("shareError");
  const shareErrorTitle = document.getElementById("shareErrorTitle");
  const shareErrorText = document.getElementById("shareErrorText");
  const shareContent = document.getElementById("shareContent");
  const shareCover = document.getElementById("shareCover");
  const shareCoverFallback = document.getElementById("shareCoverFallback");
  const shareTitle = document.getElementById("shareTitle");
  const shareSubtitle = document.getElementById("shareSubtitle");
  const shareInfo = document.getElementById("shareInfo");
  const shareOpenButton = document.getElementById("shareOpenButton");
  const shareCopyButton = document.getElementById("shareCopyButton");
  const shareCopyStatus = document.getElementById("shareCopyStatus");
  const shareDownloadLink = document.getElementById("shareDownloadLink");

  let leftPage = false;
  let fallbackTimer = 0;

  const appScheme = validRoom
    ? `pisamusic://scan?type=${encodeURIComponent(type)}&roomId=${encodeURIComponent(roomId)}`
    : "";
  const shareUrl = validShare
    ? `${window.location.origin}/scan/?type=${encodeURIComponent(SHARE_TYPE)}&uuid=${encodeURIComponent(uuid)}`
    : "";
  const shareAppScheme = validShare
    ? `pisamusic://scan?type=${encodeURIComponent(SHARE_TYPE)}&uuid=${encodeURIComponent(uuid)}`
    : "";

  function getDeviceType() {
    const userAgent = navigator.userAgent || "";
    if (/Android/i.test(userAgent)) return "android";
    if (/Windows NT/i.test(userAgent)) return "windows";
    return "other";
  }

  function getFailureMessage(target) {
    const deviceType = getDeviceType();
    const action = target === "share" ? "查看分享" : "继续加入";
    if (deviceType === "android") {
      return `手机端未检测到 Pisa Music。请先前往官网下载 Android 版，安装后返回本页${action}。`;
    }
    if (deviceType === "windows") {
      return `桌面端未检测到 Pisa Music。请先前往官网下载 PC 版，安装后返回本页${action}。`;
    }
    return `当前设备未检测到 Pisa Music。请前往官网选择适用版本，安装后返回本页${action}。`;
  }

  function markPageLeft() {
    leftPage = true;
    window.clearTimeout(fallbackTimer);
  }

  function openApp() {
    if (!validRoom) return;
    leftPage = false;
    title.innerText = "正在打开 Pisa Music...";
    status.innerText = "如果没有自动打开，请点击下方按钮。";
    window.location.href = appScheme;
    window.clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(() => {
      if (leftPage || document.hidden) return;
      title.innerText = "未检测到 Pisa Music";
      status.innerText = getFailureMessage("room");
      openButton.innerText = "重新打开 App";
    }, 1500);
  }

  function openShareInApp() {
    if (!validShare) return;
    leftPage = false;
    window.location.href = shareAppScheme;
    window.clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(() => {
      if (leftPage || document.hidden) return;
      shareCopyStatus.innerText = getFailureMessage("share");
      shareOpenButton.innerText = "重新打开 App";
    }, 1500);
  }

  function copyWithFallback(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied;
  }

  async function copyText(text) {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) copied = copyWithFallback(text);
    if (!copied) throw new Error("copy unavailable");
  }

  async function copyRoomId() {
    if (!validRoom) return;
    try {
      await copyText(roomId);
      copyButton.innerText = "已复制房间号";
      copyStatus.innerText = "安装后返回此页面，重新打开 App 即可继续加入。";
    } catch {
      copyStatus.innerText = `复制失败，请手动记录房间号 ${roomId}。`;
    }
  }

  async function copyShareLink() {
    if (!validShare) return;
    try {
      await copyText(shareUrl);
      shareCopyButton.innerText = "已复制链接";
      shareCopyStatus.innerText = "完整分享链接已复制。";
    } catch {
      shareCopyStatus.innerText = "复制失败，请手动复制浏览器地址栏链接。";
    }
  }

  function formatDuration(value) {
    const duration = Number(value) || 0;
    if (duration <= 0) return "";
    const seconds = duration > 10000 ? Math.round(duration / 1000) : Math.round(duration);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function normalizeShareCoverUrl(source, coverUrl) {
    const cover = String(coverUrl || "").trim();
    if (!cover) return "";
    if (String(source || "").toLowerCase() === "kg") return cover.replace(/\{size\}/g, "240");
    return cover;
  }

  function formatAccessCount(value) {
    const count = Number(value);
    if (!Number.isFinite(count) || count < 0) return "";
    return String(Math.floor(count));
  }

  function row(label, value) {
    const text = value == null ? "" : String(value).trim();
    if (!text) return "";
    return `<div class="info-row"><span>${label}</span><span>${text}</span></div>`;
  }

  function showShareError(titleText, bodyText) {
    shareLoading.classList.add("hidden");
    shareContent.classList.add("hidden");
    shareError.classList.remove("hidden");
    shareErrorTitle.innerText = titleText;
    shareErrorText.innerText = bodyText;
  }

  function renderShare(share) {
    const raw = share.rawJson || {};
    const subtitle = raw.singer || share.description || "";
    const coverUrl = normalizeShareCoverUrl(share.source, share.coverUrl);
    shareTitle.innerText = share.title || "未命名分享";
    shareSubtitle.innerText = subtitle;
    if (coverUrl) {
      shareCover.src = coverUrl;
      shareCover.classList.remove("hidden");
      shareCoverFallback.classList.add("hidden");
    } else {
      shareCover.classList.add("hidden");
      shareCoverFallback.classList.remove("hidden");
    }
    shareCover.onerror = () => {
      shareCover.classList.add("hidden");
      shareCoverFallback.classList.remove("hidden");
    };
    if (share.type === "song") {
      shareInfo.innerHTML = [
        row("歌名", raw.name || share.title),
        row("歌手", raw.singer || share.description),
        row("专辑", raw.album),
        row("时长", formatDuration(raw.duration)),
        row("访问次数", formatAccessCount(share.accessCount)),
      ].join("");
    } else {
      shareInfo.innerHTML = [
        row("描述", share.description),
        row("歌曲数", raw.song_count || raw.songCount),
        row("分享人", share.sharer && share.sharer.username),
        row("访问次数", formatAccessCount(share.accessCount)),
      ].join("");
    }
    const downloadParams = new URLSearchParams({ type: SHARE_TYPE, uuid });
    shareDownloadLink.href = `/download/?${downloadParams.toString()}`;
    shareLoading.classList.add("hidden");
    shareError.classList.add("hidden");
    shareContent.classList.remove("hidden");
  }

  async function loadShare() {
    if (!validShare) {
      showShareError("分享链接无效", "该链接缺少有效的分享标识。");
      return;
    }
    try {
      const response = await fetch(`/api/shares/public/${encodeURIComponent(uuid)}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !payload.success || !payload.data) {
        showShareError("分享不存在或已失效", payload && payload.msg ? payload.msg : "请让分享人重新发送链接。");
        return;
      }
      renderShare(payload.data);
    } catch {
      showShareError("网络连接失败", "暂时无法读取分享信息，请稍后重试。");
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) markPageLeft();
  });
  window.addEventListener("pagehide", markPageLeft);
  if (openButton) openButton.addEventListener("click", openApp);
  if (copyButton) copyButton.addEventListener("click", copyRoomId);
  if (shareOpenButton) shareOpenButton.addEventListener("click", openShareInApp);
  if (shareCopyButton) shareCopyButton.addEventListener("click", copyShareLink);

  if (type === SHARE_TYPE) {
    if (listenView) listenView.classList.add("hidden");
    if (shareView) shareView.classList.remove("hidden");
    loadShare();
  } else if (validRoom) {
    if (room) room.innerText = `一起听房间 · 房间号 ${roomId}`;
    const downloadParams = new URLSearchParams({ type, roomId });
    if (downloadLink) downloadLink.href = `/download/?${downloadParams.toString()}`;
    window.setTimeout(openApp, 120);
  } else {
    if (title) title.innerText = "链接无效";
    if (status) status.innerText = "该邀请链接缺少有效的房间信息。";
    if (room) room.innerText = "无法读取房间号";
    if (guide) guide.innerText = "请让房主重新发送完整的一起听邀请链接。";
    if (openButton) openButton.disabled = true;
    if (copyButton) copyButton.disabled = true;
  }
})();
