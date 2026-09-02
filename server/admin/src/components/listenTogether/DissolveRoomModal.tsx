import { Alert, Button, Descriptions, Modal, Space, Tag, Typography } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import type { AdminOnlineRoomListItem } from "../../api/listenTogetherAdmin";

const { Text } = Typography;

type Props = {
  open: boolean;
  room: AdminOnlineRoomListItem | null;
  loading: boolean;
  onConfirm: (recordId: string) => Promise<void>;
  onCancel: () => void;
};

export default function DissolveRoomModal({
  open,
  room,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  if (!room) return null;

  const handleConfirm = async () => {
    await onConfirm(room.recordId);
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ff4d4f" }}>
          <ExclamationCircleOutlined style={{ fontSize: 20 }} />
          <span>确认安全解散该一起听房间？</span>
        </div>
      }
      open={open}
      onCancel={loading ? undefined : onCancel}
      footer={[
        <Button key="cancel" disabled={loading} onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          danger
          loading={loading}
          onClick={() => void handleConfirm()}
        >
          确认解散房间
        </Button>,
      ]}
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="解散操作不可撤销"
        description="系统将立即向房间内所有在线成员下发 ROOM_DESTROYED 广播，清除所有成员在房映射与离线重连定时器，并将房间生命周期历史标记为管理员安全解散（admin_dissolved）。"
      />

      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="房间名称">
          <Text strong>{room.roomName}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="房间号">
          <Text copyable={{ text: room.roomId }}>{room.roomId}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="房主用户">
          {room.host.nickname || room.host.username || "匿名"} ({room.host.userId})
        </Descriptions.Item>
        <Descriptions.Item label="当前在房人数">
          在线 <b>{room.onlinePeople}</b> 人 / 当前入房 <b>{room.currentPeople}</b> 人 (上限 {room.maxPeople} 人)
        </Descriptions.Item>
        <Descriptions.Item label="当前播放曲目">
          {room.song ? (
            <Space>
              <span>{room.song.name} - {room.song.singer}</span>
              <Tag color="geekblue">{room.song.source.toUpperCase()}</Tag>
            </Space>
          ) : (
            <Text type="secondary">无播放歌曲</Text>
          )}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
}
