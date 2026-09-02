import { useMemo, useState } from "react";
import { DEFAULT_PLAINTEXT_PATHS } from "../types/config";
import { fetchEncryptionConfig, saveEncryptionConfig } from "../api/client";
import { useAdminConfigWorkspace } from "../state/AdminConfigWorkspaceContext";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import EncryptionTab from "../components/tabs/EncryptionTab";

export default function EncryptionPage() {
  const { themeColor } = useAdminLayout();
  const {
    encryptionPathsServer,
    setEncryptionPathsServer,
    encryptionPathsDraft,
    setEncryptionPathsDraft,
    setAppConfig,
  } = useAdminConfigWorkspace();

  const [encryptionSaving, setEncryptionSaving] = useState(false);

  const encryptionDirty = useMemo(() => {
    if (encryptionPathsServer.length !== encryptionPathsDraft.length) return true;
    for (let i = 0; i < encryptionPathsServer.length; i += 1) {
      if (encryptionPathsServer[i] !== encryptionPathsDraft[i]) return true;
    }
    return false;
  }, [encryptionPathsServer, encryptionPathsDraft]);

  const handleSaveEncryption = async () => {
    setEncryptionSaving(true);
    try {
      const result = await saveEncryptionConfig(encryptionPathsDraft);
      setEncryptionPathsServer(result.plaintextPaths);
      setEncryptionPathsDraft(result.plaintextPaths);
      setAppConfig((prev) => ({
        ...prev,
        encryption: { plaintextPaths: result.plaintextPaths },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      alert(msg);
    } finally {
      setEncryptionSaving(false);
    }
  };

  const handleReloadEncryption = async () => {
    try {
      const enc = await fetchEncryptionConfig();
      setEncryptionPathsServer(enc.plaintextPaths);
      setEncryptionPathsDraft(enc.plaintextPaths);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "拉取失败";
      alert(msg);
    }
  };

  return (
    <EncryptionTab
      paths={encryptionPathsDraft}
      themeColor={themeColor}
      saving={encryptionSaving}
      dirty={encryptionDirty}
      onChange={setEncryptionPathsDraft}
      onSave={() => void handleSaveEncryption()}
      onResetToDefault={() => setEncryptionPathsDraft([...DEFAULT_PLAINTEXT_PATHS])}
      onReloadFromServer={() => void handleReloadEncryption()}
    />
  );
}
