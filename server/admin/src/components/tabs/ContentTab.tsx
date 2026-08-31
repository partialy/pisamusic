import {
  Button,
  Card,
  Input,
  Space,
  Tag,
} from "antd";
import {
  FileTextOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { AppConfigJson } from "../../types/config";
import { HtmlEditor } from "../ui/HtmlEditor";

type Props = {
  config: AppConfigJson;
  themeColor: string;
  dirty: boolean;
  saving: boolean;
  updateSection: <K extends keyof AppConfigJson, F extends keyof AppConfigJson[K]>(
    section: K,
    field: F,
    value: AppConfigJson[K][F],
  ) => void;
  onSave: () => void;
};

export default function ContentTab({
  config,
  themeColor: _,
  dirty,
  saving,
  updateSection,
  onSave,
}: Props) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Top Header Card */}
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div>
            <span className="text-lg font-bold text-slate-800">内容与协议配置</span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              维护客户端展示的服务协议、隐私政策与关于我们信息
            </span>
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
                已与服务端同步
              </Tag>
            )}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!dirty}
              loading={saving}
              onClick={onSave}
            >
              保存内容配置
            </Button>
          </Space>
        }
      >
        <div className="space-y-6">
          {/* Agreement Section */}
          <Card
            type="inner"
            title={
              <Space>
                <FileTextOutlined className="text-indigo-500" />
                <span className="font-bold text-slate-800">服务协议 (Agreement)</span>
              </Space>
            }
            className="rounded-xl border border-slate-200"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  协议标题
                </label>
                <Input
                  value={config.agreement.title}
                  onChange={(e) => updateSection("agreement", "title", e.target.value)}
                  placeholder="例如: 服务协议与条款"
                />
              </div>

              <HtmlEditor
                label="HTML 协议正文"
                value={config.agreement.content}
                onChange={(val) => updateSection("agreement", "content", val)}
                themeColor=""
              />
            </div>
          </Card>

          {/* Privacy Policy Section */}
          <Card
            type="inner"
            title={
              <Space>
                <SafetyCertificateOutlined className="text-rose-500" />
                <span className="font-bold text-slate-800">隐私政策 (Privacy)</span>
              </Space>
            }
            className="rounded-xl border border-slate-200"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  政策标题
                </label>
                <Input
                  value={config.privacy.title}
                  onChange={(e) => updateSection("privacy", "title", e.target.value)}
                  placeholder="例如: 用户隐私政策"
                />
              </div>

              <HtmlEditor
                label="HTML 政策正文"
                value={config.privacy.content}
                onChange={(val) => updateSection("privacy", "content", val)}
                themeColor=""
              />
            </div>
          </Card>

          {/* About Section */}
          <Card
            type="inner"
            title={
              <Space>
                <InfoCircleOutlined className="text-purple-500" />
                <span className="font-bold text-slate-800">关于我们 (About)</span>
              </Space>
            }
            className="rounded-xl border border-slate-200"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    应用名称
                  </label>
                  <Input
                    value={config.about.appName}
                    onChange={(e) => updateSection("about", "appName", e.target.value)}
                    placeholder="PisaMusic"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    团队名称
                  </label>
                  <Input
                    value={config.about.team}
                    onChange={(e) => updateSection("about", "team", e.target.value)}
                    placeholder="PisaMusic Team"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    官网入口显示文本 (Label)
                  </label>
                  <Input
                    value={config.about.websiteLabel}
                    onChange={(e) => updateSection("about", "websiteLabel", e.target.value)}
                    placeholder="官方网站"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    官网直达链接 (URL)
                  </label>
                  <Input
                    value={config.about.websiteUrl}
                    onChange={(e) => updateSection("about", "websiteUrl", e.target.value)}
                    placeholder="https://pisamusic.partialy.cn"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  应用简介描述
                </label>
                <Input.TextArea
                  rows={3}
                  value={config.about.description}
                  onChange={(e) => updateSection("about", "description", e.target.value)}
                  placeholder="介绍应用的核心亮点与定位..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  版权声明
                </label>
                <Input
                  value={config.about.copyright}
                  onChange={(e) => updateSection("about", "copyright", e.target.value)}
                  placeholder="Copyright © 2026 PisaMusic. All rights reserved."
                />
              </div>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
}
