(() => {
  const openedAt = Date.now();
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  const eventId = uuid();
  let visitorId = uuid();
  let sequence = openedAt;
  try {
    const saved = localStorage.getItem("pm_site_visitor_id");
    if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)) visitorId = saved;
    else localStorage.setItem("pm_site_visitor_id", visitorId);
    sequence = Math.max(openedAt, Number(localStorage.getItem("pm_app_share_sequence") || 0) + 1);
    localStorage.setItem("pm_app_share_sequence", String(sequence));
  } catch { /* 存储不可用时以本次临时身份完成当前流程。 */ }
  const params = new URLSearchParams(location.search);
  const code = params.get("code") || "";
  const link = document.getElementById("download");
  const status = document.getElementById("status");
  let validCode = "";
  let settled = false;
  const controller = new AbortController();
  let timeout;
  let redirectTimer;
  function confirmedTouchpoint() {
    try {
      const current = JSON.parse(localStorage.getItem("pm_app_share_confirmed") || "null");
      if (current && /^[A-Za-z0-9]{6}$/.test(current.code) && Number.isSafeInteger(current.sequence)
          && Number.isSafeInteger(current.openedAt) && current.openedAt <= Date.now() + 30000
          && Date.now() - current.openedAt <= 7 * 24 * 60 * 60 * 1000) return current;
    } catch { /* 共享存储不可用时保留当前有效链接。 */ }
    return null;
  }
  function rememberConfirmedTouchpoint() {
    const current = confirmedTouchpoint();
    if (current && (current.sequence > sequence || (current.sequence === sequence && current.openedAt > openedAt))) return;
    try { localStorage.setItem("pm_app_share_confirmed", JSON.stringify({code,sequence,openedAt})); }
    catch { /* Cookie 与当前显式短码仍可独立归因。 */ }
  }
  function destination() {
    const target = new URL("/", location.origin);
    if (validCode) {
      // 仅采用已成功确认的更新触点；无效或尚未验证的新页面不覆盖归因。
      const current = confirmedTouchpoint();
      target.searchParams.set("code", current && current.sequence > sequence ? current.code : validCode);
    } else if (params.has("code")) target.searchParams.set("code", "invalid");
    if (/Android/i.test(navigator.userAgent)) target.searchParams.set("downloadPlatform", "android");
    else if (/Windows NT/i.test(navigator.userAgent)) target.searchParams.set("downloadPlatform", "windows");
    target.hash = "download";
    return target.pathname + target.search + target.hash;
  }
  function finish(message) {
    settled = true; clearTimeout(timeout);
    status.textContent = message; link.href = destination();
    redirectTimer = setTimeout(() => location.replace(destination()), 850);
  }
  link.addEventListener("click", event => {
    event.preventDefault();
    settled = true; controller.abort(); clearTimeout(timeout); clearTimeout(redirectTimer);
    link.href = destination();
    location.replace(link.href);
  });
  async function request(path, init) {
    const response = await fetch(path, {...init, credentials:"same-origin", cache:"no-store", signal:controller.signal});
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error("分享链接暂不可用");
    return body.data;
  }
  async function run() {
    timeout = setTimeout(() => controller.abort(), 6000);
    if (!/^[A-Za-z0-9]{6}$/.test(code) || params.getAll("code").length !== 1) return finish(code ? "链接无效，仍可前往官网下载。" : "欢迎下载 Pisa Music。");
    try {
      const config = await request(`/api/app-share/public/${encodeURIComponent(code)}`);
      if (!config.valid) throw new Error("分享链接已失效");
      validCode = code;
      document.getElementById("title").textContent = config.appName || "Pisa Music";
      if (config.iconUrl) document.getElementById("icon").src = config.iconUrl;
      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          result = await request("/api/app-share/visits", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId,code,visitorId,openedAt,sequence})});
          break;
        } catch (error) { if (attempt || controller.signal.aborted) throw error; }
      }
      if (!(result?.accepted === true || (result?.accepted === false && result.code === code))) throw new Error("访问未记录");
      rememberConfirmedTouchpoint();
      if (!settled) finish("准备完成，正在前往官网下载…");
    } catch {
      if (!settled) { validCode = ""; finish("分享链接暂不可用，仍可前往官网下载。"); }
    }
  }
  if (document.visibilityState === "hidden") {
    document.addEventListener("visibilitychange", () => { if (!document.hidden) void run(); }, {once:true});
  } else void run();
})();
