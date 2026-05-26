type MessageHandle = {
  destroy?: () => void;
};

const activeWarnings: MessageHandle[] = [];
const MAX_WARNING_COUNT = 2;

export function showLimitedWarning(content: string) {
  const handle = window.$message?.warning(content) as MessageHandle | undefined;
  if (!handle) return;

  activeWarnings.push(handle);
  while (activeWarnings.length > MAX_WARNING_COUNT) {
    const oldest = activeWarnings.shift();
    oldest?.destroy?.();
  }
}
