import type { ServerWebSocket } from "bun";

export interface SyncDeviceInput {
  id: string;
  name: string;
  kind: "desktop" | "mobile";
}

export interface SyncSessionDevice {
  id: string;
  name: string;
  kind: "desktop" | "mobile";
  connected: boolean;
  pairedAt: string;
  lastSeenAt: string;
}

export interface SyncSessionResponse {
  sessionId: string;
  pairCode: string;
  profileId: string;
  devices: SyncSessionDevice[];
}

type SyncSession = {
  id: string;
  profileId: string;
  pairCode: string;
  devices: Map<string, SyncSessionDevice>;
};

type SyncSocketData = {
  sessionId: string;
  deviceId: string;
};

const PAIR_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

class SyncService {
  private static instance: SyncService | undefined;
  private sessions = new Map<string, SyncSession>();
  private pairCodeToSessionId = new Map<string, string>();
  private socketByDeviceKey = new Map<string, ServerWebSocket<any>>();
  private socketByConnection = new Map<ServerWebSocket<any>, SyncSocketData>();

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }

    return SyncService.instance;
  }

  static resetInstanceForTests(): void {
    SyncService.instance = undefined;
  }

  createOrResumeSession(input: {
    sessionId?: string | null;
    profileId: string;
    device: SyncDeviceInput;
  }): SyncSessionResponse {
    const existingSession =
      input.sessionId && this.sessions.has(input.sessionId)
        ? this.sessions.get(input.sessionId)!
        : null;

    const session =
      existingSession ??
      this.createSession({
        profileId: input.profileId,
      });

    this.upsertDevice(session, input.device);
    return this.serializeSession(session);
  }

  pairToSession(input: {
    pairCode: string;
    profileId: string;
    device: SyncDeviceInput;
  }): SyncSessionResponse {
    const normalizedPairCode = input.pairCode.trim().toUpperCase();
    const sessionId = this.pairCodeToSessionId.get(normalizedPairCode);

    if (!sessionId) {
      throw new Error("Invalid pair code");
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Sync session not found");
    }

    this.upsertDevice(session, input.device);
    return this.serializeSession(session);
  }

  getDevices(sessionId: string): SyncSessionDevice[] {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error("Sync session not found");
    }

    return this.serializeSession(session).devices;
  }

  removeDevice(sessionId: string, deviceId: string): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error("Sync session not found");
    }

    session.devices.delete(deviceId);
    const socketKey = this.getSocketKey(sessionId, deviceId);
    const socket = this.socketByDeviceKey.get(socketKey);
    if (socket) {
      try {
        socket.close();
      } catch {
        // no-op
      }
    }
    this.socketByDeviceKey.delete(socketKey);

    if (session.devices.size === 0) {
      this.sessions.delete(session.id);
      this.pairCodeToSessionId.delete(session.pairCode);
      return;
    }

    this.broadcastDevices(session);
  }

  registerConnection(
    ws: ServerWebSocket<any>,
    input: {
      sessionId: string;
      device: SyncDeviceInput;
    },
  ): SyncSessionResponse {
    const session = this.sessions.get(input.sessionId);

    if (!session) {
      throw new Error("Sync session not found");
    }

    const device = this.upsertDevice(session, input.device, true);
    this.socketByConnection.set(ws, {
      sessionId: session.id,
      deviceId: device.id,
    });
    this.socketByDeviceKey.set(this.getSocketKey(session.id, device.id), ws);

    const serialized = this.serializeSession(session);
    this.send(ws, {
      type: "sync_registered",
      ...serialized,
    });
    this.broadcastDevices(session);
    this.broadcastToOthers(session.id, device.id, {
      type: "sync_snapshot_request",
      requesterDeviceId: device.id,
    });

    return serialized;
  }

  relaySnapshot(
    sessionId: string,
    sourceDeviceId: string,
    payload: unknown,
  ): void {
    this.broadcastToOthers(sessionId, sourceDeviceId, {
      type: "sync_snapshot",
      sourceDeviceId,
      payload,
    });
  }

  disconnectConnection(ws: ServerWebSocket<any>): void {
    const connection = this.socketByConnection.get(ws);
    if (!connection) {
      return;
    }

    this.socketByConnection.delete(ws);
    this.socketByDeviceKey.delete(
      this.getSocketKey(connection.sessionId, connection.deviceId),
    );

    const session = this.sessions.get(connection.sessionId);
    if (!session) {
      return;
    }

    const device = session.devices.get(connection.deviceId);
    if (device) {
      device.connected = false;
      device.lastSeenAt = new Date().toISOString();
    }

    this.broadcastDevices(session);
  }

  private createSession(input: { profileId: string }): SyncSession {
    const sessionId = crypto.randomUUID();
    const session: SyncSession = {
      id: sessionId,
      profileId: input.profileId,
      pairCode: this.generatePairCode(),
      devices: new Map(),
    };

    this.sessions.set(sessionId, session);
    this.pairCodeToSessionId.set(session.pairCode, session.id);
    return session;
  }

  private upsertDevice(
    session: SyncSession,
    deviceInput: SyncDeviceInput,
    connected: boolean = false,
  ): SyncSessionDevice {
    const now = new Date().toISOString();
    const existingDevice = session.devices.get(deviceInput.id);
    const device: SyncSessionDevice = {
      id: deviceInput.id,
      name: deviceInput.name,
      kind: deviceInput.kind,
      connected,
      pairedAt: existingDevice?.pairedAt ?? now,
      lastSeenAt: now,
    };

    session.devices.set(device.id, device);
    return device;
  }

  private broadcastDevices(session: SyncSession): void {
    const devices = this.serializeSession(session).devices;
    this.broadcastToSession(session.id, {
      type: "sync_devices",
      devices,
    });
  }

  private broadcastToSession(sessionId: string, message: Record<string, unknown>): void {
    for (const [socket, connection] of this.socketByConnection.entries()) {
      if (connection.sessionId !== sessionId) {
        continue;
      }

      this.send(socket, message);
    }
  }

  private broadcastToOthers(
    sessionId: string,
    sourceDeviceId: string,
    message: Record<string, unknown>,
  ): void {
    for (const [socket, connection] of this.socketByConnection.entries()) {
      if (
        connection.sessionId !== sessionId ||
        connection.deviceId === sourceDeviceId
      ) {
        continue;
      }

      this.send(socket, message);
    }
  }

  private send(ws: ServerWebSocket<any>, message: Record<string, unknown>): void {
    ws.send(JSON.stringify(message));
  }

  private serializeSession(session: SyncSession): SyncSessionResponse {
    return {
      sessionId: session.id,
      pairCode: session.pairCode,
      profileId: session.profileId,
      devices: Array.from(session.devices.values()).sort((left, right) =>
        left.pairedAt.localeCompare(right.pairedAt),
      ),
    };
  }

  private getSocketKey(sessionId: string, deviceId: string): string {
    return `${sessionId}:${deviceId}`;
  }

  private generatePairCode(): string {
    let pairCode = "";

    while (!pairCode || this.pairCodeToSessionId.has(pairCode)) {
      pairCode = Array.from({ length: 6 }, () => {
        const index = Math.floor(Math.random() * PAIR_CODE_ALPHABET.length);
        return PAIR_CODE_ALPHABET[index];
      }).join("");
    }

    return pairCode;
  }
}

export function getSyncService(): SyncService {
  return SyncService.getInstance();
}

export function __resetSyncServiceForTests(): void {
  SyncService.resetInstanceForTests();
}
