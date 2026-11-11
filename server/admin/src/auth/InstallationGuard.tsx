import { useEffect, useState, type ReactNode } from "react";
import { Alert, Button, Card, Form, Input, Spin, Typography, message } from "antd";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { completeInstallation, fetchInstallationStatus, type InstallationStatus, type SetupInput } from "../api/setup";
import { clearStoredToken } from "./token";
import { bgPresets, glassCardClasses } from "../constants/theme";
import { loadTheme } from "../utils/themeStorage";

const INSTALLATION_KEY = "pisa-admin-installation";

function reconcileSession(status: InstallationStatus) {
  try {
    if (!status.initialized || !status.installationId || sessionStorage.getItem(INSTALLATION_KEY) !== status.installationId) clearStoredToken();
    if (status.installationId) sessionStorage.setItem(INSTALLATION_KEY, status.installationId);
    else sessionStorage.removeItem(INSTALLATION_KEY);
  } catch { clearStoredToken(); }
}

export default function InstallationGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<InstallationStatus>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [setupError, setSetupError] = useState<string>();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = loadTheme();
  const refresh = async () => {
    setLoading(true); setError(undefined);
    try {
      const next = await fetchInstallationStatus(); reconcileSession(next); setStatus(next);
      if (next.initialized && next.transferStatus !== "incomplete" && setupError && !setupError.includes("运行配置加载失败")) {
        message.warning(`安装已完成，请登录。上次提交提示：${setupError}`);
        setSetupError(undefined);
        navigate("/login", { replace: true });
      }
    }
    catch (err) { setError(err instanceof Error ? err.message : "无法连接服务器"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  if (!loading && !error && !setupError && status?.initialized && status.transferStatus !== "incomplete") {
    return location.pathname === "/setup" ? <Navigate to="/login" replace /> : children;
  }
  if (!loading && !error && status && !status.initialized && status.transferStatus !== "incomplete" && location.pathname !== "/setup") return <Navigate to="/setup" replace />;

  const submit = async (input: SetupInput) => {
    setSubmitting(true); setError(undefined); setSetupError(undefined);
    try {
      const next = await completeInstallation(input);
      reconcileSession(next); setStatus(next);
      navigate("/login", { replace: true });
    } catch (err) {
      const failure = err instanceof Error ? err.message : "初始化失败";
      setSetupError(failure);
      // 提交可能已经落库，只是响应丢失；重新确认后才能允许再次初始化。
      try {
        const next = await fetchInstallationStatus();
        reconcileSession(next); setStatus(next);
        if (next.initialized && next.transferStatus !== "incomplete" && !failure.includes("运行配置加载失败")) {
          setSetupError(undefined);
          message.warning(`安装已完成，请登录。上次提交提示：${failure}`);
          navigate("/login", { replace: true });
        }
      } catch (statusError) {
        setStatus(undefined);
        setError(statusError instanceof Error ? statusError.message : "无法确认安装状态");
      }
    }
    finally { setSubmitting(false); }
  };
  return <div className={`min-h-dvh flex items-center justify-center p-5 bg-gradient-to-br ${bgPresets[theme.bgIndex].base}`}>
    <Card className={`${glassCardClasses} w-full max-w-lg`}>
      <Typography.Title level={3}>PisaAdmin · 首次初始化</Typography.Title>
      {loading ? <Spin tip="正在检查安装状态…"><div className="h-24" /></Spin>
        : status?.transferStatus === "incomplete" ? <Alert type="error" showIcon message="数据库传输尚未完成" description="当前目标库不可用，请返回原运行库检查迁移报告并重新执行传输。不能在此创建新管理员。" action={<Button onClick={() => void refresh()}>重新检查</Button>} />
        : !status ? <Alert type="error" showIcon message={error || "无法读取安装状态"} description={setupError} action={<Button onClick={() => void refresh()}>重新检查安装状态</Button>} />
        : status.initialized ? <Alert type="warning" showIcon message="安装已完成" description={setupError || "请前往登录。"} action={<Button onClick={() => void refresh()}>重新检查安装状态</Button>} />
        : <Form<SetupInput> layout="vertical" onFinish={values => void submit(values)} disabled={submitting}>
          <Alert className="mb-4" type="info" showIcon message={`当前数据库：${status.databaseType}，请创建首个管理员。`} description="初始化令牌由服务器配置提供，请向部署管理员获取。" />
          <Form.Item name="setupToken" label="初始化令牌" rules={[{ required: true, message: "请输入初始化令牌" }]}><Input.Password autoComplete="off" /></Form.Item>
          <Form.Item name="username" label="管理员用户名" rules={[{ required: true }, { pattern: /^[A-Za-z0-9_.-]{3,64}$/, message: "3–64 位，仅限英文字母、数字、下划线、点和横线" }]}><Input autoComplete="username" /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }, { validator: (_, value: string) => { const bytes = new TextEncoder().encode(value || "").length; return (value || "").length >= 8 && bytes <= 72 ? Promise.resolve() : Promise.reject(new Error("密码至少 8 个字符，且不超过 72 个 UTF-8 字节")); } }]}><Input.Password autoComplete="new-password" /></Form.Item>
          <Form.Item name="confirmPassword" label="确认密码" dependencies={["password"]} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, value) => value === getFieldValue("password") ? Promise.resolve() : Promise.reject(new Error("两次密码不一致")) })]}><Input.Password autoComplete="new-password" /></Form.Item>
          {(setupError || error) && <Alert className="mb-4" type="error" message={setupError || error} showIcon action={<Button onClick={() => void refresh()}>重新检查安装状态</Button>} />}
          <Button type="primary" htmlType="submit" loading={submitting} block>创建管理员并前往登录</Button>
        </Form>}
    </Card>
  </div>;
}
