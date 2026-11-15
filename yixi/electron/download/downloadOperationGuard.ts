const operations = new Map<string, { done: Promise<void>; resolve: () => void }>();
let stopping = false;
export function assertDownloadIdle(taskId: string) {
  if (operations.has(taskId)) throw new Error("下载文件正在删除或修复，请稍后重试");
}
export function beginDownloadFileOperation(taskId: string) {
  if (stopping) throw new Error("程序正在退出，暂不受理文件操作");
  assertDownloadIdle(taskId);
  let resolve!: () => void;
  const done = new Promise<void>(finish => { resolve = finish; });
  operations.set(taskId, { done, resolve });
  return () => { const operation = operations.get(taskId); operations.delete(taskId); operation?.resolve(); };
}
export function stopDownloadFileOperations() {
  stopping = true;
  return Promise.all([...operations.values()].map(operation => operation.done));
}
