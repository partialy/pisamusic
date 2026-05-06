/**
 * 使用 requestAnimationFrame 分块加载数据到目标数组
 * @param sourceArray 源数据数组
 * @param onChunkLoaded 每次加载分块时的回调函数
 * @param options 配置选项
 * @returns Promise<void>
 */
export async function chunkLoadWithRAF<T>(
  sourceArray: T[],
  onChunkLoaded: (chunk: T[], progress: number) => void,
  options: {
    chunkSize?: number;
    onStart?: () => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
  } = {}
): Promise<void> {
  return new Promise((resolve) => {
    const {
      chunkSize = 30,
      onStart,
      onComplete,
      onError
    } = options;

    try {
      // 开始加载回调
      if (onStart) onStart();

      // 如果列表为空或很小，直接返回
      if (!sourceArray || sourceArray.length === 0) {
        if (onComplete) onComplete();
        resolve();
        return;
      }

      // 如果不需要分块，直接加载全部
      if (sourceArray.length <= chunkSize) {
        onChunkLoaded([...sourceArray], 1);
        if (onComplete) onComplete();
        resolve();
        return;
      }

      let loadedCount = 0;
      const totalItems = sourceArray.length;

      /**
       * 递归加载块的函数
       */
      function loadChunk(): void {
        try {
          // 检查是否已经加载完毕
          if (loadedCount >= totalItems) {
            if (onComplete) onComplete();
            resolve();
            return;
          }

          // 在当前动画帧中处理一块数据
          const remaining = totalItems - loadedCount;
          const currentChunkSize = Math.min(chunkSize, remaining);
          const nextChunk = sourceArray.slice(loadedCount, loadedCount + currentChunkSize);
          
          // 计算进度 (0-1)
          const progress = (loadedCount + currentChunkSize) / totalItems;
          
          // 调用回调
          onChunkLoaded(nextChunk, progress);
          loadedCount += currentChunkSize;

          // 如果还有更多数据，请求下一个动画帧
          if (loadedCount < totalItems) {
            requestAnimationFrame(loadChunk);
          } else {
            if (onComplete) onComplete();
            resolve();
          }
        } catch (error) {
          if (onError) onError(error as Error);
          resolve();
        }
      }

      // 开始第一次加载
      requestAnimationFrame(loadChunk);
    } catch (error) {
      if (onError) onError(error as Error);
      resolve();
    }
  });
}