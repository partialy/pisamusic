import { useCallback, useEffect, useState } from "react";
import { message, Tabs, Typography } from "antd";
import {
  ClockCircleOutlined,
  CustomerServiceOutlined,
  FireOutlined,
} from "@ant-design/icons";
import {
  dissolveAdminOnlineRoom,
  fetchAdminOnlineRooms,
  fetchAdminRoomHistory,
  type AdminOnlineRoomListItem,
  type AdminRoomHistoryListItem,
} from "../api/listenTogetherAdmin";
import OnlineRoomTable from "../components/listenTogether/OnlineRoomTable";
import HistoryRoomTable from "../components/listenTogether/HistoryRoomTable";
import RoomDetailModal from "../components/listenTogether/RoomDetailModal";
import DissolveRoomModal from "../components/listenTogether/DissolveRoomModal";

const { Title, Text } = Typography;

export default function ListenTogetherManagementPage() {
  const [activeTab, setActiveTab] = useState<"online" | "history">("online");

  // Online state
  const [onlineItems, setOnlineItems] = useState<AdminOnlineRoomListItem[]>([]);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [onlineOffset, setOnlineOffset] = useState(0);
  const [onlineLimit] = useState(20);
  const [onlineKeyword, setOnlineKeyword] = useState("");
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineAutoRefresh, setOnlineAutoRefresh] = useState(true);

  // History state
  const [historyItems, setHistoryItems] = useState<AdminRoomHistoryListItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyLimit] = useState(20);
  const [historyFilter, setHistoryFilter] = useState<{
    keyword?: string;
    endReason?: string;
    startFrom?: number;
    startTo?: number;
  }>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  // Detail Modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalType, setDetailModalType] = useState<"online" | "history" | null>(null);
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);

  // Dissolve Modal state
  const [dissolveModalOpen, setDissolveModalOpen] = useState(false);
  const [dissolvingRoom, setDissolvingRoom] = useState<AdminOnlineRoomListItem | null>(null);
  const [dissolveLoading, setDissolveLoading] = useState(false);

  const loadOnlineRooms = useCallback(
    async (silent = false) => {
      if (!silent) setOnlineLoading(true);
      try {
        const result = await fetchAdminOnlineRooms({
          keyword: onlineKeyword || undefined,
          offset: onlineOffset,
          limit: onlineLimit,
        });
        setOnlineItems(result.items);
        setOnlineTotal(result.total);
      } catch (e) {
        if (!silent) {
          void message.error(e instanceof Error ? e.message : "加载在线房间失败");
        }
      } finally {
        if (!silent) setOnlineLoading(false);
      }
    },
    [onlineKeyword, onlineOffset, onlineLimit],
  );

  const loadHistoryRooms = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await fetchAdminRoomHistory({
        keyword: historyFilter.keyword,
        endReason: historyFilter.endReason,
        startFrom: historyFilter.startFrom,
        startTo: historyFilter.startTo,
        offset: historyOffset,
        limit: historyLimit,
      });
      setHistoryItems(result.items);
      setHistoryTotal(result.total);
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "加载历史房间失败");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilter, historyOffset, historyLimit]);

  // Initial load & Tab switch
  useEffect(() => {
    if (activeTab === "online") {
      void loadOnlineRooms();
    } else {
      void loadHistoryRooms();
    }
  }, [activeTab, loadOnlineRooms, loadHistoryRooms]);

  // Online auto refresh timer
  useEffect(() => {
    if (activeTab !== "online" || !onlineAutoRefresh) return;
    const timer = setInterval(() => {
      void loadOnlineRooms(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeTab, onlineAutoRefresh, loadOnlineRooms]);

  // Handlers for Online Tab
  const handleOnlineKeywordChange = (kw: string) => {
    setOnlineKeyword(kw);
    setOnlineOffset(0);
  };

  const handleOpenOnlineDetail = (room: AdminOnlineRoomListItem) => {
    setDetailModalType("online");
    setDetailRecordId(room.recordId);
    setDetailModalOpen(true);
  };

  const handleOpenDissolve = (room: AdminOnlineRoomListItem) => {
    setDissolvingRoom(room);
    setDissolveModalOpen(true);
  };

  const handleConfirmDissolve = async (recordId: string) => {
    setDissolveLoading(true);
    try {
      await dissolveAdminOnlineRoom(recordId);
      void message.success("房间已安全解散，并已通知在房成员");
      setDissolveModalOpen(false);
      setDissolvingRoom(null);
      await loadOnlineRooms();
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "解散房间失败");
    } finally {
      setDissolveLoading(false);
    }
  };

  // Handlers for History Tab
  const handleHistoryFilterChange = (filter: typeof historyFilter) => {
    setHistoryFilter(filter);
    setHistoryOffset(0);
  };

  const handleOpenHistoryDetail = (room: AdminRoomHistoryListItem) => {
    setDetailModalType("history");
    setDetailRecordId(room.recordId);
    setDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailModalOpen(false);
    setDetailModalType(null);
    setDetailRecordId(null);
  };

  // Metrics calculation
  const totalOnlineListeners = onlineItems.reduce((sum, r) => sum + r.onlinePeople, 0);

  return (
    <div style={{ padding: "0 4px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <CustomerServiceOutlined style={{ color: "#1677ff" }} />
            一起听房间管理
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            实时监控内存权威在线房间状态与播放信令，追溯 SQLite 持久化生命周期流水与成员参与记录
          </Text>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              background: "#f6ffed",
              border: "1px solid #b7eb8f",
              borderRadius: 6,
            }}
          >
            <FireOutlined style={{ color: "#52c41a", fontSize: 16 }} />
            <span style={{ fontSize: 13 }}>
              在线房间: <b>{onlineTotal}</b> 间 | 在线听众: <b>{totalOnlineListeners}</b> 人
            </span>
          </div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as "online" | "history")}
        items={[
          {
            key: "online",
            label: (
              <span>
                <FireOutlined /> 在线房间 ({onlineTotal})
              </span>
            ),
            children: (
              <OnlineRoomTable
                items={onlineItems}
                total={onlineTotal}
                offset={onlineOffset}
                limit={onlineLimit}
                keyword={onlineKeyword}
                loading={onlineLoading}
                autoRefresh={onlineAutoRefresh}
                onKeywordChange={handleOnlineKeywordChange}
                onPageChange={setOnlineOffset}
                onRefresh={() => void loadOnlineRooms()}
                onAutoRefreshChange={setOnlineAutoRefresh}
                onViewDetail={handleOpenOnlineDetail}
                onDissolve={handleOpenDissolve}
              />
            ),
          },
          {
            key: "history",
            label: (
              <span>
                <ClockCircleOutlined /> 房间历史流水 ({historyTotal})
              </span>
            ),
            children: (
              <HistoryRoomTable
                items={historyItems}
                total={historyTotal}
                offset={historyOffset}
                limit={historyLimit}
                keyword={historyFilter.keyword ?? ""}
                endReason={historyFilter.endReason ?? ""}
                startFrom={historyFilter.startFrom}
                startTo={historyFilter.startTo}
                loading={historyLoading}
                onFilterChange={handleHistoryFilterChange}
                onPageChange={setHistoryOffset}
                onRefresh={() => void loadHistoryRooms()}
                onViewDetail={handleOpenHistoryDetail}
              />
            ),
          },
        ]}
      />

      <RoomDetailModal
        open={detailModalOpen}
        type={detailModalType}
        recordId={detailRecordId}
        onClose={handleCloseDetail}
      />

      <DissolveRoomModal
        open={dissolveModalOpen}
        room={dissolvingRoom}
        loading={dissolveLoading}
        onConfirm={handleConfirmDissolve}
        onCancel={() => {
          setDissolveModalOpen(false);
          setDissolvingRoom(null);
        }}
      />
    </div>
  );
}
