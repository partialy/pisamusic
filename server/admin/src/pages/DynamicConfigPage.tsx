import { useState } from "react";
import type { DynamicConfigItem } from "../types/config";
import {
  createDynamicConfig,
  deleteDynamicConfig as deleteDynamicConfigApi,
  updateDynamicConfig,
} from "../api/client";
import { useAdminConfigWorkspace } from "../state/AdminConfigWorkspaceContext";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import DynamicConfigTab from "../components/tabs/DynamicConfigTab";
import DynamicConfigModal from "../components/modals/DynamicConfigModal";

const NEW_DYNAMIC_CONFIG: DynamicConfigItem = {
  id: "",
  type: "string",
  content: "",
  createdAt: 0,
  updatedAt: 0,
};

export default function DynamicConfigPage() {
  const { themeColor } = useAdminLayout();
  const { dynamicConfigs, setDynamicConfigs, dynamicConfigLoading } = useAdminConfigWorkspace();

  const [editingDynamicConfig, setEditingDynamicConfig] = useState<DynamicConfigItem | null>(null);
  const [editingDynamicConfigIsNew, setEditingDynamicConfigIsNew] = useState(true);
  const [dynamicConfigSaving, setDynamicConfigSaving] = useState(false);

  const handleAddDynamicConfig = () => {
    setEditingDynamicConfigIsNew(true);
    setEditingDynamicConfig({ ...NEW_DYNAMIC_CONFIG });
  };

  const handleEditDynamicConfig = (item: DynamicConfigItem) => {
    setEditingDynamicConfigIsNew(false);
    setEditingDynamicConfig({ ...item });
  };

  const handleSaveDynamicConfig = async () => {
    if (!editingDynamicConfig) return;
    setDynamicConfigSaving(true);
    try {
      const payload = {
        id: editingDynamicConfig.id,
        type: editingDynamicConfig.type,
        content: editingDynamicConfig.content,
      };
      const saved = editingDynamicConfigIsNew
        ? await createDynamicConfig(payload)
        : await updateDynamicConfig(editingDynamicConfig.id, payload);
      setDynamicConfigs((prev) => {
        const next = prev.filter((item) => item.id !== saved.id);
        return [saved, ...next];
      });
      setEditingDynamicConfig(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存动态配置失败");
    } finally {
      setDynamicConfigSaving(false);
    }
  };

  const handleDeleteDynamicConfig = async (item: DynamicConfigItem) => {
    if (!window.confirm(`确定要删除动态配置 ${item.id} 吗？`)) return;
    try {
      await deleteDynamicConfigApi(item.id);
      setDynamicConfigs((prev) => prev.filter((current) => current.id !== item.id));
      if (editingDynamicConfig?.id === item.id) {
        setEditingDynamicConfig(null);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除动态配置失败");
    }
  };

  return (
    <>
      <DynamicConfigTab
        items={dynamicConfigs}
        themeColor={themeColor}
        loading={dynamicConfigLoading}
        onCreate={handleAddDynamicConfig}
        onEdit={handleEditDynamicConfig}
        onDelete={(item) => void handleDeleteDynamicConfig(item)}
      />

      {editingDynamicConfig && (
        <DynamicConfigModal
          editing={editingDynamicConfig}
          isNew={editingDynamicConfigIsNew}
          themeColor={themeColor}
          saving={dynamicConfigSaving}
          onClose={() => setEditingDynamicConfig(null)}
          onChange={setEditingDynamicConfig}
          onSave={() => void handleSaveDynamicConfig()}
        />
      )}
    </>
  );
}
