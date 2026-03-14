import type { Track } from "../types/index.ts";

export function selectRadioCandidates(
  tracks: Track[],
  existingTrackIds: Set<string>,
  recentTrackIds: string[],
  limit: number = 5,
): Track[] {
  const recentTrackIdSet = new Set(recentTrackIds);

  return tracks
    .filter((track) => Boolean(track.videoId))
    .filter((track) => !existingTrackIds.has(track.videoId))
    .filter((track) => !recentTrackIdSet.has(track.videoId))
    .slice(0, limit);
}

export function pushRecentTrackId(
  recentTrackIds: string[],
  videoId: string,
  limit: number = 20,
): string[] {
  return [videoId, ...recentTrackIds.filter((id) => id !== videoId)].slice(
    0,
    limit,
  );
}
