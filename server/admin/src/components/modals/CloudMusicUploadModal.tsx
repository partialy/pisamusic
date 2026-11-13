import { useState, type DragEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Modal,
  Progress,
  Segmented,
  Space,
  Steps,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  CustomerServiceOutlined,
  EditOutlined,
  FileTextOutlined,
  InboxOutlined,
  PictureOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useCloudMusicUploadQueue } from "../../state/CloudMusicUploadQueueContext";
import type { CloudMusicBatchDraftItem } from "../../types/cloudMusic";
import {
  isSupportedAudioFile,
  parseSelectedFilesBatch,
} from "../../utils/cloudMusicAudioParser";
import CloudMusicBatchEditorStep, { isDraftItemValid } from "./CloudMusicBatchEditorStep";
import CloudMusicUploadQueuePanel from "./CloudMusicUploadQueuePanel";

const { Text } = Typography;

export default function CloudMusicUploadModal() {
  const {
    modalOpen,
    modalView,
    setModalView,
    closeModal,
    enqueueBatch,
    stats,
  } = useCloudMusicUploadQueue();

  const [wizardStep, setWizardStep] = useState<0 | 1>(0);
  const [draftItems, setDraftItems] = useState<CloudMusicBatchDraftItem[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [matchNotice, setMatchNotice] = useState("");

  const cleanupDraftPreviews = (items: CloudMusicBatchDraftItem[]) => {
    for (const item of items) {
      if (item.coverPreviewUrl) {
        URL.revokeObjectURL(item.coverPreviewUrl);
      }
    }
  };

  const handleFilesSelected = async (files: File[], append = false) => {
    const hasAudio = files.some(isSupportedAudioFile);
    if (!hasAudio) {
      setError("请至少选择 1 个受支持的音频文件 (.mp3, .flac, .m4a, .aac, .ogg, .opus, .wav, .ape)");
      return;
    }

    setError("");
    setMatchNotice("");
    setParsing(true);
    const audioCount = files.filter(isSupportedAudioFile).length;
    setParseProgress({ done: 0, total: audioCount });

    try {
      const result = await parseSelectedFilesBatch(files, (done, total) => {
        setParseProgress({ done, total });
      });

      if (result.items.length === 0) {
        setError("未解析到有效音频文件");
        return;
      }

      const notices: string[] = [];
      if (result.unmatchedCoversCount > 0) {
        notices.push(`${result.unmatchedCoversCount} 个封面图片未匹配到同名音频`);
      }
      if (result.unmatchedLyricsCount > 0) {
        notices.push(`${result.unmatchedLyricsCount} 个歌词文件未匹配到同名音频`);
      }
      if (notices.length > 0) {
        setMatchNotice(notices.join("；"));
      }

      if (append) {
        setDraftItems((prev) => [...prev, ...result.items]);
        if (!selectedDraftId && result.items[0]) {
          setSelectedDraftId(result.items[0].id);
        }
      } else {
        cleanupDraftPreviews(draftItems);
        setDraftItems(result.items);
        setSelectedDraftId(result.items[0].id);
        setWizardStep(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析音频文件失败");
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (parsing) return;
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    if (dropped.length > 0) {
      void handleFilesSelected(dropped, false);
    }
  };

  const handleUpdateDraftItem = (
    id: string,
    updater: (prev: CloudMusicBatchDraftItem) => CloudMusicBatchDraftItem,
  ) => {
    setDraftItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const handleUpdateAllDrafts = (
    updater: (prev: CloudMusicBatchDraftItem) => CloudMusicBatchDraftItem,
  ) => {
    setDraftItems((prev) => prev.map((item) => updater(item)));
  };

  const handleRemoveDraftItem = (id: string) => {
    setDraftItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.coverPreviewUrl) {
        URL.revokeObjectURL(target.coverPreviewUrl);
      }
      const next = prev.filter((item) => item.id !== id);
      if (selectedDraftId === id) {
        setSelectedDraftId(next[0]?.id ?? "");
      }
      if (next.length === 0) {
        setWizardStep(0);
      }
      return next;
    });
  };

  const handleResetToStep1 = () => {
    cleanupDraftPreviews(draftItems);
    setDraftItems([]);
    setSelectedDraftId("");
    setError("");
    setMatchNotice("");
    setWizardStep(0);
  };

  const handleSubmitBatch = () => {
    if (draftItems.length === 0) {
      setError("待上传列表为空，请先选择音频文件");
      return;
    }

    const firstInvalid = draftItems.find((item) => !isDraftItemValid(item));
    if (firstInvalid) {
      setSelectedDraftId(firstInvalid.id);
      setError(
        `曲目《${firstInvalid.title || firstInvalid.audioFile.name}》的歌名、歌手或时长未填写完整，请检查左侧标红项`,
      );
      return;
    }

    setError("");
    setMatchNotice("");
    // 入队后由队列管理 coverPreviewUrl 的生命周期，这里直接清空向导列表并重置回第 1 步
    enqueueBatch(draftItems);
    setDraftItems([]);
    setSelectedDraftId("");
    setWizardStep(0);
  };

  const renderWizardFooter = () => {
    if (modalView === "queue") {
      return [
        <Button key="close" type="primary" onClick={closeModal}>
          后台运行 (关闭窗口)
        </Button>,
      ];
    }

    if (wizardStep === 0) {
      return [
        <Button key="close" onClick={closeModal}>
          关闭
        </Button>,
      ];
    }

    return [
      <Button key="reselect" onClick={handleResetToStep1} disabled={parsing}>
        清空并重新选择
      </Button>,
      <Button key="close" onClick={closeModal}>
        暂时收起
      </Button>,
      <Button
        key="submit"
        type="primary"
        icon={<CloudUploadOutlined />}
        disabled={draftItems.length === 0 || parsing}
        onClick={handleSubmitBatch}
      >
        提交并开始队列上传 ({draftItems.length} 首)
      </Button>,
    ];
  };

  return (
    <Modal
      open={modalOpen}
      centered
      width={1040}
      onCancel={closeModal}
      footer={renderWizardFooter()}
      title={
        <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
          <Space align="center" size={8}>
            <CloudUploadOutlined className="text-blue-500 text-lg" />
            <span className="text-base font-bold text-slate-800">
              网盘音乐批量上传与任务中心
            </span>
          </Space>

          <Segmented
            size="small"
            value={modalView}
            onChange={(val) => setModalView(val as "wizard" | "queue")}
            options={[
              {
                label: (
                  <span className="px-1.5 text-xs font-medium">
                    <EditOutlined className="mr-1" />
                    上传向导
                    {draftItems.length > 0 ? ` (${draftItems.length})` : ""}
                  </span>
                ),
                value: "wizard",
              },
              {
                label: (
                  <span className="px-1.5 text-xs font-medium">
                    <UnorderedListOutlined className="mr-1" />
                    任务队列
                    {stats.total > 0 && (
                      <Badge
                        count={stats.active > 0 ? stats.active : stats.failed > 0 ? stats.failed : stats.total}
                        size="small"
                        color={stats.failed > 0 ? "red" : stats.active > 0 ? "blue" : "green"}
                        className="ml-1.5"
                      />
                    )}
                  </span>
                ),
                value: "queue",
              },
            ]}
          />
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        {modalView === "queue" ? (
          <CloudMusicUploadQueuePanel />
        ) : (
          <>
            <Steps
              size="small"
              current={wizardStep}
              items={[
                {
                  title: "1. 选择文件并解析元数据",
                  description: "读取标签/内嵌封面/歌词",
                },
                {
                  title: "2. 逐项确认与配置",
                  description: "微调封面、歌词与曲目信息",
                },
                {
                  title: "3. 队列后台上传",
                  description: "关窗不中断，自动激活入库",
                },
              ]}
              className="px-2"
            />

            {error && <Alert type="error" showIcon message={error} />}
            {matchNotice && <Alert type="warning" showIcon message={matchNotice} closable />}

            {wizardStep === 0 ? (
              <div className="py-4 space-y-4">
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!parsing) setDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOver(false);
                  }}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all cursor-pointer ${
                    dragOver
                      ? "border-blue-500 bg-blue-50/70"
                      : "border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/30"
                  }`}
                >
                  <InboxOutlined className="text-5xl text-blue-500 mb-3" />
                  <Text strong className="text-base text-slate-800 block">
                    点击或拖拽音频文件至此处（支持批量多选）
                  </Text>
                  <Text type="secondary" className="text-xs mt-1.5 block max-w-xl">
                    浏览器将在本地自动读取音频的 <strong>歌名、歌手、专辑、时长、内嵌封面、内嵌歌词</strong>；
                    也支持同时选入同名外置 <code className="text-emerald-600">.lrc / .txt</code> 歌词或封面图片自动配对。
                  </Text>

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    <Tag icon={<CustomerServiceOutlined />} color="blue">
                      音频：MP3 / FLAC / M4A / AAC / OGG / OPUS / WAV / APE
                    </Tag>
                    <Tag icon={<PictureOutlined />} color="purple">
                      可选配对封面：JPG / PNG / WebP
                    </Tag>
                    <Tag icon={<FileTextOutlined />} color="green">
                      可选配对歌词：LRC / TXT
                    </Tag>
                  </div>

                  <input
                    type="file"
                    multiple
                    disabled={parsing}
                    accept="audio/*,.mp3,.flac,.m4a,.ogg,.wav,.aac,.ape,.opus,image/*,.jpg,.jpeg,.png,.webp,.lrc,.txt"
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={(e) => {
                      const fileList = e.currentTarget.files;
                      if (fileList && fileList.length > 0) {
                        void handleFilesSelected(Array.from(fileList), false);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </label>

                {parsing && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
                      <span>
                        正在浏览器本地读取音频标签、内嵌封面与歌词 ({parseProgress.done} /{" "}
                        {parseProgress.total})...
                      </span>
                      <span>
                        {parseProgress.total > 0
                          ? Math.round((parseProgress.done / parseProgress.total) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <Progress
                      percent={
                        parseProgress.total > 0
                          ? Math.round((parseProgress.done / parseProgress.total) * 100)
                          : 0
                      }
                      status="active"
                      size="small"
                    />
                  </div>
                )}

                {stats.total > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
                    <Space>
                      <CheckCircleOutlined className="text-blue-500" />
                      <span>
                        后台队列当前有 <strong>{stats.total}</strong> 个上传任务（进行中{" "}
                        <strong className="text-blue-600">{stats.active}</strong>，已完成{" "}
                        <strong className="text-emerald-600">{stats.completed}</strong>
                        {stats.failed > 0 ? (
                          <>
                            ，失败 <strong className="text-red-600">{stats.failed}</strong>
                          </>
                        ) : null}
                        ）
                      </span>
                    </Space>
                    <Button size="small" type="link" onClick={() => setModalView("queue")}>
                      查看任务状态
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <CloudMusicBatchEditorStep
                items={draftItems}
                selectedId={selectedDraftId}
                onSelectId={setSelectedDraftId}
                onUpdateItem={handleUpdateDraftItem}
                onUpdateAll={handleUpdateAllDrafts}
                onRemoveItem={handleRemoveDraftItem}
                onAppendFiles={(files) => void handleFilesSelected(files, true)}
                parsingMore={parsing}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
