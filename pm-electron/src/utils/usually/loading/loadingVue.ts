import { isRef, type Ref } from "vue";

/**
 * 使用 requestAnimationFrame 分块加载列表数据到目标列表
 * @param sourceList 源数据列表
 * @param targetList 目标列表（ref或响应式对象）
 * @param chunkSize 每块的大小，默认30
 * @param loadingFlag 可选的加载状态标志（ref或响应式对象）
 */
export async function chunkLoadWithRAF<T>(
    sourceList: T[],
    targetList: Ref<T[]> | T[],
    chunkSize: number = 30,
    loadingFlag?: Ref<boolean>
): Promise<void> {
    return new Promise((resolve) => {
        // 设置加载状态（如果提供了loadingFlag）
        if (loadingFlag) {
            loadingFlag.value = true;
        }

        // 清空目标列表
        if (isRef(targetList)) {
            targetList.value = [];
        } else {
            targetList.length = 0;
        }

        // 如果列表为空或很小，直接返回
        if (!sourceList || sourceList.length === 0) {
            if (loadingFlag) {
                loadingFlag.value = false;
            }
            resolve();
            return;
        }

        // 如果不需要分块，直接加载
        if (sourceList.length <= chunkSize) {
            if (isRef(targetList)) {
                targetList.value = [...sourceList];
            } else {
                targetList.push(...sourceList);
            }
            if (loadingFlag) {
                loadingFlag.value = false;
            }
            resolve();
            return;
        }

        let loadedCount = 0;
        const totalItems = sourceList.length;

        /**
         * 递归加载块的函数
         */
        function loadChunk(): void {
            // 检查是否已经加载完毕
            if (loadedCount >= totalItems) {
                if (loadingFlag) {
                    loadingFlag.value = false;
                }
                resolve();
                return;
            }

            // 在当前动画帧中处理一块数据
            const remaining = totalItems - loadedCount;
            const currentChunkSize = Math.min(chunkSize, remaining);
            const nextChunk = sourceList.slice(loadedCount, loadedCount + currentChunkSize);

            // 添加到目标列表
            if (isRef(targetList)) {
                targetList.value.push(...nextChunk);
            } else {
                targetList.push(...nextChunk);
            }
            loadedCount += currentChunkSize;

            // 如果还有更多数据，请求下一个动画帧
            if (loadedCount < totalItems) {
                requestAnimationFrame(loadChunk);
            } else {
                if (loadingFlag) {
                    loadingFlag.value = false;
                }
                resolve();
            }
        }

        // 开始第一次加载
        requestAnimationFrame(() => {
            loadChunk();
        });
    });
}

