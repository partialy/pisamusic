import { useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
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
import { MODAL_BODY_SCROLL_CLASS, MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
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
        <div className="flex items-center gap-2">
          <Avatar src={m.avatarUrl} icon={<UserOutlined />} size="small" className="shrink-0" />
          <div>
            <div className="font-medium">{m.nickname || m.username || "匿名"}</div>
            <Text type="secondary" className="text-xs">
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
        <div className="flex items-center gap-2">
          <Avatar src={m.avatarUrl} icon={<UserOutlined />} size="small" className="shrink-0" />
          <div>
            <div className="font-medium">{m.nickname || m.username || "匿名"}</div>
            <Text type="secondary" className="text-xs">
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
      render: (t: number | null) => (t ? formatTimestampFull(t) : <Tag color="blue">在房至结束</Tag>),
    },
    {
      title: "停留时长",
      dataIndex: "durationSeconds",
      key: "durationSeconds",
      render: (s: number) => <Tag color="cyan">{formatDurationHuman(s * 1000)}</Tag>,
    },
    {
      title: "离开原因",
      dataIndex: "leaveReason",
      key: "leaveReason",
      render: (reason: string | null) => {
        if (!reason) return "-";
        const conf = LEAVE_REASON_MAP[reason] ?? { label: reason, color: "default" };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
  ];

  return (
    <Modal
      centered
      title={
        <ModalTitle
          icon={<CustomerServiceOutlined className="text-blue-500" />}
          title={type === "online" ? "在线房间实时状态与信令详情" : "房间生命周期历史与流水详情"}
        />
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={MODAL_WIDTH.xl}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <div className={MODAL_BODY_SCROLL_CLASS}>
          {errorMsg ? (
            <Empty description={errorMsg} className="my-10" />
          ) : isOnline && onlineDetail ? (
            <div>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} className="bg-slate-50/50 rounded-xl overflow-hidden">
                <Descriptions.Item label="房间名称" span={2}>
                  <Text strong>{onlineDetail.roomName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="房间号">
                  <Text copyable={{ text: onlineDetail.roomId }}>
                    {onlineDetail.roomId}
                  </Text>
                </Descriptions.Item>

                <Descriptions.Item label="房主用户" span={2}>
                  <div className="flex items-center gap-2">
                    <Avatar src={onlineDetail.host.avatarUrl} icon={<UserOutlined />} size="small" className="shrink-0" />
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

              <Divider className="!my-3">
                <span className="text-xs text-slate-500">当前播放曲目</span>
              </Divider>

              {onlineDetail.song ? (
                <Card size="small" className="bg-slate-50/70 border-slate-200 rounded-xl">
                  <Row align="middle" gutter={16}>
                    <Col>
                      {onlineDetail.song.cover ? (
                        <Image
                          src={onlineDetail.song.cover.replace("{size}", "120")}
                          width={54}
                          height={54}
                          className="rounded-md object-cover shrink-0"
                          fallback="/static/account-avatars/default.jpg"
                        />
                      ) : (
                        <div className="w-[54px] h-[54px] rounded-md bg-slate-100 flex items-center justify-center">
                          <SoundOutlined className="text-xl text-slate-400" />
                        </div>
                      )}
                    </Col>
                    <Col flex="auto">
                      <div className="flex items-center gap-2">
                        <Text strong className="text-sm">
                          {onlineDetail.song.name}
                        </Text>
                        <Tag color="geekblue">{onlineDetail.song.source.toUpperCase()}</Tag>
                        {PLAYBACK_STATUS_MAP[onlineDetail.playbackStatus] && (
                          <Tag color={PLAYBACK_STATUS_MAP[onlineDetail.playbackStatus].color}>
                            {PLAYBACK_STATUS_MAP[onlineDetail.playbackStatus].label}
                          </Tag>
                        )}
                      </div>
                      <div className="text-slate-600 mt-1 text-xs">
                        歌手: {onlineDetail.song.singer} | 专辑: {onlineDetail.song.album || "-"}
                      </div>
                      <div className="text-slate-400 mt-0.5 text-xs">
                        进度: {formatSeconds(onlineDetail.position)} / {formatSeconds(onlineDetail.song.duration)}
                      </div>
                    </Col>
                  </Row>
                </Card>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前未点播歌曲" className="!my-2" />
              )}

              <Divider className="!my-3">
                <span className="text-xs text-slate-500">
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
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} className="bg-slate-50/50 rounded-xl overflow-hidden">
                <Descriptions.Item label="房间名称" span={2}>
                  <Text strong>{historyDetail.roomName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="房间号">
                  <Text copyable={{ text: historyDetail.roomId }}>
                    {historyDetail.roomId}
                  </Text>
                </Descriptions.Item>

                <Descriptions.Item label="初始房主">
                  <div className="flex items-center gap-1.5">
                    <Avatar src={historyDetail.initialHost.avatarUrl} icon={<UserOutlined />} size="small" />
                    <span>
                      {historyDetail.initialHost.nickname || historyDetail.initialHost.username || "未知"}
                    </span>
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="最终房主">
                  <div className="flex items-center gap-1.5">
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
                    <Text type="secondary" className="ml-1.5">
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

              <Divider className="!my-3">
                <span className="text-xs text-slate-500">结束时播放曲目</span>
              </Divider>

              {historyDetail.lastSong ? (
                <Card size="small" className="bg-slate-50/70 border-slate-200 rounded-xl">
                  <Row align="middle" gutter={16}>
                    <Col>
                      {historyDetail.lastSong.cover ? (
                        <Image
                          src={historyDetail.lastSong.cover.replace("{size}", "120")}
                          width={54}
                          height={54}
                          className="rounded-md object-cover shrink-0"
                          fallback="/static/account-avatars/default.jpg"
                        />
                      ) : (
                        <div className="w-[54px] h-[54px] rounded-md bg-slate-100 flex items-center justify-center">
                          <SoundOutlined className="text-xl text-slate-400" />
                        </div>
                      )}
                    </Col>
                    <Col flex="auto">
                      <div className="flex items-center gap-2">
                        <Text strong className="text-sm">
                          {historyDetail.lastSong.name}
                        </Text>
                        <Tag color="geekblue">{historyDetail.lastSong.source.toUpperCase()}</Tag>
                        {PLAYBACK_STATUS_MAP[historyDetail.finalPlaybackStatus] && (
                          <Tag color={PLAYBACK_STATUS_MAP[historyDetail.finalPlaybackStatus].color}>
                            {PLAYBACK_STATUS_MAP[historyDetail.finalPlaybackStatus].label}
                          </Tag>
                        )}
                      </div>
                      <div className="text-slate-600 mt-1 text-xs">
                        歌手: {historyDetail.lastSong.singer} | 专辑: {historyDetail.lastSong.album || "-"}
                      </div>
                      <div className="text-slate-400 mt-0.5 text-xs">
                        播放进度: {formatSeconds(historyDetail.finalPosition)} / {formatSeconds(historyDetail.lastSong.duration)}
                      </div>
                    </Col>
                  </Row>
                </Card>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无播放曲目记录" className="!my-2" />
              )}

              <Divider className="!my-3">
                <span className="text-xs text-slate-500">
                  成员参与流水分段 ({historyDetail.members.length} 条记录)
                </span>
              </Divider>

              <Table
                dataSource={historyDetail.members}
                columns={historyMemberColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10, size: "small" }}
                bordered
              />
            </div>
          ) : null}
        </div>
      </Spin>
    </Modal>
  );
}
