import { useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { usePlayerStore } from "@/stores/playerStore";
import type { WSMessage } from "@/types";
import { mergePlaybackStateDuringTrackTransition } from "@/utils/playbackStateTransition";
import { getWebSocketUrl } from "@/utils/websocket-url";

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalCloseRef = useRef(new WeakSet<WebSocket>());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  // 從 store 獲取 setter 函數（只獲取一次）
  const setConnectionStatus = usePlayerStore(
    (state) => state.setConnectionStatus,
  );
  const setPlaybackState = usePlayerStore((state) => state.setPlaybackState);
  const updatePlaybackState = usePlayerStore(
    (state) => state.updatePlaybackState,
  );
  const updatePlaybackProgress = usePlayerStore(
    (state) => state.updatePlaybackProgress,
  );
  const setLyrics = usePlayerStore((state) => state.setLyrics);
  const { showToast } = useToast();

  const handleMessage = useCallback(
    (message: WSMessage) => {
      switch (message.type) {
        case "playback_state": {
          if (message.state.currentTrack || message.state.queue.length > 0) {
            usePlayerStore.getState().setLoadingTrack(false);
          }

          const previousState = usePlayerStore.getState().playbackState;
          setPlaybackState(
            mergePlaybackStateDuringTrackTransition(
              message.state,
              previousState,
            ),
          );
          break;
        }

        case "now_playing":
          // 開始播放 → 清除載入狀態
          usePlayerStore.getState().setLoadingTrack(false);
          updatePlaybackState({
            currentTrack: message.track,
            position: message.position,
            duration: message.duration,
            isPlaying: true,
          });
          break;

        case "queue_updated":
          updatePlaybackState({ queue: message.queue });
          break;

        case "playback_progress":
          updatePlaybackProgress(message.progress);
          break;

        case "play_error":
          usePlayerStore.getState().setLoadingTrack(false);
          showToast({
            message: message.track
              ? `無法播放「${message.track.title}」：${message.error}`
              : `播放失敗：${message.error}`,
            type: "error",
            duration: 5000,
          });
          console.error("播放失敗:", message.error, message.track);
          break;

        case "lyrics":
          setLyrics(message.lyrics);
          break;

        case "track_ended":
          updatePlaybackState({
            currentTrack: null,
            position: 0,
            duration: 0,
            isPlaying: false,
          });
          setLyrics([]);
          break;

        case "play":
          // 開始播放 → 清除載入狀態
          usePlayerStore.getState().setLoadingTrack(false);
          updatePlaybackState({ isPlaying: true });
          break;

        case "pause":
          updatePlaybackState({ isPlaying: false });
          break;

        default:
          console.log("未處理的訊息類型:", message);
      }
    },
    [
      setPlaybackState,
      updatePlaybackProgress,
      updatePlaybackState,
      setLyrics,
      showToast,
    ],
  );

  const connect = useCallback(() => {
    const currentSocket = wsRef.current;
    if (
      !mountedRef.current ||
      currentSocket?.readyState === WebSocket.OPEN ||
      currentSocket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus("connecting");

    const wsUrl = getWebSocketUrl("/ws");

    console.log(
      "嘗試連接 WebSocket:",
      wsUrl,
      `(protocol: ${window.location.protocol})`,
    );
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const isCurrentSocket = () => wsRef.current === ws;
    const isIntentionalClose = () => intentionalCloseRef.current.has(ws);

    ws.onopen = () => {
      if (!isCurrentSocket()) {
        intentionalCloseRef.current.add(ws);
        ws.close(1000, "stale socket");
        return;
      }

      console.log("WebSocket 已連線");
      setConnectionStatus("connected");
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      if (!isCurrentSocket()) {
        return;
      }

      try {
        const message: WSMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error("解析 WebSocket 訊息失敗:", error);
      }
    };

    ws.onerror = (error) => {
      if (isIntentionalClose() || !isCurrentSocket()) {
        return;
      }

      console.error("WebSocket 連線錯誤:", {
        url: wsUrl,
        readyState: ws.readyState,
        error,
      });
    };

    ws.onclose = (event) => {
      const isCurrent = isCurrentSocket();
      const intentional = isIntentionalClose();

      if (isCurrent) {
        wsRef.current = null;
        setConnectionStatus("disconnected");
      }

      if (intentional || !isCurrent) {
        return;
      }

      console.warn("WebSocket 已斷線", {
        code: event.code,
        reason: event.reason || null,
        wasClean: event.wasClean,
      });

      if (!mountedRef.current) {
        return;
      }

      // 指數退避重連，最多嘗試 5 次
      if (reconnectAttemptsRef.current < 5) {
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          10000,
        );
        reconnectAttemptsRef.current++;

        console.log(
          `將在 ${delay}ms 後重新連線 (第 ${reconnectAttemptsRef.current} 次)...`,
        );
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        console.error("WebSocket 重連次數已達上限，停止重連");
      }
    };
  }, [setConnectionStatus, handleMessage]);

  const disconnect = useCallback(() => {
    mountedRef.current = false;
    reconnectAttemptsRef.current = 0;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const currentSocket = wsRef.current;
    if (currentSocket) {
      intentionalCloseRef.current.add(currentSocket);
      wsRef.current = null;
      currentSocket.close(1000, "component disconnected");
    }

    setConnectionStatus("disconnected");
  }, [setConnectionStatus]);

  useEffect(() => {
    mountedRef.current = true;
    const connectTimeoutId = window.setTimeout(() => {
      connect();
    }, 0);

    return () => {
      window.clearTimeout(connectTimeoutId);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
  };
};
