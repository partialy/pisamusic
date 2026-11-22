import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Radio,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  LaptopOutlined,
  MobileOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type {
  DesktopUpdateAssetInfo,
  DesktopUpdateAssetType,
  UpdateFormDraft,
} from "../../types/config";
import {
  DESKTOP_REQUIRED_SLOTS,
  formatReleaseFileSize,
  getMissingDesktopSlotLabels,
  type DesktopStagedFiles,
} from "../../utils/releaseFormHelpers";

const { Text } = Typography;
const { TextArea } = Input;

type Props = {
  draft: UpdateFormDraft;
  isNew: boolean;
  themeColor: string;
  stagedAndroidFile: File | null;
  stagedDesktopFiles: DesktopStagedFiles;
  existingDesktopAssets: Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>>;
  loadingExistingAssets: boolean;
  onClose: () => void;
  onChange: (next: UpdateFormDraft) => void;
  onPlatformChange: (platform: "android" | "desktop") => void;
  onSelectFiles: (files: File[]) => void;
  onClearAndroidFile: () => void;
  onClearDesktopSlot: (slot: DesktopUpdateAssetType) => void;
  onSubmit: () => void;
};

export default function UpdateModal({
  draft,
  isNew,
  themeColor: _,
  stagedAndroidFile,
  stagedDesktopFiles,
  existingDesktopAssets,
  loadingExistingAssets,
  onClose,
  onChange,
  onPlatformChange,
  onSelectFiles,
  onClearAndroidFile,
  onClearDesktopSlot,
  onSubmit,
}: Props) {
  const isDesktop = draft.platform === "desktop";
  const acceptTypes = isDesktop ? ".exe,.yml,.yaml,.blockmap" : ".apk,.aab";
  const missingDesktopSlots = isDesktop
    ? getMissingDesktopSlotLabels(stagedDesktopFiles, existingDesktopAssets)
    : [];

  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={8}>
          <UploadOutlined className="text-blue-500 text-lg" />
          <span className="text-base font-bold text-slate-800">
            {isNew ? "发布新版本" : `编辑版本 (${isDesktop ? "PC 版" : "Android"})`}
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
      okText={isNew ? "保存并后台发布" : "保存并后台更新"}
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
              const key = e.target.value as "android" | "desktop";
              onPlatformChange(key);
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
              <span className="ml-1.5 font-normal text-slate-400">
                已自动递增，可手动矫正
              </span>
            </label>
            <Input
              value={draft.version}
              onChange={(e) => onChange({ ...draft, version: e.target.value })}
              placeholder={isDesktop ? "例如: 1.5.1" : "例如: v2.1.3"}
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
              placeholder="选择安装包后自动填入，如: 26.7MB"
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

        <Card size="small" className="bg-slate-50/80 border-slate-200 rounded-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Text strong className="text-sm text-slate-800">
                选择发布文件（支持多选，保存后后台上传）
              </Text>
              <Text type="secondary" className="block text-xs mt-0.5">
                {isDesktop
                  ? "请一次多选或分次补齐：latest.yml、.exe 安装包、.blockmap 差分文件（每类取第一个匹配项，其余忽略）。"
                  : "支持多选后自动选取第一个 .apk（无 .apk 时匹配第一个 .aab），其余文件忽略。"}
              </Text>
            </div>

            <label className="relative inline-flex shrink-0 items-center justify-center rounded-lg border border-blue-500 bg-blue-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer hover:bg-blue-600">
              <CloudUploadOutlined className="mr-1.5 text-sm" />
              选择文件（可多选）
              <input
                type="file"
                multiple
                accept={acceptTypes}
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                  const files = Array.from(e.currentTarget.files ?? []);
                  e.currentTarget.value = "";
                  if (files.length > 0) onSelectFiles(files);
                }}
              />
            </label>
          </div>

          {/* 匹配结果暂存展示 */}
          {!isDesktop && (
            <div className="mt-3">
              {stagedAndroidFile ? (
                <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs">
                  <div className="min-w-0 flex items-center gap-2">
                    <Tag color="blue" className="!mr-0">
                      待后台上传
                    </Tag>
                    <span className="truncate font-medium text-slate-800">
                      {stagedAndroidFile.name}
                    </span>
                    <span className="shrink-0 font-mono text-slate-500">
                      {formatReleaseFileSize(stagedAndroidFile.size)}
                    </span>
                  </div>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={onClearAndroidFile}
                  >
                    移除
                  </Button>
                </div>
              ) : draft.releaseFileId ? (
                <Tag color="success" className="mt-1">
                  已关联当前七牛安装包资产（不重选将沿用原包）
                </Tag>
              ) : (
                <Text type="secondary" className="text-xs">
                  尚未选择 Android 安装包文件（也可在下方手动填写直链地址）
                </Text>
              )}
            </div>
          )}

          {isDesktop && (
            <div className="mt-3 space-y-2.5">
              {loadingExistingAssets && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Spin size="small" />
                  <span>正在读取该版本已上传的 PC 更新文件...</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {DESKTOP_REQUIRED_SLOTS.map((slot) => {
                  const staged = stagedDesktopFiles[slot.type];
                  const existing = existingDesktopAssets[slot.type];
                  const hasExisting = Boolean(existing && existing.status === "uploaded");
                  return (
                    <div
                      key={slot.type}
                      className={`flex flex-col justify-between rounded-lg border p-2.5 text-xs ${
                        staged
                          ? "border-blue-300 bg-blue-50/60"
                          : hasExisting
                          ? "border-emerald-300 bg-emerald-50/60"
                          : "border-red-200 bg-red-50/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <Text strong className="text-xs text-slate-800">
                            {slot.label}
                          </Text>
                          {staged ? (
                            <Tag color="blue" className="!mr-0 text-[10px]">
                              待上传
                            </Tag>
                          ) : hasExisting ? (
                            <Tag
                              color="success"
                              icon={<CheckCircleOutlined />}
                              className="!mr-0 text-[10px]"
                            >
                              已存在
                            </Tag>
                          ) : (
                            <Tag
                              color="error"
                              icon={<CloseCircleOutlined />}
                              className="!mr-0 text-[10px]"
                            >
                              缺失
                            </Tag>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-slate-600 mb-0">
                          {staged
                            ? `${staged.name} (${formatReleaseFileSize(staged.size)})`
                            : hasExisting
                            ? existing!.fileName
                            : `尚未匹配 ${slot.label}`}
                        </p>
                      </div>

                      {staged && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="link"
                            size="small"
                            danger
                            className="!h-auto !p-0 text-[11px]"
                            onClick={() => onClearDesktopSlot(slot.type)}
                          >
                            清除重选
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {missingDesktopSlots.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  className="text-xs"
                  message={`缺少必选文件：${missingDesktopSlots.join("、")}（已匹配的文件已暂存，可再次点按钮补选）`}
                />
              )}
            </div>
          )}
        </Card>

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
              isDesktop
                ? "选择安装包保存后由七牛自动生成，或手动输入直链"
                : "选择 APK 保存后自动生成，或手动输入 APK 直链地址"
            }
            className="font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            官网引导地址 (Official URL) <span className="text-red-500">*</span>
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
            更新日志内容 (换行或分号分隔) <span className="text-red-500">*</span>
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
