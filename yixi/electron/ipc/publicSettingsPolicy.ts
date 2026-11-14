/** main 私有身份、凭证和同步游标不可通过通用设置 API 访问。用户设置继续兼容。 */
export function assertPublicSetting(key: unknown): asserts key is string {
  if (typeof key !== "string" || !key || key.length > 200) throw new Error("无效设置键");
  const normalized = key.toLowerCase();
  if (/^(?:account(?:[-_:]|$)|sync(?:[-_:]|$)|main(?:[-_:]|$)|private(?:[-_:]|$)|desktop-device(?:[-_:]|$)|device(?:[-_:]|$)|cookie(?:[-_:]|$)|service[-_:]discovery|desktop-service-discovery|auth(?:[-_:]|$)|credential(?:[-_:]|$)|token(?:[-_:]|$)|secret(?:[-_:]|$))/.test(normalized)) throw new Error("此设置由主进程管理");
}
