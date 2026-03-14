import { describe, expect, test } from "bun:test";
import type { Track } from "../types/index.ts";
import {
  pushRecentTrackId,
  selectRadioCandidates,
} from "../services/radio.helpers.ts";

const track = (videoId: string): Track => ({
  videoId,
  title: videoId,
  artist: "Test Artist",
  duration: 180,
});

describe("radio helpers", () => {
  test("should filter existing and recently played tracks before hydrating radio", () => {
    const candidates = selectRadioCandidates(
      [track("keep-1"), track("dup-current"), track("recent-1"), track("keep-2")],
      new Set(["dup-current"]),
      ["recent-1"],
      5,
    );

    expect(candidates.map((item) => item.videoId)).toEqual(["keep-1", "keep-2"]);
  });

  test("should limit radio candidates to the requested amount", () => {
    const candidates = selectRadioCandidates(
      [track("1"), track("2"), track("3")],
      new Set(),
      [],
      2,
    );

    expect(candidates.map((item) => item.videoId)).toEqual(["1", "2"]);
  });

  test("should keep recent history unique and capped", () => {
    const recentTrackIds = pushRecentTrackId(
      ["b", "a", "c"],
      "a",
      3,
    );

    expect(recentTrackIds).toEqual(["a", "b", "c"]);
  });
});
