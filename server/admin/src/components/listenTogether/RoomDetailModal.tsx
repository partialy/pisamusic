import { useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Image,
  Modal,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CustomerServiceOutlined,
  SoundOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  fetchAdminOnlineRoomDetail,
  fetchAdminRoomHistoryDetail,
  type AdminOnlineRoomDetail,
  type AdminOnlineRoomMember,
  type AdminRoomHistoryDetail,
  type AdminRoomMemberHistoryItem,
} from "../../api/listenTogetherAdmin";
import {
  formatDurationHuman,
  formatSeconds,
  formatTimestamp,
  formatTimestampFull,
} from "../../utils/date";

const { Text } = Typography;

type Props = {
  open: boolean;
  type: "online" | "history" | null;
  recordId: string | null;
  onClose: () => void;
};

const PLAYBACK_STATUS_MAP: Record<string, { label: string; color: string }> = {
  playing: { label: "播放中", color: "green" },
  paused: { label: "暂停中", color: "orange" },
  ended: { label: "已放完", color: "default" },
};

const LEAVE_REASON_MAP: Record<string, { label: string; color: string }> = {
  left: { label: "主动退出", color: "blue" },
  offline_timeout: { label: "掉线超时退出", color: "orange" },
  kicked: { label: "被房主踢出", color: "red" },
  room_closed: { label: "房间正常结束", color: "default" },
  admin_dissolved: { label: "管理员解散", color: "magenta" },
  replace_existing: { label: "换房退出", color: "purple" },
};

const END_REASON_MAP: Record<string, { label: string; color: string }> = {
  empty: { label: "全员离开自动结束", color: "default" },
  host_left: { label: "房主离开解散", color: "orange" },
  admin_dissolved: { label: "管理员安全解散", color: "red" },
  server_restart: { label: "服务端重启回收", color: "blue" },
  timeout: { label: "超时结束", color: "volcano" },
};

