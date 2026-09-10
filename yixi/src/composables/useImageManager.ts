import { computed, ref } from "vue";
import electronAPI from "@/utils/electron";
import { PRESET_BACKGROUND_IMAGES } from "@/store/theme";

export interface ImageItem {
  id: string;
  name: string;
  url: string;
  createdAt: number;
  isPreset?: boolean;
}

const STORAGE_KEY = "custom-background-images";

// 全局单例状态，确保所有组件状态同步
const customImages = ref<ImageItem[]>([]);
const initialized = ref(false);
const loading = ref(false);

export function useImageManager() {
  async function loadImages() {
    if (initialized.value) return;
    loading.value = true;
    try {
      const record = await electronAPI.getSetting<ImageItem[]>(STORAGE_KEY);
      if (record && Array.isArray(record.value)) {
        customImages.value = record.value.map((item) => ({
          ...item,
          isPreset: false,
        }));
      }
    } catch (error) {
      console.warn("Failed to load custom background images:", error);
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  const presetImages = computed<ImageItem[]>(() =>
    PRESET_BACKGROUND_IMAGES.map((preset, index) => ({
      id: preset.id,
      name: preset.name || `预置图片 ${index + 1}`,
      url: preset.url,
      createdAt: 0,
      isPreset: true,
    }))
  );

  // 所有图片：自定义图片排在前（按时间倒序），预置图片排在后
  const allImages = computed<ImageItem[]>(() => {
    const sortedCustom = [...customImages.value].sort(
      (a, b) => b.createdAt - a.createdAt
    );
    return [...sortedCustom, ...presetImages.value];
  });

  // 最新的 3 张图片
  const latestThreeImages = computed<ImageItem[]>(() =>
    allImages.value.slice(0, 3)
  );

  async function persist() {
    try {
      await electronAPI.setSetting(
        STORAGE_KEY,
        customImages.value.map((item) => ({
          id: item.id,
          name: item.name,
          url: item.url,
          createdAt: item.createdAt,
        })),
        1
      );
    } catch (error) {
      console.warn("Failed to save custom background images:", error);
    }
  }

  async function addImage(url: string, name?: string): Promise<ImageItem | null> {
    if (!url) return null;
    await loadImages();

    // 检查是否已有相同 url 的图片
    const existingIndex = customImages.value.findIndex((img) => img.url === url);
    if (existingIndex !== -1) {
      const existing = customImages.value[existingIndex];
      existing.createdAt = Date.now();
      if (name) existing.name = name;
      // 移动到最前
      customImages.value.splice(existingIndex, 1);
      customImages.value.unshift(existing);
      await persist();
      return existing;
    }

    const newItem: ImageItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name || `自定义图片 ${customImages.value.length + 1}`,
      url,
      createdAt: Date.now(),
      isPreset: false,
    };

    customImages.value.unshift(newItem);
    await persist();
    return newItem;
  }

  async function addImages(
    items: Array<{ url: string; name?: string }>
  ): Promise<ImageItem[]> {
    if (!items.length) return [];
    await loadImages();

    const addedList: ImageItem[] = [];

    for (const item of items) {
      if (!item.url) continue;
      const existingIndex = customImages.value.findIndex((img) => img.url === item.url);
      if (existingIndex !== -1) {
        const existing = customImages.value[existingIndex];
        existing.createdAt = Date.now();
        if (item.name) existing.name = item.name;
        customImages.value.splice(existingIndex, 1);
        customImages.value.unshift(existing);
        addedList.push(existing);
      } else {
        const newItem: ImageItem = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: item.name || `自定义图片 ${customImages.value.length + 1}`,
          url: item.url,
          createdAt: Date.now(),
          isPreset: false,
        };
        customImages.value.unshift(newItem);
        addedList.push(newItem);
      }
    }

    if (addedList.length > 0) {
      await persist();
    }
    return addedList;
  }

  async function removeImages(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    await loadImages();

    const idSet = new Set(ids);
    const toRemove = customImages.value.filter(
      (img) => idSet.has(img.id) && !img.isPreset
    );
    if (!toRemove.length) return 0;

    // 尝试清理本地物理文件
    for (const item of toRemove) {
      if (item.url.startsWith("file://") && electronAPI.deleteBackgroundImage) {
        try {
          await electronAPI.deleteBackgroundImage(item.url);
        } catch {
          // ignore
        }
      }
    }

    customImages.value = customImages.value.filter((img) => !idSet.has(img.id));
    await persist();
    return toRemove.length;
  }

  return {
    customImages,
    allImages,
    latestThreeImages,
    loading,
    initialized,
    loadImages,
    addImage,
    addImages,
    removeImages,
  };
}
