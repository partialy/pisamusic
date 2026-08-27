import { useRouter } from "vue-router";

export const QUALITY_UNLOCK_FEEDBACK_QUERY_VALUE = "quality-unlock";

export function useQualityUnlockFeedback() {
  const router = useRouter();

  function openQualityUnlockFeedback() {
    return router.push({
      path: "/setting",
      query: {
        tab: "about",
        feedback: QUALITY_UNLOCK_FEEDBACK_QUERY_VALUE,
      },
    });
  }

  return {
    openQualityUnlockFeedback,
  };
}
