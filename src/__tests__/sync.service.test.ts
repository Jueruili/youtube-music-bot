import { describe, expect, test, beforeEach } from "bun:test";
import {
  __resetSyncServiceForTests,
  getSyncService,
} from "../services/sync.service.ts";

describe("SyncService", () => {
  beforeEach(() => {
    __resetSyncServiceForTests();
  });

  test("should create a session and reuse it on resume", () => {
    const syncService = getSyncService();

    const firstSession = syncService.createOrResumeSession({
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    const resumedSession = syncService.createOrResumeSession({
      sessionId: firstSession.sessionId,
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    expect(resumedSession.sessionId).toBe(firstSession.sessionId);
    expect(resumedSession.pairCode).toBe(firstSession.pairCode);
    expect(resumedSession.devices).toHaveLength(1);
  });

  test("should pair a second device via pair code", () => {
    const syncService = getSyncService();
    const session = syncService.createOrResumeSession({
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    const pairedSession = syncService.pairToSession({
      pairCode: session.pairCode,
      profileId: "profile-b",
      device: {
        id: "device-b",
        name: "Phone B",
        kind: "mobile",
      },
    });

    expect(pairedSession.profileId).toBe("profile-a");
    expect(pairedSession.devices.map((device) => device.id)).toEqual([
      "device-a",
      "device-b",
    ]);
  });

  test("should remove devices from a session", () => {
    const syncService = getSyncService();
    const session = syncService.createOrResumeSession({
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    syncService.pairToSession({
      pairCode: session.pairCode,
      profileId: "profile-a",
      device: {
        id: "device-b",
        name: "Phone B",
        kind: "mobile",
      },
    });

    syncService.removeDevice(session.sessionId, "device-b");

    expect(syncService.getDevices(session.sessionId).map((device) => device.id)).toEqual([
      "device-a",
    ]);
  });
});