export default function RoomDetailModal({ open, type, recordId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [onlineDetail, setOnlineDetail] = useState<AdminOnlineRoomDetail | null>(null);
  const [historyDetail, setHistoryDetail] = useState<AdminRoomHistoryDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !recordId || !type) {
      setOnlineDetail(null);
      setHistoryDetail(null);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    const loadData = async () => {
      try {
        if (type === "online") {
          const data = await fetchAdminOnlineRoomDetail(recordId);
          if (isMounted) setOnlineDetail(data);
        } else {
          const data = await fetchAdminRoomHistoryDetail(recordId);
          if (isMounted) setHistoryDetail(data);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : "获取房间详情失败");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [open, type, recordId]);

  const isOnline = type === "online" && onlineDetail != null;
  const isHistory = type === "history" && historyDetail != null;

  const onlineMemberColumns: ColumnsType<AdminOnlineRoomMember> = [
    {
      title: "成员",
      key: "user",
      render: (_, m) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar src={m.avatarUrl} icon={<UserOutlined />} size="small" />
          <div>
            <div style={{ fontWeight: 500 }}>{m.nickname || m.username || "匿名"}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {m.userId}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "身份",
      dataIndex: "role",
      key: "role",
      width: 100,
      render: (role: string) =>
        role === "host" ? (
          <Tag color="gold">房主</Tag>
        ) : (
          <Tag color="blue">成员</Tag>
        ),
    },
    {
      title: "在线状态",
      dataIndex: "online",
      key: "online",
      width: 130,
      render: (online: boolean) =>
        online ? (
          <Tag color="success">在线</Tag>
        ) : (
          <Tooltip title="用户断开连接，保留30秒重连宽限期">
            <Tag color="default">离线保留 (宽限中)</Tag>
          </Tooltip>
        ),
    },
    {
      title: "入房时间",
      dataIndex: "joinedAt",
      key: "joinedAt",
      render: (t: number) => formatTimestamp(t),
    },
    {
      title: "最近活跃",
      dataIndex: "lastSeenAt",
      key: "lastSeenAt",
      render: (t: number) => formatTimestamp(t),
    },
  ];

  const historyMemberColumns: ColumnsType<AdminRoomMemberHistoryItem> = [
    {
      title: "参与成员",
      key: "user",
      render: (_, m) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar src={m.avatarUrl} icon={<UserOutlined />} size="small" />
          <div>
            <div style={{ fontWeight: 500 }}>{m.nickname || m.username || "匿名"}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {m.userId}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "身份",
      dataIndex: "role",
      key: "role",
      width: 80,
      render: (role: string) =>
        role === "host" ? (
          <Tag color="gold">房主</Tag>
        ) : (
          <Tag color="blue">成员</Tag>
        ),
    },
    {
      title: "入房时间",
      dataIndex: "joinedAt",
      key: "joinedAt",
      render: (t: number) => formatTimestampFull(t),
    },
    {
      title: "离房时间",
      dataIndex: "leftAt",
      key: "leftAt",
      render: (t: number | null) => (t ? formatTimestampFull(t) : "-"),
    },
    {
      title: "停留时长",
      dataIndex: "durationSeconds",
      key: "durationSeconds",
      width: 110,
      render: (sec: number) => formatDurationHuman(sec * 1000),
    },
    {
      title: "离房原因",
      dataIndex: "leaveReason",
      key: "leaveReason",
      width: 140,
      render: (reason: string | null) => {
        if (!reason) return <Tag>在房中</Tag>;
        const conf = LEAVE_REASON_MAP[reason] ?? { label: reason, color: "default" };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CustomerServiceOutlined style={{ color: "#1677ff", fontSize: 18 }} />
          <span>一起听房间详情</span>
          {type === "online" ? (
            <Tag color="green">在线活跃中</Tag>
          ) : (
            <Tag color="default">历史记录</Tag>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {errorMsg ? (
          <Empty description={errorMsg} style={{ margin: "40px 0" }} />
        ) : isOnline && onlineDetail ? (
          <div>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="房间名称" span={2}>
                <Text strong>{onlineDetail.roomName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="房间号">
                <Text copyable={{ text: onlineDetail.roomId }}>
                  {onlineDetail.roomId}
                </Text>
              </Descriptions.Item>

              <Descriptions.Item label="房主用户" span={2}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar src={onlineDetail.host.avatarUrl} icon={<UserOutlined />} size="small" />
                  <span>
                    {onlineDetail.host.nickname || onlineDetail.host.username || "未知"}
                  </span>
                  <Text type="secondary" copyable={{ text: onlineDetail.host.userId }}>
                    ({onlineDetail.host.userId})
                  </Text>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="房间人数">
                <Badge status="processing" color="green" />
                在线 <b>{onlineDetail.onlinePeople}</b> / 入房 <b>{onlineDetail.currentPeople}</b> / 上限 {onlineDetail.maxPeople} 人
              </Descriptions.Item>

              <Descriptions.Item label="切歌点歌权限">
                {onlineDetail.memberOperation ? (
                  <Tag color="cyan">允许所有成员控制</Tag>
                ) : (
                  <Tag color="purple">仅房主可控制</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatTimestamp(onlineDetail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="最近心跳/操作">
                {formatTimestamp(onlineDetail.updatedAt)}
              </Descriptions.Item>

              <Descriptions.Item label="累计统计" span={3}>
                <Space size="large" wrap>
                  <span>
                    历史峰值: <b>{onlineDetail.peakPeople}</b> 人
                  </span>
                  <span>
                    累计进房: <b>{onlineDetail.totalJoinCount}</b> 人次
                  </span>
                  <span>
                    独立访客: <b>{onlineDetail.uniquePeople}</b> 人
                  </span>
                  <span>
                    协议版本: v{onlineDetail.version}
                  </span>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: "16px 0 12px" }}>
              <span style={{ fontSize: 13, color: "#666" }}>当前播放曲目</span>
            </Divider>

            {onlineDetail.song ? (
              <Card size="small" style={{ background: "#fafafa" }}>
                <Row align="middle" gutter={16}>
                  <Col>
                    {onlineDetail.song.cover ? (
                      <Image
                        src={onlineDetail.song.cover}
                        width={54}
                        height={54}
                        style={{ borderRadius: 6, objectFit: "cover" }}
                        fallback="/static/account-avatars/default.jpg"
                      />
                    ) : (
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 6,
                          background: "#e0e0e0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <SoundOutlined style={{ fontSize: 20, color: "#999" }} />
                      </div>
                    )}
                  </Col>
                  <Col flex="auto">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Text strong style={{ fontSize: 15 }}>
                        {onlineDetail.song.name}
                      </Text>
                      <Tag color="geekblue">{onlineDetail.song.source.toUpperCase()}</Tag>
                      {PLAYBACK_STATUS_MAP[onlineDetail.playbackStatus] && (
                        <Tag color={PLAYBACK_STATUS_MAP[onlineDetail.playbackStatus].color}>
                          {PLAYBACK_STATUS_MAP[onlineDetail.playbackStatus].label}
                        </Tag>
                      )}
                    </div>
                    <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
                      歌手: {onlineDetail.song.singer} | 专辑: {onlineDetail.song.album || "-"}
                    </div>
                    <div style={{ color: "#888", marginTop: 2, fontSize: 12 }}>
                      进度: {formatSeconds(onlineDetail.position)} / {formatSeconds(onlineDetail.song.duration)}
                    </div>
                  </Col>
                </Row>
              </Card>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前未点播歌曲" style={{ margin: "8px 0" }} />
            )}

            <Divider style={{ margin: "16px 0 12px" }}>
              <span style={{ fontSize: 13, color: "#666" }}>
                房间内成员列表 ({onlineDetail.members.length} 人)
              </span>
            </Divider>

            <Table
              dataSource={onlineDetail.members}
              columns={onlineMemberColumns}
              rowKey="userId"
              size="small"
              pagination={false}
              bordered
            />
          </div>
        ) : isHistory && historyDetail ? (
          <div>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="房间名称" span={2}>
                <Text strong>{historyDetail.roomName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="房间号">
                <Text copyable={{ text: historyDetail.roomId }}>
                  {historyDetail.roomId}
                </Text>
              </Descriptions.Item>

              <Descriptions.Item label="初始房主">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Avatar src={historyDetail.initialHost.avatarUrl} icon={<UserOutlined />} size="small" />
                  <span>
                    {historyDetail.initialHost.nickname || historyDetail.initialHost.username || "未知"}
                  </span>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="最终房主">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Avatar src={historyDetail.finalHost.avatarUrl} icon={<UserOutlined />} size="small" />
                  <span>
                    {historyDetail.finalHost.nickname || historyDetail.finalHost.username || "未知"}
                  </span>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="生命周期状态">
                <Tag color="default">已结束归档</Tag>
              </Descriptions.Item>

              <Descriptions.Item label="创建时间">
                {formatTimestampFull(historyDetail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {formatTimestampFull(historyDetail.endedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="房间持续时长">
                <Tag color="blue">{formatDurationHuman(historyDetail.durationMs)}</Tag>
              </Descriptions.Item>

              <Descriptions.Item label="结束原因" span={2}>
                {historyDetail.endReason && END_REASON_MAP[historyDetail.endReason] ? (
                  <Tag color={END_REASON_MAP[historyDetail.endReason].color}>
                    {END_REASON_MAP[historyDetail.endReason].label}
                  </Tag>
                ) : (
                  <Tag>-</Tag>
                )}
                {historyDetail.endedByAdmin && (
                  <Text type="secondary" style={{ marginLeft: 6 }}>
                    (管理员: {historyDetail.endedByAdmin})
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="人数上限">
                {historyDetail.maxPeople} 人
              </Descriptions.Item>

              <Descriptions.Item label="生命周期统计" span={3}>
                <Space size="large" wrap>
                  <span>
                    历史最高峰值: <b>{historyDetail.peakPeople}</b> 人
                  </span>
                  <span>
                    累计进房人次: <b>{historyDetail.totalJoinCount}</b> 人次
                  </span>
                  <span>
                    独立参与人数: <b>{historyDetail.uniquePeople}</b> 人
                  </span>
                  <span>
                    结束时留存人数: <b>{historyDetail.finalPeople}</b> 人
                  </span>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: "16px 0 12px" }}>
              <span style={{ fontSize: 13, color: "#666" }}>结束时播放曲目</span>
            </Divider>

            {historyDetail.lastSong ? (
              <Card size="small" style={{ background: "#fafafa" }}>
                <Row align="middle" gutter={16}>
                  <Col>
                    {historyDetail.lastSong.cover ? (
                      <Image
                        src={historyDetail.lastSong.cover}
                        width={54}
                        height={54}
                        style={{ borderRadius: 6, objectFit: "cover" }}
                        fallback="/static/account-avatars/default.jpg"
                      />
                    ) : (
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 6,
                          background: "#e0e0e0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <SoundOutlined style={{ fontSize: 20, color: "#999" }} />
                      </div>
                    )}
                  </Col>
                  <Col flex="auto">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Text strong style={{ fontSize: 15 }}>
                        {historyDetail.lastSong.name}
                      </Text>
                      <Tag color="geekblue">{historyDetail.lastSong.source.toUpperCase()}</Tag>
                      {PLAYBACK_STATUS_MAP[historyDetail.finalPlaybackStatus] && (
                        <Tag color={PLAYBACK_STATUS_MAP[historyDetail.finalPlaybackStatus].color}>
                          {PLAYBACK_STATUS_MAP[historyDetail.finalPlaybackStatus].label}
                        </Tag>
                      )}
                    </div>
                    <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
                      歌手: {historyDetail.lastSong.singer} | 专辑: {historyDetail.lastSong.album || "-"}
                    </div>
                    <div style={{ color: "#888", marginTop: 2, fontSize: 12 }}>
                      播放进度: {formatSeconds(historyDetail.finalPosition)} / {formatSeconds(historyDetail.lastSong.duration)}
                    </div>
                  </Col>
                </Row>
              </Card>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无播放曲目记录" style={{ margin: "8px 0" }} />
            )}

            <Divider style={{ margin: "16px 0 12px" }}>
              <span style={{ fontSize: 13, color: "#666" }}>
                成员参与流水分段 ({historyDetail.members.length} 条记录)
              </span>
            </Divider>

            <Table
              dataSource={historyDetail.members}
              columns={historyMemberColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              bordered
            />
          </div>
        ) : null}
      </Spin>
    </Modal>
  );
}
