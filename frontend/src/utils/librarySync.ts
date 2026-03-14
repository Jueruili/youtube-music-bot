import type {
  FavoriteTrack,
  HistoryEntry,
  LibrarySnapshot,
  PairedDevice,
  Playlist,
  SavedMix,
  SyncSessionDevice,
  SyncedLibraryPayload,
} from "../types/library";

const MAX_HISTORY_ENTRIES = 1000;
const MAX_SAVED_MIXES = 50;

function compareIsoDateDesc(a: string, b: string): number {
  return b.localeCompare(a);
}

function mergeByKey<T>(
  current: T[],
  incoming: T[],
  getKey: (item: T) => string,
  pickPreferred: (left: T, right: T) => T,
): T[] {
  const merged = new Map<string, T>();

  for (const item of [...current, ...incoming]) {
    const key = getKey(item);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, item);
      continue;
    }

    merged.set(key, pickPreferred(existing, item));
  }

  return Array.from(merged.values());
}

function pickLatestFavorite(left: FavoriteTrack, right: FavoriteTrack): FavoriteTrack {
  return left.updatedAt >= right.updatedAt ? left : right;
}

function pickLatestHistory(left: HistoryEntry, right: HistoryEntry): HistoryEntry {
  return left.playedAt >= right.playedAt ? left : right;
}

function pickLatestPlaylist(left: Playlist, right: Playlist): Playlist {
  return left.updatedAt >= right.updatedAt ? left : right;
}

function sortFavorites(items: FavoriteTrack[]): FavoriteTrack[] {
  return [...items].sort((left, right) =>
    compareIsoDateDesc(left.updatedAt, right.updatedAt),
  );
}

function sortHistory(items: HistoryEntry[]): HistoryEntry[] {
  return [...items]
    .sort((left, right) => compareIsoDateDesc(left.playedAt, right.playedAt))
    .slice(0, MAX_HISTORY_ENTRIES);
}

function sortSavedMixes(items: SavedMix[]): SavedMix[] {
  return [...items]
    .sort((left, right) => compareIsoDateDesc(left.createdAt, right.createdAt))
    .slice(0, MAX_SAVED_MIXES);
}

function sortPlaylists(items: Playlist[]): Playlist[] {
  return [...items].sort((left, right) =>
    compareIsoDateDesc(left.updatedAt, right.updatedAt),
  );
}

export function toSyncedLibraryPayload(
  snapshot: LibrarySnapshot,
): SyncedLibraryPayload {
  return {
    profileId: snapshot.profileId,
    updatedAt: snapshot.updatedAt,
    syncSessionId: snapshot.syncSessionId,
    favorites: snapshot.favorites,
    history: snapshot.history,
    savedMixes: snapshot.savedMixes,
    playlists: snapshot.playlists,
  };
}

export function mergeLibraryPayload(
  currentSnapshot: LibrarySnapshot,
  incomingPayload: SyncedLibraryPayload,
): LibrarySnapshot {
  const favorites = sortFavorites(
    mergeByKey(
      currentSnapshot.favorites,
      incomingPayload.favorites,
      (item) => item.videoId,
      pickLatestFavorite,
    ),
  );

  const history = sortHistory(
    mergeByKey(
      currentSnapshot.history,
      incomingPayload.history,
      (item) => item.track.videoId,
      pickLatestHistory,
    ),
  );

  const savedMixes = sortSavedMixes(
    mergeByKey(
      currentSnapshot.savedMixes,
      incomingPayload.savedMixes,
      (item) => item.id,
      (left, right) => (left.createdAt >= right.createdAt ? left : right),
    ),
  );

  const playlists = sortPlaylists(
    mergeByKey(
      currentSnapshot.playlists,
      incomingPayload.playlists,
      (item) => item.id,
      pickLatestPlaylist,
    ),
  );

  return {
    ...currentSnapshot,
    profileId: currentSnapshot.profileId || incomingPayload.profileId,
    syncSessionId: incomingPayload.syncSessionId ?? currentSnapshot.syncSessionId,
    updatedAt:
      currentSnapshot.updatedAt >= incomingPayload.updatedAt
        ? currentSnapshot.updatedAt
        : incomingPayload.updatedAt,
    favorites,
    history,
    savedMixes,
    playlists,
  };
}

export function mergePairedDevices(
  currentDeviceId: string,
  existingDevices: PairedDevice[],
  sessionDevices: SyncSessionDevice[],
): PairedDevice[] {
  const existingById = new Map(existingDevices.map((device) => [device.id, device]));

  return sessionDevices.map((device) => {
    const existing = existingById.get(device.id);

    return {
      id: device.id,
      name: device.name,
      kind: device.kind,
      pairedAt: existing?.pairedAt ?? device.pairedAt,
      isCurrentDevice: device.id === currentDeviceId,
      status: "available",
      connected: device.connected,
      lastSeenAt: device.lastSeenAt,
    };
  });
}
