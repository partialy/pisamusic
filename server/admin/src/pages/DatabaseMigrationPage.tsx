import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Button, Card, Descriptions, Divider, Modal, Progress, Radio, Space,
  Table, Tag, Typography, Upload, Select, message,
} from "antd";
import {
  CloudUploadOutlined, DatabaseOutlined, DownloadOutlined,
  ExclamationCircleOutlined, ReloadOutlined, SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  beginMigration, createDatabaseSnapshot, exitDatabaseMaintenance,
  fetchDatabaseStatus, fetchMigrationTask, listMigrationTasks, preflightDatabase,
  saveMigrationReport, saveSnapshotFile, uploadDatabaseFile,
  type DatabaseSnapshot, type DatabaseStatus, type MigrationSource,
  type MigrationTask, type PreflightResult, type UploadedDatabase,
} from "../api/databaseMigration";

const { Text, Paragraph, Title } = Typography;
const terminalStates = new Set(["COMPLETED", "READY_TO_SWITCH", "FAILED", "INTERRUPTED", "CANCELLED"]);
const stateLabels: Record<string, string> = {
  PRECHECKING: "预检查", QUIESCING: "进入维护", SNAPSHOTTING: "生成完整快照",
  INITIALIZING: "准备目标数据库", IMPORTING: "迁移数据", VERIFYING: "数据校验",
  COMPLETED: "同步完成", READY_TO_SWITCH: "等待切换", FAILED: "失败", INTERRUPTED: "中断", CANCELLED: "已取消",
};
const dateTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleString("zh-CN") : "—";
const displaySize = (value?: number) => {
  if (value == null) return "—";
  const unit = value >= 1073741824 ? "GB" : value >= 1048576 ? "MB" : "KB";
  const divisor = unit === "GB" ? 1073741824 : unit === "MB" ? 1048576 : 1024;
  return `${(value / divisor).toFixed(2)} ${unit}`;
};
const badgeStatus = (status: string) =>
  status === "COMPLETED" || status === "READY_TO_SWITCH" || status === "VERIFIED" ? "success"
    : status === "FAILED" || status === "INTERRUPTED" ? "error"
    : status === "CANCELLED" ? "default" : "processing";

