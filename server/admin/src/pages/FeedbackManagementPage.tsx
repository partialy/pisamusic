import { useCallback, useEffect, useState } from "react";
import type {
  AdminFeedbackDetail,
  AdminFeedbackFilter,
  AdminFeedbackListItem,
  FeedbackStatus,
} from "../types/config";
import {
  fetchAdminFeedback,
  fetchAdminFeedbackDetail,
  updateAdminFeedbackStatus,
} from "../api/client";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import FeedbackManagementTab from "../components/tabs/FeedbackManagementTab";
import FeedbackDetailModal from "../components/modals/FeedbackDetailModal";

export default function FeedbackManagementPage() {
  const { themeColor } = useAdminLayout();

  const [feedbackItems, setFeedbackItems] = useState<AdminFeedbackListItem[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackOffset, setFeedbackOffset] = useState(0);
  const [feedbackLimit] = useState(20);
  const [feedbackFilter, setFeedbackFilter] = useState<AdminFeedbackFilter>({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<AdminFeedbackDetail | null>(null);

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const result = await fetchAdminFeedback({
        ...feedbackFilter,
        offset: feedbackOffset,
        limit: feedbackLimit,
      });
      setFeedbackItems(result.items);
      setFeedbackTotal(result.total);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载反馈列表失败");
    } finally {
      setFeedbackLoading(false);
    }
  }, [feedbackFilter, feedbackOffset, feedbackLimit]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const handleFeedbackFilterChange = (next: AdminFeedbackFilter) => {
    setFeedbackFilter(next);
    setFeedbackOffset(0);
  };

  const handleViewFeedback = async (feedback: AdminFeedbackListItem) => {
    try {
      setSelectedFeedback(await fetchAdminFeedbackDetail(feedback.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载反馈详情失败");
    }
  };

  const handleFeedbackStatusChange = async (id: string, status: FeedbackStatus) => {
    setUpdatingFeedbackId(id);
    try {
      const updated = await updateAdminFeedbackStatus(id, status);
      if (selectedFeedback?.id === id) setSelectedFeedback(updated);
      await loadFeedback();
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新反馈状态失败");
    } finally {
      setUpdatingFeedbackId(null);
    }
  };

  return (
    <>
      <FeedbackManagementTab
        items={feedbackItems}
        total={feedbackTotal}
        offset={feedbackOffset}
        limit={feedbackLimit}
        filter={feedbackFilter}
        loading={feedbackLoading}
        updatingId={updatingFeedbackId}
        themeColor={themeColor}
        onFilterChange={handleFeedbackFilterChange}
        onPageChange={setFeedbackOffset}
        onRefresh={() => void loadFeedback()}
        onView={(feedback) => void handleViewFeedback(feedback)}
        onStatusChange={(feedback, status) => void handleFeedbackStatusChange(feedback.id, status)}
      />

      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          updating={updatingFeedbackId === selectedFeedback.id}
          themeColor={themeColor}
          onStatusChange={(status) => void handleFeedbackStatusChange(selectedFeedback.id, status)}
          onClose={() => setSelectedFeedback(null)}
        />
      )}
    </>
  );
}
