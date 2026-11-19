import { Tabs } from "antd";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import SongDownloadQuotaTab from "../components/songDownloads/SongDownloadQuotaTab";
import SongDownloadRecordsTab from "../components/songDownloads/SongDownloadRecordsTab";
import SongDownloadsOverviewTab from "../components/songDownloads/SongDownloadsOverviewTab";

export default function SongDownloadsPage() {
  const { themeColor } = useAdminLayout();

  return (
    <div className="space-y-4">
      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: "overview",
            label: "概览与 Top 排行",
            children: <SongDownloadsOverviewTab themeColor={themeColor} />,
          },
          {
            key: "records",
            label: "下载动态流水",
            children: <SongDownloadRecordsTab />,
          },
          {
            key: "quota",
            label: "配额策略与用量",
            children: <SongDownloadQuotaTab />,
          },
        ]}
      />
    </div>
  );
}