export default function DatabaseMigrationPage() {
  const [messageApi, messageContext] = message.useMessage();
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [tasks, setTasks] = useState<MigrationTask[]>([]);
  const [task, setTask] = useState<MigrationTask | null>(null);
  const [sourceType, setSourceType] = useState<"server" | "upload" | "snapshot">("server");
  const [snapshotSourceId, setSnapshotSourceId] = useState<string>();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadedDatabase | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [checkResult, setCheck] = useState<PreflightResult | null>(null);
  const [checkContext, setCheckContext] = useState("");
  const checkGeneration = useRef(0);
  const [snapshot, setSnapshot] = useState<DatabaseSnapshot | null>(null);
  const [retryTaskId, setRetryTaskId] = useState<string>();
  const [busy, setBusy] = useState<string>("");

  const source = useMemo<MigrationSource | null>(() => status?.dbType === "MYSQL" || sourceType === "server"
    ? { sourceType: "server" }
    : sourceType === "snapshot" ? snapshotSourceId ? { sourceType: "snapshot", sourceId: snapshotSourceId } : null
    : upload ? { sourceType: "upload", sourceId: upload.id } : null,
  [status?.dbType, sourceType, upload, snapshotSourceId]);
  const context = JSON.stringify([source, retryTaskId, status?.dbType, status?.target, status?.mysql.host, status?.mysql.port, status?.mysql.database, status?.sqliteFile, status?.activeTaskId, status?.maintenance]);
  const currentContext = useRef(context);
  if (currentContext.current !== context) {
    currentContext.current = context;
    checkGeneration.current += 1;
  }
  const check = checkContext === context ? checkResult : null;

  const refresh = useCallback(async () => {
    try {
      const [nextStatus, nextTasks] = await Promise.all([fetchDatabaseStatus(), listMigrationTasks()]);
      setStatus(nextStatus);
      setTasks(nextTasks);
      setTask(current => nextTasks.find(item => item.id === current?.id)
        ?? nextTasks.find(item => item.id === nextStatus.activeTaskId)
        ?? nextTasks[0] ?? null);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "无法加载数据库状态");
    }
  }, [messageApi]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!task || terminalStates.has(task.status)) return;
    let disposed = false;
    const timer = window.setInterval(() => {
      void fetchMigrationTask(task.id).then(next => { if (!disposed) setTask(next); }).catch(error => {
        if (!disposed) { messageApi.error(error instanceof Error ? error.message : "任务状态读取失败，请刷新重试"); window.clearInterval(timer); }
      });
    }, 1000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [task?.id, task?.status, messageApi]);

  useEffect(() => {
    if (task && terminalStates.has(task.status)) void refresh();
    // 终态变化时刷新历史，但不需要持续轮询。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status]);

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try { await fn(); }
    catch (error) { messageApi.error(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(""); }
  };

  const switchSource = (value: "server" | "upload" | "snapshot") => {
    setSourceType(value);
    setCheck(null);
    setSnapshot(null);
    setRetryTaskId(undefined);
  };

  const doCheck = () => {
    if (!source) return;
    const generation = ++checkGeneration.current;
    const requestContext = context;
    setCheck(null);
    void run("check", async () => {
      const result = await preflightDatabase(source, retryTaskId);
      if (generation !== checkGeneration.current || requestContext !== currentContext.current) return;
      setCheckContext(requestContext);
      setCheck(result);
      if (result.passed) messageApi.success("预检查通过，可以开始迁移");
      else messageApi.warning("预检查未通过，请查看检查结果");
    });
  };
  const createSnapshot = () => {
    if (!source) return;
    void run("snapshot", async () => {
      const result = await createDatabaseSnapshot(source);
      setSnapshot(result);
      messageApi.success("完整数据库备份已生成");
      await refresh();
    });
  };
  const doUpload = () => {
    if (!uploadFile) return;
    void run("upload", async () => {
      setProgress(0);
      try {
        const result = await uploadDatabaseFile(uploadFile, fraction => setProgress(Math.round(fraction * 100)));
        setUpload(result);
        setCheck(null);
        setSnapshot(null);
        messageApi.success("数据库文件上传及完整性检查通过");
      } finally { setProgress(null); }
    });
  };
  const start = (mode: "sync" | "switch") => {
    if (!source || !check?.passed) return;
    Modal.confirm({
      title: retryTaskId ? "确认重新迁移？" : "确认开始迁移？",
      icon: <ExclamationCircleOutlined />,
      content: `源库 ${status?.dbType} → 目标 ${check.target ? check.target.type === "MYSQL" ? `${check.target.host}:${check.target.port}/${check.target.database}` : check.target.file : targetDialect}。操作会进入维护模式，覆盖目标业务数据并删除多余记录。请先生成并下载备份，停止使用目标库的其他服务。${mode === "sync" ? "完成后恢复当前源库运行。" : "完成后保持维护，须手动修改 DB_TYPE 并重启。"} 本地上传文件和七牛等外部资源不会复制。`,
      okText: "进入维护并迁移", okType: "danger", cancelText: "取消",
      onOk: async () => {
        if (currentContext.current !== context || active || busy) {
          messageApi.warning("迁移来源或数据库状态已变化，请重新预检查");
          return;
        }
        await run("start", async () => {
          const next = await beginMigration(source, retryTaskId, mode);
          setTask(next);
          setCheck(null);
          messageApi.success("迁移任务已创建");
          await refresh();
        });
      },
    });
  };
  const cancelMaintenance = () => Modal.confirm({
    title: `确认恢复当前 ${status?.dbType} 服务？`,
    content: "恢复当前 DB_TYPE 对应的源库。请确认尚未切换目标库，且没有其他实例向目标库写入。",
    okType: "danger", okText: "确认退出维护", cancelText: "返回",
    onOk: async () => {
      await run("exit", async () => {
        await exitDatabaseMaintenance();
        messageApi.success("维护模式已退出");
        setCheck(null);
        await refresh();
      });
    },
  });

  const active = Boolean(status?.activeTaskId) || Boolean(task && !terminalStates.has(task.status));
  const targetDialect = status?.dbType === "MYSQL" ? "SQLITE" : "MYSQL";
  const canMigrate = Boolean(status) && !active && Boolean(source) && !busy;
  const shownSnapshot = snapshot ?? (sourceType === "server" ? status?.snapshots?.[0] : undefined) ?? null;
  const percent = task ? ["COMPLETED", "READY_TO_SWITCH"].includes(task.status) ? 100
    : task.totalRows ? Math.min(99, Math.round(task.processedRows * 100 / task.totalRows)) : 0 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {messageContext}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Title level={4} className="!mb-1">数据库迁移</Title>
          <Text type="secondary">SQLite ↔ MySQL 完整备份 / 覆盖同步 / 切换准备</Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={busy === "refresh"} disabled={Boolean(busy)} onClick={() => void run("refresh", refresh)}>刷新状态</Button>
      </div>

      {status?.maintenance && <Alert type="warning" showIcon message="当前处于数据库维护模式"
        description="普通业务接口已停止访问。迁移失败时可安全退出维护；同步完成后恢复当前库；准备切换完成后保持维护，直到手动切换并重启。"
        action={!active
          ? <Button danger size="small" onClick={cancelMaintenance}>安全退出维护</Button> : undefined} />}
      <Alert type="warning" showIcon message="目标业务数据将被覆盖，多余记录会删除" description="请先备份并停止使用目标库的其他服务。数据库迁移不会复制上传文件及七牛等外部资源。" />

      <Card title={<Space><DatabaseOutlined /> 数据库状态</Space>} loading={!status}>
        {status && <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="当前运行"><Tag color={status.dbType === "MYSQL" ? "blue" : "default"}>{status.dbType}</Tag></Descriptions.Item>
          <Descriptions.Item label="迁移目标">{status.target ? status.target.type === "MYSQL" ? `${status.target.host}:${status.target.port}/${status.target.database}` : status.target.file : targetDialect}</Descriptions.Item>
          <Descriptions.Item label="SQLite 路径">{status.sqliteFile || "—"}</Descriptions.Item>
          <Descriptions.Item label="MySQL 配置">{status.mysql.configured ? "已设置 MYSQL_URL" : <Text type="warning">未配置 MYSQL_URL</Text>}</Descriptions.Item>
          <Descriptions.Item label="MySQL 状态"><Tag color={status.mysql.connected ? "success" : "error"}>{status.mysql.connected ? "连接正常" : "未连接"}</Tag></Descriptions.Item>
          <Descriptions.Item label="MySQL 版本">{status.mysql.version || "—"}</Descriptions.Item>
          <Descriptions.Item label="MySQL 实例">{status.mysql.database ? `${status.mysql.host}:${status.mysql.port}/${status.mysql.database}` : "—"}</Descriptions.Item>
        </Descriptions>}
        {status?.mysql.error && <Text type="danger">{status.mysql.error}</Text>}
      </Card>

      <Card title={<Space><SafetyCertificateOutlined /> 数据来源与完整备份</Space>}>
        <Paragraph>当前源库：<Text strong>{status?.dbType || "—"}</Text> → 目标：<Text strong>{targetDialect}</Text>（服务端环境配置）</Paragraph>
        {status?.dbType === "SQLITE" && <Radio.Group disabled={active || Boolean(busy)} value={sourceType} onChange={event => switchSource(event.target.value)} className="mb-4">
          <Radio value="server">当前服务器数据库</Radio>
          <Radio value="snapshot">选择 SQLite 备份</Radio>
          <Radio value="upload">上传完整 .db 文件</Radio>
        </Radio.Group>}
        {status?.dbType === "MYSQL" || sourceType === "server" ? (
          <Paragraph type="secondary">读取当前 DB_TYPE 对应的运行库，SQLite 包含 WAL 已提交数据，MySQL 导出为便携 SQLite .db 备份。</Paragraph>
        ) : sourceType === "snapshot" ? <Select className="mb-4 w-full" placeholder="选择完整 SQLite 备份" value={snapshotSourceId} disabled={active || Boolean(busy)} options={status?.snapshots.map(item => ({ value: item.id, label: `${dateTime(item.createdAt)} · ${displaySize(item.size)} · ${item.id}` }))} onChange={value => { setSnapshotSourceId(value); setCheck(null); setSnapshot(null); setRetryTaskId(undefined); }} /> : (
          <Space direction="vertical" className="mb-4 w-full">
            <Upload disabled={active || Boolean(busy)} maxCount={1} accept=".db" beforeUpload={file => { setUploadFile(file); setUpload(null); setCheck(null); setRetryTaskId(undefined); return false; }}
              onRemove={() => { setUploadFile(null); setUpload(null); setCheck(null); }}>
              <Button icon={<CloudUploadOutlined />}>选择完整 SQLite .db 文件</Button>
            </Upload>
            <Space wrap>
              <Button loading={busy === "upload"} disabled={!uploadFile || active || Boolean(busy)} onClick={doUpload}>上传并校验</Button>
              {upload && <Tag color="success">{upload.tables.length} 张表 · {displaySize(upload.size)} · 上传成功</Tag>}
            </Space>
            {progress !== null && <Progress percent={progress} size="small" />}
            <Text type="secondary">请上传完整单文件快照，单独复制有活跃 WAL 的主 .db 可能缺数据。默认最大 2GB。</Text>
          </Space>
        )}

        <Space wrap>
          <Button icon={<DatabaseOutlined />} disabled={!source || active || Boolean(busy)} loading={busy === "snapshot"} onClick={createSnapshot}>生成完整 .db</Button>
          {shownSnapshot && <Button icon={<DownloadOutlined />} loading={busy === "download"} onClick={() => void run("download", () => saveSnapshotFile(shownSnapshot.id))}>下载已生成备份</Button>}
        </Space>
        {shownSnapshot && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="生成时间">{dateTime(shownSnapshot.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="文件大小">{displaySize(shownSnapshot.size)}</Descriptions.Item>
            <Descriptions.Item label="WAL 状态">{shownSnapshot.checkpoint}</Descriptions.Item>
            <Descriptions.Item label="数据表数量">{shownSnapshot.tables.length}</Descriptions.Item>
            <Descriptions.Item label="SHA-256" span={2}><Text copyable className="break-all">{shownSnapshot.sha256}</Text></Descriptions.Item>
          </Descriptions>
        </div>}
      </Card>

      <Card title="迁移预检查与执行">
        <Space wrap>
          <Button onClick={doCheck} disabled={!canMigrate} loading={busy === "check"}>检查源库与目标库</Button>
          <Button onClick={() => start("sync")} disabled={!canMigrate || !check?.passed} loading={busy === "start"}>覆盖同步后恢复当前库</Button>
          <Button type="primary" danger onClick={() => start("switch")} disabled={!canMigrate || !check?.passed} loading={busy === "start"}>覆盖同步并准备切换</Button>
        </Space>
        {check && <div className="mt-4 space-y-3">
          <Alert showIcon type={check.passed ? "success" : "error"} message={check.passed ? "全部预检查通过" : "预检查存在阻断项"}
            description={`检测到 ${check.tables.length} 张数据表、${check.totalRows.toLocaleString()} 条记录`} />
          <Table rowKey="name" size="small" pagination={false} dataSource={check.checks}
            columns={[
              { title: "检查项", dataIndex: "name", width: 170 },
              { title: "结果", dataIndex: "ok", width: 90, render: (ok: boolean) => <Tag color={ok ? "success" : "error"}>{ok ? "通过" : "未通过"}</Tag> },
              { title: "说明", dataIndex: "detail", render: (value: string) => <Text className="break-all">{value}</Text> },
            ]} />
          <Table rowKey="name" size="small" dataSource={check.tables} pagination={{ pageSize: 8, showSizeChanger: false }}
            columns={[{ title: "源数据表", dataIndex: "name" }, { title: "记录数", dataIndex: "count", align: "right" }]} />
        </div>}
      </Card>

      <Card title="迁移任务及进度">
        {task ? <div className="space-y-3">
          <Space wrap>
            <Tag color={badgeStatus(task.status)}>{stateLabels[task.status] || task.status}</Tag>
            <Text type="secondary">任务 {task.id}</Text>
            <Text type="secondary">创建于 {dateTime(task.createdAt)}</Text>
          </Space>
          <Progress percent={percent} status={task.status === "FAILED" ? "exception" : ["COMPLETED", "READY_TO_SWITCH"].includes(task.status) ? "success" : "active"} />
          <Space wrap>
            <Text>当前表：{task.currentTable || "—"}</Text>
            <Text>已迁移 {task.processedRows.toLocaleString()} / {task.totalRows.toLocaleString()} 条</Text>
            <Text>校验通过 {task.tables.filter(item => item.status === "VERIFIED").length} 张表</Text>
          </Space>
          {task.status === "READY_TO_SWITCH" && <Alert type="success" showIcon message="迁移成功，等待手动切换"
            description={<span>数据校验通过，请将服务端环境变量设置为 <Text code>DB_TYPE={task.targetDialect?.toUpperCase() || targetDialect}</Text>，确认目标配置指向本次目标库，然后通过既有部署方式重启 Server。重启前不要解除维护模式。</span>} />}
          {task.status === "COMPLETED" && <Alert type="success" showIcon message="同步完成，当前源库已恢复运行" description="后续写入不会自动同步，需要切换时请重新准备切换。" />}
          <Text type="secondary">模式：{task.mode === "sync" ? "覆盖同步" : "准备切换"} · {task.sourceDialect || "源库"} → {task.targetDialect || "目标库"} · 目标可用：{task.targetUsable === true ? "是" : "尚未确认"}</Text>
          {(task.error || task.status === "INTERRUPTED") && <Alert type="error" showIcon
            message={task.status === "INTERRUPTED" ? "迁移中断" : "迁移失败"} description={task.error || "服务器意外重启，保持维护状态"} />}
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => void run("report", () => saveMigrationReport(task.id))} loading={busy === "report"}>导出 JSON 报告</Button>
            {task.snapshotId && <Button onClick={() => void run("download", () => saveSnapshotFile(task.snapshotId!))}>下载源库备份</Button>}
            {task.targetBackupId && <Button onClick={() => void run("download", () => saveSnapshotFile(task.targetBackupId!))}>下载覆盖前目标库备份</Button>}
            {["FAILED", "INTERRUPTED"].includes(task.status) &&
              <Button disabled={active || Boolean(busy)} onClick={() => { setRetryTaskId(task.id); setSourceType(status?.dbType === "MYSQL" ? "server" : task.source.sourceType); if (task.source.sourceType === "snapshot") setSnapshotSourceId(task.source.sourceId); if (task.source.sourceType === "upload" && task.source.sourceId) setUpload({ id: task.source.sourceId, size: 0, createdAt: task.createdAt, tables: [] }); setCheck(null); messageApi.info("已设为重试任务，请先重新预检查"); }}>使用此任务重新检查</Button>}
          </Space>
          <Divider className="!my-3" />
          <Table rowKey="name" size="small" pagination={{ pageSize: 8, showSizeChanger: false }} dataSource={task.tables}
            columns={[{ title: "数据表", dataIndex: "name" }, { title: "源记录数", dataIndex: "sourceCount", align: "right" },
              { title: "目标记录数", dataIndex: "targetCount", align: "right", render: (value?: number) => value ?? "—" },
              { title: "状态", dataIndex: "status", render: (value: string) => <Tag color={badgeStatus(value)}>{value}</Tag> }]} />
          <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
            {task.logs?.length ? task.logs.map((line, index) => <div key={index}>{line}</div>) : "尚无日志"}
          </div>
        </div> : <Text type="secondary">尚无迁移任务</Text>}
      </Card>

      <Card title="历史迁移记录">
        <Table rowKey="id" size="small" dataSource={tasks} pagination={{ pageSize: 8, showSizeChanger: false }}
          columns={[
            { title: "创建时间", dataIndex: "createdAt", render: dateTime },
            { title: "来源", dataIndex: ["source", "sourceType"], render: (value: string) => value === "server" ? "服务器运行库" : value === "snapshot" ? "SQLite 备份" : "上传文件" },
            { title: "结果", dataIndex: "status", render: (value: string) => <Tag color={badgeStatus(value)}>{stateLabels[value] || value}</Tag> },
            { title: "迁移记录", dataIndex: "processedRows", align: "right", render: (value: number) => value?.toLocaleString() },
            { title: "操作", key: "operations", render: (_: unknown, record: MigrationTask) =>
              <Space><Button size="small" type="link" onClick={() => setTask(record)}>查看详情</Button>
                <Button size="small" type="link" onClick={() => void run("report", () => saveMigrationReport(record.id))}>报告</Button></Space> },
          ]} />
      </Card>
      <Text type="secondary" className="block text-xs">迁移覆盖服务端配置的另一种数据库，源库保留，外部资源不会自动复制。切换前请检查目标数据、资源路径与配置。</Text>
    </div>
  );
}
