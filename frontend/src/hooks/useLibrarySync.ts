import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { useLibraryStore, getCurrentDevice } from "@/stores/libraryStore";
import { toSyncedLibraryPayload } from "@/utils/librarySync";
import type { SyncSessionDevice, SyncedLibraryPayload } from "@/types/library";

function getSyncWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";

  if (import.meta.env.DEV) {
    return "ws://localhost:3000/ws/sync";
  }

  return `${protocol}://${window.location.host}/ws/sync`;
}

export function useLibrarySync(): void {
  const [socketAttempt, setSocketAttempt] = useState(0);
  const snapshot = useLibraryStore((state) => state.snapshot);
  const ready = useLibraryStore((state) => state.ready);
  const syncStatus = useLibraryStore((state) => state.syncStatus);
  const setSyncStatus = useLibraryStore((state) => state.setSyncStatus);
  const applySyncSession = useLibraryStore((state) => state.applySyncSession);
  const updatePairedDevices = useLibraryStore((state) => state.updatePairedDevices);
  const mergeRemoteSnapshot = useLibraryStore((state) => state.mergeRemoteSnapshot);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastSentPayloadRef = useRef<string | null>(null);
  const lastRegisteredSessionRef = useRef<string | null>(null);

  const currentDevice = getCurrentDevice(snapshot);
  const currentDeviceId = currentDevice?.id ?? null;
  const currentDeviceName = currentDevice?.name ?? null;
  const currentDeviceKind = currentDevice?.kind ?? null;

  useEffect(() => {
    if (
      !ready ||
      !snapshot ||
      !currentDeviceId ||
      !currentDeviceName ||
      !currentDeviceKind
    ) {
      return;
    }

    const sessionId = snapshot.syncSessionId;
    const profileId = snapshot.profileId;
    const deviceId = currentDeviceId;
    const deviceName = currentDeviceName;
    const deviceKind = currentDeviceKind;

    let cancelled = false;

    async function bootstrapSyncSession() {
      setSyncStatus("connecting", { error: null });

      const response = await api.createSyncSession({
        sessionId,
        profileId,
        device: {
          id: deviceId,
          name: deviceName,
          kind: deviceKind,
        },
      });

      if (cancelled) {
        return;
      }

      if (!response.success || !response.data) {
        setSyncStatus("error", {
          error: response.error || "無法建立同步 session",
        });
        return;
      }

      await applySyncSession({
        ...response.data,
        pairCode: response.data.pairCode,
      });
    }

    void bootstrapSyncSession();

    return () => {
      cancelled = true;
    };
  }, [
    applySyncSession,
    currentDeviceId,
    currentDeviceKind,
    currentDeviceName,
    ready,
    setSyncStatus,
    snapshot?.profileId,
    snapshot?.syncSessionId,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !snapshot?.syncSessionId ||
      !currentDeviceId ||
      !currentDeviceName ||
      !currentDeviceKind
    ) {
      return;
    }

    const ws = new WebSocket(getSyncWebSocketUrl());
    let closedIntentionally = false;
    socketRef.current = ws;
    setSyncStatus("connecting", { error: null });

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      ws.send(
        JSON.stringify({
          type: "sync_register",
          sessionId: snapshot.syncSessionId,
          deviceId: currentDeviceId,
          deviceName: currentDeviceName,
          deviceKind: currentDeviceKind,
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as Record<string, unknown>;

        switch (message.type) {
          case "sync_registered":
            lastRegisteredSessionRef.current = String(message.sessionId ?? "");
            void applySyncSession({
              sessionId: String(message.sessionId ?? ""),
              pairCode: String(message.pairCode ?? ""),
              profileId: String(message.profileId ?? snapshot.profileId),
              devices: Array.isArray(message.devices)
                ? (message.devices as SyncSessionDevice[])
                : [],
            });
            setSyncStatus("connected", {
              pairCode: String(message.pairCode ?? ""),
              error: null,
            });
            ws.send(
              JSON.stringify({
                type: "sync_snapshot",
                sessionId: snapshot.syncSessionId,
                sourceDeviceId: currentDeviceId,
                payload: toSyncedLibraryPayload(useLibraryStore.getState().snapshot!),
              }),
            );
            break;

          case "sync_devices":
            if (Array.isArray(message.devices)) {
              void updatePairedDevices(message.devices as SyncSessionDevice[]);
            }
            break;

          case "sync_snapshot_request":
            ws.send(
              JSON.stringify({
                type: "sync_snapshot",
                sessionId: snapshot.syncSessionId,
                sourceDeviceId: currentDeviceId,
                payload: toSyncedLibraryPayload(useLibraryStore.getState().snapshot!),
              }),
            );
            break;

          case "sync_snapshot":
            if (message.payload) {
              void mergeRemoteSnapshot(message.payload as SyncedLibraryPayload);
            }
            break;

          case "sync_error":
            setSyncStatus("error", {
              error: String(message.error ?? "同步連線發生錯誤"),
            });
            break;

          default:
            break;
        }
      } catch {
        setSyncStatus("error", {
          error: "同步訊息解析失敗",
        });
      }
    };

    ws.onclose = () => {
      socketRef.current = null;

      if (closedIntentionally) {
        return;
      }

      if (lastRegisteredSessionRef.current !== snapshot.syncSessionId) {
        return;
      }

      if (reconnectAttemptsRef.current >= 5) {
        setSyncStatus("error", { error: "同步連線中斷" });
        return;
      }

      const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 8000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        setSyncStatus("connecting", { error: null });
        lastRegisteredSessionRef.current = null;
        setSocketAttempt((attempt) => attempt + 1);
      }, delay);
    };

    return () => {
      closedIntentionally = true;
      ws.close();
      socketRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [
    applySyncSession,
    currentDeviceId,
    currentDeviceKind,
    currentDeviceName,
    mergeRemoteSnapshot,
    ready,
    setSyncStatus,
    snapshot?.profileId,
    snapshot?.syncSessionId,
    socketAttempt,
    updatePairedDevices,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !snapshot?.syncSessionId ||
      !snapshot ||
      syncStatus !== "connected" ||
      socketRef.current?.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const payload = JSON.stringify(toSyncedLibraryPayload(snapshot));
    if (payload === lastSentPayloadRef.current) {
      return;
    }

    lastSentPayloadRef.current = payload;
    socketRef.current.send(
      JSON.stringify({
        type: "sync_snapshot",
        sessionId: snapshot.syncSessionId,
        sourceDeviceId: snapshot.deviceId,
        payload: JSON.parse(payload),
      }),
    );
  }, [ready, snapshot, syncStatus]);
}
