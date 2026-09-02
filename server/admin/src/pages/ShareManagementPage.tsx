import { useCallback, useEffect, useState } from "react";
import type { AdminShareFilter, AdminShareListItem } from "../types/config";
import { fetchAdminShares, invalidateAdminShare } from "../api/client";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import ShareManagementTab from "../components/tabs/ShareManagementTab";

export default function ShareManagementPage() {
  const { themeColor } = useAdminLayout();

  const [shareItems, setShareItems] = useState<AdminShareListItem[]>([]);
  const [shareTotal, setShareTotal] = useState(0);
  const [shareOffset, setShareOffset] = useState(0);
  const [shareLimit] = useState(20);
  const [shareFilter, setShareFilter] = useState<AdminShareFilter>({ valid: "all" });
  const [shareLoading, setShareLoading] = useState(false);
  const [invalidatingShareId, setInvalidatingShareId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    setShareLoading(true);
    try {
      const result = await fetchAdminShares({
        ...shareFilter,
        offset: shareOffset,
        limit: shareLimit,
      });
      setShareItems(result.items);
      setShareTotal(result.total);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载分享记录失败");
    } finally {
      setShareLoading(false);
    }
  }, [shareFilter, shareOffset, shareLimit]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const handleShareFilterChange = (next: AdminShareFilter) => {
    setShareFilter(next);
    setShareOffset(0);
  };

  const handleInvalidateShare = async (share: AdminShareListItem) => {
    if (!share.valid) return;
    if (
      !window.confirm(
        `确定要将分享“${share.title || share.uuid}”标记为失效吗？失效后公开链接将不可继续读取。`,
      )
    )
      return;
    setInvalidatingShareId(share.uuid);
    try {
      await invalidateAdminShare(share.uuid);
      await loadShares();
    } catch (e) {
      alert(e instanceof Error ? e.message : "标记分享失效失败");
    } finally {
      setInvalidatingShareId(null);
    }
  };

  return (
    <ShareManagementTab
      items={shareItems}
      total={shareTotal}
      offset={shareOffset}
      limit={shareLimit}
      filter={shareFilter}
      loading={shareLoading}
      invalidatingId={invalidatingShareId}
      themeColor={themeColor}
      onFilterChange={handleShareFilterChange}
      onPageChange={setShareOffset}
      onRefresh={() => void loadShares()}
      onInvalidate={(share) => void handleInvalidateShare(share)}
    />
  );
}
