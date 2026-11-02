import { Table } from "antd";
import type { ShareTrend } from "../../types/appShareRecords";

export default function ShareTrendTable({ items }: { items: ShareTrend[] }) {
  return <Table rowKey="day" size="small" dataSource={items} pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 650 }} columns={[
    { title: "日期（北京时间）", dataIndex: "day" }, { title: "访问 PV", dataIndex: "visitCount" },
    { title: "日 UV", dataIndex: "visitUv" }, { title: "Android 下载触发", dataIndex: "androidDownloadCount" },
    { title: "Windows 下载触发", dataIndex: "desktopDownloadCount" }, { title: "总下载触发", dataIndex: "downloadCount" },
  ]} />;
}
