import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import api from "../routes/api.ts";
import { __resetSyncServiceForTests } from "../services/sync.service.ts";

describe("/api/sync", () => {
  beforeEach(() => {
    __resetSyncServiceForTests();
  });

  afterEach(() => {
    __resetSyncServiceForTests();
  });

  test("should create a sync session", async () => {
    const response = await api.request("/sync/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "profile-a",
        device: {
          id: "device-a",
          name: "Desktop A",
          kind: "desktop",
        },
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data: {
        profileId: string;
        devices: Array<{ id: string }>;
        pairCode: string;
        sessionId: string;
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.profileId).toBe("profile-a");
    expect(payload.data.devices).toHaveLength(1);
  });

  test("should pair into an existing sync session", async () => {
    const createResponse = await api.request("/sync/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "profile-a",
        device: {
          id: "device-a",
          name: "Desktop A",
          kind: "desktop",
        },
      }),
    });
    const created = (await createResponse.json()) as {
      data: { pairCode: string; sessionId: string };
    };

    const pairResponse = await api.request("/sync/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairCode: created.data.pairCode,
        profileId: "profile-b",
        device: {
          id: "device-b",
          name: "Phone B",
          kind: "mobile",
        },
      }),
    });

    expect(pairResponse.status).toBe(200);
    const payload = (await pairResponse.json()) as {
      data: { devices: Array<{ id: string }> };
    };
    expect(payload.data.devices.map((device: { id: string }) => device.id)).toEqual([
      "device-a",
      "device-b",
    ]);
  });

  test("should reject invalid pair codes", async () => {
    const response = await api.request("/sync/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairCode: "AAAAAA",
        profileId: "profile-a",
        device: {
          id: "device-a",
          name: "Desktop A",
          kind: "desktop",
        },
      }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: "Invalid pair code",
    });
  });

  test("should list and remove synced devices", async () => {
    const createResponse = await api.request("/sync/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "profile-a",
        device: {
          id: "device-a",
          name: "Desktop A",
          kind: "desktop",
        },
      }),
    });
    const created = (await createResponse.json()) as {
      data: { pairCode: string; sessionId: string };
    };

    await api.request("/sync/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairCode: created.data.pairCode,
        profileId: "profile-a",
        device: {
          id: "device-b",
          name: "Phone B",
          kind: "mobile",
        },
      }),
    });

    const devicesResponse = await api.request(
      `/sync/devices?sessionId=${created.data.sessionId}`,
    );
    expect(devicesResponse.status).toBe(200);
    const devicesPayload = (await devicesResponse.json()) as {
      data: { devices: Array<{ id: string }> };
    };
    expect(devicesPayload.data.devices).toHaveLength(2);

    const removeResponse = await api.request(
      `/sync/devices/device-b?sessionId=${created.data.sessionId}`,
      {
        method: "DELETE",
      },
    );
    expect(removeResponse.status).toBe(200);

    const updatedDevicesResponse = await api.request(
      `/sync/devices?sessionId=${created.data.sessionId}`,
    );
    const updatedDevicesPayload = (await updatedDevicesResponse.json()) as {
      data: { devices: Array<{ id: string }> };
    };
    expect(updatedDevicesPayload.data.devices.map((device: { id: string }) => device.id)).toEqual([
      "device-a",
    ]);
  });
});
