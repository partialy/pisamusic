import type { ReactNode } from "react";
import { Space } from "antd";

type ModalTitleProps = {
  icon?: ReactNode;
  title: ReactNode;
  idText?: string;
  extra?: ReactNode;
};

/** 统一后台弹窗标题排版：图标 + 粗体标题 + 可选标签/ID */
export function ModalTitle({ icon, title, idText, extra }: ModalTitleProps) {
  return (
    <Space align="center" size={8} wrap>
      {icon && <span className="inline-flex items-center text-base leading-none">{icon}</span>}
      <span className="text-base font-bold text-slate-800">{title}</span>
      {extra}
      {idText && <span className="text-xs font-mono font-normal text-slate-400">({idText})</span>}
    </Space>
  );
}
