/**
 *
 * @param url 链接
 * @param filename 文件名
 * @param onProgress 进度回调
 * @param onDone 成功回调
 */
export async function downloadWithProgress(
  url: string,
  filename: string,
  onProgress?: (percentage: number) => void,
  onDone?: () => void,
  oError?: (error: Error) => void
) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = response.headers.get("Content-Length");
    const totalBytes = contentLength ? parseInt(contentLength) : 0;

    const reader = response.body?.getReader();
    if (!reader) throw new Error("无法获取响应体");

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        onDone?.();
        break;
      }

      chunks.push(value);
      receivedBytes += value.length;

      // 计算进度百分比
      const progress =
        totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;

      // 回调进度
      onProgress?.(progress);
    }

    // 合并所有chunk
    // @ts-ignore
    const blob = new Blob(chunks);
    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    
  } catch (error) {
    oError?.(error as Error);
  }
}
