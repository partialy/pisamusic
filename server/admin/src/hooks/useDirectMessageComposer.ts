import { message } from "antd";
import { useCallback, useState } from "react";
import { sendDirectMessage } from "../api/client";
import type { DirectMessageComposeTarget } from "../components/modals/DirectMessageComposeModal";

type MessageSentHandler = (target: DirectMessageComposeTarget) => Promise<void> | void;

export function useDirectMessageComposer(onSent?: MessageSentHandler) {
  const [target, setTarget] = useState<DirectMessageComposeTarget | null>(null);
  const [sending, setSending] = useState(false);

  const openComposer = useCallback((nextTarget: DirectMessageComposeTarget) => {
    setTarget(nextTarget);
  }, []);

  const closeComposer = useCallback(() => {
    if (!sending) setTarget(null);
  }, [sending]);

  const submit = useCallback(async (content: string) => {
    if (!target) return;
    setSending(true);
    try {
      await sendDirectMessage({
        targetKind: target.kind,
        targetId: target.id,
        content,
      });
      message.success("留言已发送");
      setTarget(null);
      await onSent?.(target);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "发送留言失败");
      throw error;
    } finally {
      setSending(false);
    }
  }, [onSent, target]);

  return {
    target,
    sending,
    openComposer,
    closeComposer,
    submit,
  };
}
