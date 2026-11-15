export type BatchItemOutcome = "succeeded" | "skipped";
export type BatchResult = {
  total: number; attempted: number; succeeded: number; skipped: number; failed: number; unexecuted: number;
  errors: { key: string; name: string; message: string }[];
};

/** 按冻结快照执行，取消只停止后续项；已提交动作保留，结果始终覆盖全部输入。 */
export async function runBatchAction<T extends { source: string; id: string; name: string }>(
  snapshot: readonly T[],
  action: (song: T) => Promise<BatchItemOutcome>,
  options: { signal?: AbortSignal; onProgress?: (result: Readonly<BatchResult>) => void } = {},
): Promise<BatchResult> {
  const result: BatchResult = { total: snapshot.length, attempted: 0, succeeded: 0, skipped: 0, failed: 0, unexecuted: snapshot.length, errors: [] };
  for (const song of snapshot) {
    if (options.signal?.aborted) break;
    result.attempted++;
    result.unexecuted--;
    try { result[await action(song)]++; }
    catch (error) {
      result.failed++;
      result.errors.push({ key: `${song.source}:${song.id}`, name: song.name,
        message: error instanceof Error ? error.message : String(error) });
    }
    options.onProgress?.({ ...result, errors: [...result.errors] });
  }
  return result;
}
