import { useEffect, useState } from "react";
import { fetchLatestUpdate } from "../api/update";
import type { AppUpdateInfo } from "../types/update";

export type UpdateState = {
  data: AppUpdateInfo | null;
  loading: boolean;
  error: string | null;
};

export function useUpdateInfo(): UpdateState {
  const [state, setState] = useState<UpdateState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    fetchLatestUpdate()
      .then((data) => {
        if (mounted) setState({ data, loading: false, error: null });
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "获取下载地址失败，稍后重试";
        if (mounted) setState({ data: null, loading: false, error: msg });
      });

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
