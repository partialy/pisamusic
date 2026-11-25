import { Button, Modal, Space, Tag, Typography, message } from "antd";
import { CopyOutlined, LinkOutlined, NotificationOutlined } from "@ant-design/icons";
import type { Announcement, AnnouncementContent } from "../../types/config";
import {
  announcementColorHex,
  announcementPageLabels,
  announcementPlatformLabels,
  describeAnnouncementGoto,
  describeAnnouncementVersion,
} from "../../utils/announcementPresentation";

const { Text } = Typography;

type Props = {
  announcement: Announcement;
  open: boolean;
  onClose: () => void;
};

function blockCount(content: AnnouncementContent): string {
  const images = content.blocks.filter((block) => block.type === "image").length;
  const highlights = content.blocks.filter((block) => block.type === "highlight").length;
  return `${content.blocks.length} 个内容块${images ? ` · ${images} 张图片` : ""}${highlights ? ` · ${highlights} 个高亮` : ""}`;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    message.success("已复制");
  } catch {
    message.error("复制失败，请检查浏览器权限");
  }
}

export default function AnnouncementPreviewModal({ announcement, open, onClose }: Props) {
  const gotoDescription = describeAnnouncementGoto(announcement);
  const waitSeconds = announcement.waitSeconds ?? 0;
  return (
    <Modal
      open={open}
      centered
      width={620}
      title={<Space><NotificationOutlined className="text-indigo-500" /><span>公告预览</span></Space>}
      onCancel={onClose}
      footer={<Button type="primary" onClick={onClose}>关闭预览</Button>}
      destroyOnClose
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500">Announcement</div>
            <div className="mt-1 text-lg font-bold text-slate-800">{announcement.publisher || "PisaMusic Team"}</div>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>{announcement.time || "刚刚"}</div>
            <div className="mt-1">{blockCount(announcement.content)}</div>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          <Tag>V{announcement.announcementVersion ?? 1}</Tag>
          <Tag>{announcementPlatformLabels[announcement.platform ?? "all"]}</Tag>
          <Tag className="max-w-full whitespace-normal break-words">{describeAnnouncementVersion(announcement.versionRule)}</Tag>
          {waitSeconds > 0 && <Tag>自动弹出等待 {waitSeconds} 秒</Tag>}
        </div>
        <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
          {announcement.content.blocks.map((block, index) => {
            if (block.type === "text") {
              return (
                <span
                  key={index}
                  style={{
                    color: block.color ? announcementColorHex(block.color) : undefined,
                    fontWeight: block.bold ? 700 : undefined,
                    fontStyle: block.italic ? "italic" : undefined,
                  }}
                >
                  {block.text}
                </span>
              );
            }
            if (block.type === "image") {
              return <span key={index} className="my-3 block">
                {block.url ? (
                  <img src={block.url} alt={block.alt || "公告图片"} className="max-h-80 w-full rounded-xl border border-slate-200 object-contain" />
                ) : (
                  <span className="block rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-xs text-slate-400">图片尚未上传（{block.fileId || "未选择文件"}）</span>
                )}
              </span>;
            }
            const action = block.action;
            return (
              <span
                key={index}
                className={`font-medium ${action.type !== "none" ? "cursor-pointer underline decoration-1 underline-offset-2" : ""}`}
                style={{ color: announcementColorHex(block.color) }}
                title={action.type === "page" ? announcementPageLabels[action.page] : action.type !== "none" ? action.label : undefined}
                onClick={() => {
                  if (action.type === "copy") void copyText(action.value);
                  else if (action.type === "page") message.info(`打开 App ${announcementPageLabels[action.page]}页`);
                  else if (action.type !== "none") message.info("预览模式不会打开跳转地址");
                }}
              >
                {block.text}
                {action.type === "copy" && <CopyOutlined className="ml-1 text-xs" />}
                {(action.type === "url" || action.type === "page") && <LinkOutlined className="ml-1 text-xs" />}
              </span>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <Tag color="blue">预览模式</Tag>
          <Space>
            {gotoDescription && <Button size="small" onClick={() => message.info(gotoDescription)}>前往</Button>}
            <Button size="small" type="primary">{announcement.confirmText || "我知道了"}</Button>
          </Space>
        </div>
        {gotoDescription && <Text type="secondary" className="mt-2 block break-all text-right text-[11px]">{gotoDescription}</Text>}
      </div>
    </Modal>
  );
}
