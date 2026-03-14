import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import api from "../routes/api.ts";
import {
  __resetQueueServiceForTests,
  getQueueService,
} from "../services/queue.service.ts";

type RestorableMethod = {
  target: Record<string, unknown>;
  key: string;
  original: unknown;
};

const restores: RestorableMethod[] = [];

function stubMethod<T extends object, K extends keyof T>(
  target: T,
  key: K,
  replacement: T[K],
): void {
  restores.push({
    target: target as Record<string, unknown>,
    key: key as string,
    original: target[key],
  });
  target[key] = replacement;
}

function restoreMethods(): void {
  while (restores.length > 0) {
    const restore = restores.pop()!;
    restore.target[restore.key] = restore.original;
  }
}

describe("/api/radio", () => {
  beforeEach(() => {
    restoreMethods();
    __resetQueueServiceForTests();
  });

  afterEach(() => {
    restoreMethods();
    __resetQueueServiceForTests();
  });

  test("should enable radio mode", async () => {
    const queueService = getQueueService();
    let calls = 0;

    stubMethod(queueService, "enableRadio", (() => {
      calls += 1;
    }) as typeof queueService.enableRadio);

    const response = await api.request("/radio/enable", { method: "POST" });

    expect(response.status).toBe(200);
    expect(calls).toBe(1);
  });

  test("should disable radio mode", async () => {
    const queueService = getQueueService();
    let calls = 0;

    stubMethod(queueService, "disableRadio", (() => {
      calls += 1;
    }) as typeof queueService.disableRadio);

    const response = await api.request("/radio/disable", { method: "POST" });

    expect(response.status).toBe(200);
    expect(calls).toBe(1);
  });

  test("should toggle radio mode", async () => {
    const queueService = getQueueService();
    let calls = 0;

    stubMethod(queueService, "toggleRadio", (() => {
      calls += 1;
    }) as typeof queueService.toggleRadio);

    const response = await api.request("/radio/toggle", { method: "POST" });

    expect(response.status).toBe(200);
    expect(calls).toBe(1);
  });
});
