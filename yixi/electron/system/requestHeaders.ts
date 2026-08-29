export function mergeRequestHeaders(
  baseHeaders: Record<string, string> = {},
  overrideHeaders: Record<string, string> = {},
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const source of [baseHeaders, overrideHeaders]) {
    for (const [name, value] of Object.entries(source)) {
      merged[name.toLowerCase()] = value;
    }
  }
  return merged;
}
