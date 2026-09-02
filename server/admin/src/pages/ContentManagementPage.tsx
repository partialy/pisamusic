import { useMemo, useState } from "react";
import { useAdminConfigWorkspace } from "../state/AdminConfigWorkspaceContext";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import ContentTab from "../components/tabs/ContentTab";

export default function ContentManagementPage() {
  const { themeColor } = useAdminLayout();
  const { appConfig, appConfigServer, updateSection, saveConfigSections } = useAdminConfigWorkspace();

  const [contentSaving, setContentSaving] = useState(false);

  const contentDirty = useMemo(
    () =>
      JSON.stringify({
        agreement: appConfig.agreement,
        privacy: appConfig.privacy,
        about: appConfig.about,
      }) !==
      JSON.stringify({
        agreement: appConfigServer.agreement,
        privacy: appConfigServer.privacy,
        about: appConfigServer.about,
      }),
    [appConfig, appConfigServer],
  );

  const handleSaveContent = async () => {
    await saveConfigSections(
      {
        agreement: appConfig.agreement,
        privacy: appConfig.privacy,
        about: appConfig.about,
      },
      setContentSaving,
      "保存内容与协议失败",
    );
  };

  return (
    <ContentTab
      config={appConfig}
      themeColor={themeColor}
      dirty={contentDirty}
      saving={contentSaving}
      updateSection={updateSection}
      onSave={() => void handleSaveContent()}
    />
  );
}
