import { ShieldAlert } from "lucide-react";

export default function HostBlockedScreen() {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-6 text-center text-foreground h5-safe-top h5-safe-bottom">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-secondary text-accent">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-foreground">请在客户端内访问</h1>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted">
        当前页面仅支持在 PisaMusic Android 或 PC 客户端内置窗口中打开。为了保障账号与服务环境校验，网页端直接预览已被禁用。
      </p>
    </div>
  );
}
