
/**
 * 检测应用是否在Electron环境中运行
 */
export const isElectron = (): boolean => {
  // 检查window对象是否存在electronAPI
  return typeof window !== "undefined" && !!(window as any).electronAPI;
};

/**
 * 获取Electron API
 * 如果不在Electron环境中，返回模拟的API
 */
export const getElectronAPI = () => {
  if (isElectron()) {
    return (window as any).electronAPI as ElectronIpc;
  }

  // 返回模拟的API，用于非Electron环境
  return {} as ElectronIpc;
};
const electronAPI = getElectronAPI();
export { electronAPI };
export default electronAPI;
