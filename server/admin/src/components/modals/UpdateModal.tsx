import {
  Card,
  Input,
  Modal,
  Progress,
  Radio,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  CloudUploadOutlined,
  LaptopOutlined,
  MobileOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type {
  DesktopUpdateAssetInfo,
  DesktopUpdateAssetType,
  UpdateFormDraft,
} from "../../types/config";

const { Text } = Typography;
const { TextArea } = Input;

type Props = {
  draft: UpdateFormDraft;
  isNew: boolean;
  themeColor: string;
  saving: boolean;
  uploadingPackage: boolean;
  uploadProgress: number | null;
  desktopUpdateUploading: DesktopUpdateAssetType | null;
  desktopUpdateProgress: Partial<Record<DesktopUpdateAssetType, number>>;
  desktopUpdateAssets: Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>>;
  onClose: () => void;
  onChange: (next: UpdateFormDraft) => void;
  onUploadPackage: (file: File) => void;
  onUploadDesktopUpdateAsset: (file: File) => void;
  onSubmit: () => void;
};

export default function UpdateModal({
  draft,
  isNew,
  themeColor: _,
  saving,
  uploadingPackage,
  uploadProgress,
  desktopUpdateUploading,
  desktopUpdateProgress,
  desktopUpdateAssets,
  onClose,
  onChange,
  onUploadPackage,
  onUploadDesktopUpdateAsset,
  onSubmit,
}: Props) {
  const acceptTypes =
    draft.platform === "desktop" ? ".exe,.msi,.zip,.7z" : ".apk,.aab";
  const progress =
    uploadProgress == null
      ? null
      : Math.min(100, Math.max(0, Math.round(uploadProgress)));

  const desktopUpdateItems: Array<{
    type: DesktopUpdateAssetType;
    label: string;
    accept: string;
    required: boolean;
    hint: string;
  }> = [
    {
      type: "latest-yml",
      label: "latest.yml",
      accept: ".yml",
      required: true,
      hint: "electron-builder 生成的更新元数据，文件名必须是 latest.yml。",
    },
    {
      type: "installer",
      label: "安装包 EXE",
      accept: ".exe",
      required: true,
      hint: "与 latest.yml 内 files.url 对应的 Windows 安装包。",
    },
    {
      type: "blockmap",
      label: "差分 blockmap",
      accept: ".blockmap",
      required: false,
      hint: "可选；上传后支持差分下载，缺失时走完整包下载。",
    },
  ];

  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={8}>
          <UploadOutlined className="text-blue-500 text-lg" />
          <span className="text-base font-bold text-slate-800">
            {isNew ? "发布新版本" : `编辑版本 (${draft.platform === "desktop" ? "PC 版" : "Android"})`}
          </span>
          {draft.version && (
            <Tag color="geekblue" className="font-mono">
              {draft.version}
            </Tag>
          )}
        </Space>
      }
      width={800}
      onCancel={onClose}
      onOk={onSubmit}
      confirmLoading={saving}
      okText={isNew ? "保存并发布" : "保存修改"}
      cancelText="取消"
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            发布平台
          </label>
          <Radio.Group
            value={draft.platform}
            disabled={!isNew}
            onChange={(e) => {
              const key = e.target.value;
              onChange({
                ...draft,
                platform: key,
                platformLabel: key === "desktop" ? "PC 版" : "Android",
                available: key === "android" ? true : draft.available,
                downloadUrl: key === draft.platform ? draft.downloadUrl : "",
                fileSizeText: key === draft.platform ? draft.fileSizeText : "",
                releaseFileId: key === draft.platform ? draft.releaseFileId : undefined,
              });
            }}
            className="w-full"
          >
            <Radio.Button value="android" className="w-1/2 text-center">
              <MobileOutlined className="mr-1.5" />
              Android
            </Radio.Button>
            <Radio.Button value="desktop" className="w-1/2 text-center">
              <LaptopOutlined className="mr-1.5" />
              PC 桌面端
            </Radio.Button>
          </Radio.Group>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              版本号 (Version) <span className="text-red-500">*</span>
            </label>
            <Input
              value={draft.version}
              onChange={(e) => onChange({ ...draft, version: e.target.value })}
              placeholder="例如: v2.1.2"
              className="font-bold font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              发布时间 (Time)
            </label>
            <Input
              type="datetime-local"
              value={draft.updateTime.replace(" ", "T")}
              onChange={(e) =>
                onChange({
                  ...draft,
                  updateTime: e.target.value.replace("T", " "),
                })
              }
              className="font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              平台显示名
            </label>
            <Input
              value={draft.platformLabel}
              onChange={(e) =>
                onChange({ ...draft, platformLabel: e.target.value })
              }
              placeholder="Android / PC 版"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              安装包大小
            </label>
            <Input
              value={draft.fileSizeText}
              onChange={(e) =>
                onChange({ ...draft, fileSizeText: e.target.value })
              }
              placeholder="例如: 26.7MB"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div>
              <Text strong className="text-xs text-slate-800">
                强制更新
              </Text>
              <Text type="secondary" className="block text-[11px]">
                开启后用户必须升级方可使用
              </Text>
            </div>
            <Switch
              checked={draft.forceUpdate}
              onChange={(val) => onChange({ ...draft, forceUpdate: val })}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div>
              <Text strong className="text-xs text-slate-800">
                开放下载
              </Text>
              <Text type="secondary" className="block text-[11px]">
                关闭后官网显示“即将开放”
              </Text>
            </div>
            <Switch
              checked={draft.available}
              onChange={(val) =>
                onChange({
                  ...draft,
                  available: val || draft.platform === "android",
                })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            直接下载地址 (Download URL)
          </label>
          <Input
            value={draft.downloadUrl}
            onChange={(e) =>
              onChange({
                ...draft,
                downloadUrl: e.target.value,
                releaseFileId: undefined,
              })
            }
            placeholder={
              draft.platform === "desktop"
                ? "EXE/MSI/ZIP 直链，可留空由七牛云自动生成"
                : "APK 直链地址"
            }
            className="font-mono text-xs"
          />
        </div>

        <Card size="small" className="bg-slate-50/80 border-slate-200 rounded-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Text strong className="text-sm text-slate-800">
                上传安装包到七牛云
              </Text>
              <Text type="secondary" className="block text-xs">
                {draft.platform === "desktop"
                  ? "支持 .exe / .msi / .zip / .7z，上传成功后自动登记并生成下载链接。"
                  : "支持 .apk / .aab，上传成功后自动填入下载地址。"}
              </Text>
              {draft.releaseFileId && (
                <Tag color="success" className="mt-2">
                  已关联七牛安装包资产
                </Tag>
              )}
            </div>

            <label
              className={`relative inline-flex shrink-0 items-center justify-center rounded-lg border border-blue-500 bg-blue-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all ${
                uploadingPackage || saving
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-blue-600"
              }`}
            >
              <CloudUploadOutlined className="mr-1.5 text-sm" />
              {uploadingPackage ? "上传中…" : "选择文件上传"}
              <input
                type="file"
                accept={acceptTypes}
                disabled={uploadingPackage || saving}
                className="absolute inset-0 opacity-0 disabled:cursor-not-allowed"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (file) onUploadPackage(file);
                }}
              />
            </label>
          </div>

          {progress !== null && (
            <div className="mt-3">
              <Progress
                percent={progress}
                size="small"
                status={progress >= 100 ? "success" : "active"}
              />
            </div>
          )}
        </Card>

        {draft.platform === "desktop" && (
          <Card
            size="small"
            className="bg-slate-50/80 border-slate-200 rounded-xl"
            title={<span className="text-xs font-bold">PC 自动更新文件 (electron-updater feed)</span>}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {desktopUpdateItems.map((item) => {
                const asset = desktopUpdateAssets[item.type];
                const itemProgress = desktopUpdateProgress[item.type];
                const uploading = desktopUpdateUploading === item.type;
                return (
                  <div
                    key={item.type}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs"
                  >
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <Text strong className="text-xs text-slate-800">
                          {item.label}
                        </Text>
                        <Tag
                          color={item.required ? "error" : "default"}
                          className="!mr-0 text-[10px]"
                        >
                          {item.required ? "必需" : "可选"}
                        </Tag>
                      </div>
                      <p className="min-h-7 text-[11px] leading-4 text-slate-500">
                        {asset ? asset.fileName : item.hint}
                      </p>
                    </div>

                    <div className="mt-2">
                      {itemProgress !== undefined && (
                        <div className="mb-2">
                          <Progress
                            percent={Math.round(itemProgress)}
                            size="small"
                          />
                        </div>
                      )}
                      <label
                        className={`relative inline-flex w-full items-center justify-center rounded-md px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-all ${
                          uploading || saving
                            ? "cursor-not-allowed opacity-50"
                            : asset
                            ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                            : "bg-blue-500 hover:bg-blue-600 cursor-pointer"
                        }`}
                      >
                        {uploading ? "上传中…" : asset ? "重新上传" : "选择文件"}
                        <input
                          type="file"
                          accept={item.accept}
                          disabled={uploading || saving}
                          className="absolute inset-0 opacity-0 disabled:cursor-not-allowed"
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            e.currentTarget.value = "";
                            if (file) onUploadDesktopUpdateAsset(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            官网引导地址 (Official URL)
          </label>
          <Input
            value={draft.officialUrl}
            onChange={(e) =>
              onChange({ ...draft, officialUrl: e.target.value })
            }
            className="font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            更新日志内容 (换行或分号分隔)
          </label>
          <TextArea
            rows={3}
            value={draft.updateContent}
            onChange={(e) =>
              onChange({ ...draft, updateContent: e.target.value })
            }
            placeholder="例如: 1. 优化播放流畅度；2. 修复若干已知问题"
            className="font-mono text-xs"
          />
        </div>
      </div>
    </Modal>
  );
}
