import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CopyOutlined,
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import { decrypt } from "../../api/crypto";
import { DEFAULT_PLAINTEXT_PATHS } from "../../types/config";

const { Text } = Typography;

type Props = {
  paths: string[];
  themeColor: string;
  saving: boolean;
  dirty: boolean;
  onChange: (paths: string[]) => void;
  onSave: () => void;
  onResetToDefault: () => void;
  onReloadFromServer: () => void;
};

const PATH_REGEX = /^\/[A-Za-z0-9._\-/*]*$/;
const FULL_KEY_REGEX = /^[0-9a-fA-F]{128}$/;

function validatePath(input: string): string | null {
  const t = input.trim();
  if (!t) return "路径不能为空";
  if (t.length > 256) return "路径过长";
  if (!t.startsWith("/")) return "路径必须以 / 开头";
  if (!PATH_REGEX.test(t)) return "仅允许字母数字 . _ - / *";
  const starIdx = t.indexOf("*");
  if (starIdx !== -1 && starIdx !== t.length - 1) return "* 只能出现在末尾";
  return null;
}

function extractEncData(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") return parsed.trim();
    if (parsed && typeof parsed === "object") {
      const encData = (parsed as { encData?: unknown }).encData;
      if (typeof encData === "string") return encData.trim();
      throw new Error("未找到 encData 字段");
    }
  } catch (e) {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      throw e;
    }
  }
  return trimmed;
}

function formatPlainText(plain: string): string {
  try {
    return JSON.stringify(JSON.parse(plain) as unknown, null, 2);
  } catch {
    return plain;
  }
}

export default function EncryptionTab({
  paths,
  themeColor: _,
  saving,
  dirty,
  onChange,
  onSave,
  onResetToDefault,
  onReloadFromServer,
}: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Decryption tool states
  const [decryptKey, setDecryptKey] = useState("");
  const [cipherInput, setCipherInput] = useState("");
  const [decryptResult, setDecryptResult] = useState("");
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  const stats = useMemo(() => {
    let exact = 0;
    let wildcard = 0;
    for (const p of paths) {
      if (p.endsWith("*")) wildcard += 1;
      else exact += 1;
    }
    return { exact, wildcard, total: paths.length };
  }, [paths]);

  const handleAdd = () => {
    const t = draft.trim();
    const err = validatePath(t);
    if (err) {
      setError(err);
      return;
    }
    if (paths.includes(t)) {
      setError("该路径已在白名单中");
      return;
    }
    onChange([...paths, t]);
    setDraft("");
    setError(null);
  };

  const handleRemove = (idx: number) => {
    const next = paths.filter((_, i) => i !== idx);
    onChange(next);
  };

  const handleDecrypt = async () => {
    const fullKey = decryptKey.trim();
    if (!FULL_KEY_REGEX.test(fullKey)) {
      setDecryptError("x-pm-random 必须是 128 位十六进制 (hex) 字符串");
      setDecryptResult("");
      return;
    }

    let encData = "";
    try {
      encData = extractEncData(cipherInput);
    } catch {
      setDecryptError("密文格式不正确，请输入 encData 或完整的加密 JSON");
      setDecryptResult("");
      return;
    }
    if (!encData) {
      setDecryptError("密文不能为空");
      setDecryptResult("");
      return;
    }

    setDecrypting(true);
    setDecryptError(null);
    try {
      const plain = await decrypt(fullKey, encData);
      setDecryptResult(formatPlainText(plain));
    } catch {
      setDecryptResult("");
      setDecryptError("解密失败，请检查密文和 x-pm-random 是否对应匹配");
    } finally {
      setDecrypting(false);
    }
  };

  const copyDecryptResult = async () => {
    if (!decryptResult) return;
    try {
      await navigator.clipboard.writeText(decryptResult);
      void message.success("明文已复制到剪贴板！");
    } catch {
      window.alert("复制失败，请检查剪贴板权限。");
    }
  };

  const pathTableData = useMemo(() => {
    return paths.map((path, index) => ({
      key: path,
      index: index + 1,
      path,
      isWildcard: path.endsWith("*"),
    }));
  }, [paths]);

  const columns: ColumnsType<{ key: string; index: number; path: string; isWildcard: boolean }> = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 70,
      align: "center",
      render: (num: number) => (
        <span className="font-mono text-xs text-slate-400">{String(num).padStart(2, "0")}</span>
      ),
    },
    {
      title: "匹配类型",
      dataIndex: "isWildcard",
      key: "isWildcard",
      width: 100,
      align: "center",
      render: (isWildcard: boolean) => (
        <Tag color={isWildcard ? "cyan" : "default"}>
          {isWildcard ? "通配前缀" : "精确匹配"}
        </Tag>
      ),
    },
    {
      title: "明文白名单接口路径",
      dataIndex: "path",
      key: "path",
      render: (p: string) => (
        <Text copyable={{ text: p }} className="font-mono text-xs text-slate-800">
          {p}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 90,
      align: "center",
      render: (_, record) => (
        <Popconfirm
          title={`移除 "${record.path}"？`}
          onConfirm={() => handleRemove(record.index - 1)}
          okText="确认移除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Whitelist Management Card */}
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div className="flex items-center gap-2">
            <SafetyCertificateOutlined className="text-amber-500 text-lg" />
            <span className="text-lg font-bold text-slate-800">端到端加密 · 明文白名单</span>
            <Tag color="blue">{stats.total} 条配置</Tag>
            <Tag color="cyan">{stats.wildcard} 条通配</Tag>
            <Tag color="default">{stats.exact} 条精确</Tag>
          </div>
        }
        extra={
          <Space>
            {dirty ? (
              <Tag color="warning" className="!mr-0">
                有未保存修改
              </Tag>
            ) : (
              <Tag color="success" className="!mr-0">
                已同步服务端
              </Tag>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={onReloadFromServer}
            >
              拉取服务端最新
            </Button>
            <Popconfirm
              title="确认要重置为默认推荐白名单吗？"
              description="仅覆盖当前草稿，点击保存后生效。"
              onConfirm={onResetToDefault}
              okText="确认重置"
              cancelText="取消"
            >
              <Button>
                重置为默认 ({DEFAULT_PLAINTEXT_PATHS.length}条)
              </Button>
            </Popconfirm>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!dirty}
              loading={saving}
              onClick={onSave}
            >
              保存白名单
            </Button>
          </Space>
        }
      >
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          白名单内的接口路径不要求 <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono text-slate-700">x-pm-random</code> 头，响应也不会被加密；
          非白名单接口若缺少加密头会直接拒绝返回 401。通配符 <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono text-slate-700">/*</code> 仅允许出现在末尾。
        </p>

        <div className="mb-4 flex gap-3">
          <Input
            placeholder="例如 /api/health 或 /api/admin/*"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onPressEnter={handleAdd}
            className="font-mono text-xs flex-1 max-w-lg"
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加路径
          </Button>
        </div>

        {error && (
          <Alert type="error" showIcon message={error} className="mb-4 text-xs py-1.5" />
        )}

        <Table
          rowKey="key"
          columns={columns}
          dataSource={pathTableData}
          size="middle"
          scroll={{ x: 700 }}
          bordered
          pagination={false}
        />
      </Card>

      {/* Browser Local Decrypt Tool Card */}
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div className="flex items-center gap-2">
            <KeyOutlined className="text-emerald-600 text-lg" />
            <span className="text-lg font-bold text-slate-800">加密响应本地解密工具</span>
            <Tag color="success">浏览器纯本地解密 · 无网络上报</Tag>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            输入接口响应中的 <code className="px-1 py-0.5 bg-slate-100 rounded font-mono text-slate-700">encData</code> 和对应响应头中的 <code className="px-1 py-0.5 bg-slate-100 rounded font-mono text-slate-700">x-pm-random</code>，在浏览器本地解密排查，安全不泄露。
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              响应头 x-pm-random <span className="text-slate-400 font-normal">(128 位十六进制密钥)</span>
            </label>
            <Input
              placeholder="例如 4a2f8c..."
              value={decryptKey}
              onChange={(e) => {
                setDecryptKey(e.target.value);
                if (decryptError) setDecryptError(null);
              }}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              密文 / 响应 JSON <span className="text-slate-400 font-normal">(可粘贴完整 JSON 或仅 encData 字符串)</span>
            </label>
            <Input.TextArea
              rows={4}
              placeholder='例如: {"isEnc": true, "encData": "..."}'
              value={cipherInput}
              onChange={(e) => {
                setCipherInput(e.target.value);
                if (decryptError) setDecryptError(null);
              }}
              className="font-mono text-xs"
            />
          </div>

          {decryptError && (
            <Alert type="error" showIcon message={decryptError} className="text-xs py-1.5" />
          )}

          <div>
            <Button
              type="primary"
              icon={<UnlockOutlined />}
              loading={decrypting}
              onClick={() => void handleDecrypt()}
              className="!bg-emerald-600 hover:!bg-emerald-700"
            >
              执行解密
            </Button>
          </div>

          {decryptResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Text strong className="text-xs text-slate-700">
                  解密明文结果:
                </Text>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => void copyDecryptResult()}
                >
                  复制明文
                </Button>
              </div>
              <pre className="min-h-36 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 font-mono text-xs text-emerald-400 leading-relaxed shadow-inner">
                {decryptResult}
              </pre>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
