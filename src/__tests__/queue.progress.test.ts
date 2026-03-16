import { beforeEach, describe, expect, test } from "bun:test";
import {
  __resetPlayerServiceForTests,
  getPlayerService,
} from "../services/player.service.ts";
import {
  __resetQueueServiceForTests,
  getQueueService,
} from "../services/queue.service.ts";
import type { Track } from "../types/index.ts";

const track = (videoId: string): Track => ({
  videoId,
  title: `Track ${videoId}`,
  artist: "Test Artist",
  duration: 180,
});

describe("QueueService - playback progress broadcasting", () => {
  beforeEach(() => {
    __resetQueueServiceForTests();
    __resetPlayerServiceForTests();
  });

  test("should not emit full playback state for time position updates", () => {
    const queueService = getQueueService();
    const playerService = getPlayerService() as unknown as {
      eventCallback?: (event: { timePos?: number; duration?: number }) => void;
    };
    const internalQueueService = queueService as unknown as {
      currentTrack: Track | null;
      currentDuration: number;
    };

    internalQueueService.currentTrack = track("track-1");
    internalQueueService.currentDuration = 180;

    let stateCalls = 0;
    let progressCalls = 0;

    queueService.onStateChange(() => {
      stateCalls += 1;
    });
    queueService.onProgressChange(() => {
      progressCalls += 1;
    });

    playerService.eventCallback?.({ timePos: 12 });

    expect(stateCalls).toBe(0);
    expect(progressCalls).toBe(1);
  });

  test("should throttle successive progress broadcasts", async () => {
    const queueService = getQueueService();
    const playerService = getPlayerService() as unknown as {
      eventCallback?: (event: { timePos?: number; duration?: number }) => void;
    };
    const internalQueueService = queueService as unknown as {
      currentTrack: Track | null;
      currentDuration: number;
    };

    internalQueueService.currentTrack = track("track-2");
    internalQueueService.currentDuration = 180;

    const progressEvents: number[] = [];
    queueService.onProgressChange((progress) => {
      progressEvents.push(progress.position);
    });

    playerService.eventCallback?.({ timePos: 1 });
    playerService.eventCallback?.({ timePos: 2 });
    playerService.eventCallback?.({ timePos: 3 });

    expect(progressEvents).toEqual([1]);

    await new Promise((resolve) => setTimeout(resolve, 320));

    expect(progressEvents).toEqual([1, 3]);
  });

  test("should broadcast progress immediately when seeking", () => {
    const queueService = getQueueService();
    const internalQueueService = queueService as unknown as {
      currentTrack: Track | null;
      currentDuration: number;
    };

    internalQueueService.currentTrack = track("track-3");
    internalQueueService.currentDuration = 180;

    const positions: number[] = [];
    queueService.onProgressChange((progress) => {
      positions.push(progress.position);
    });

    queueService.seekTo(42);

    expect(positions.at(-1)).toBe(42);
  });
});
