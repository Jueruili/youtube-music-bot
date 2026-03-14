import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { useLibraryStore } from "@/stores/libraryStore";

export function useLibraryPlaybackSync(): void {
  const currentTrack = usePlayerStore((state) => state.playbackState.currentTrack);
  const initializeLibrary = useLibraryStore((state) => state.initialize);
  const addHistoryEntry = useLibraryStore((state) => state.addHistoryEntry);
  const ready = useLibraryStore((state) => state.ready);
  const lastRecordedTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    void initializeLibrary();
  }, [initializeLibrary]);

  useEffect(() => {
    if (!ready || !currentTrack?.videoId) {
      return;
    }

    if (lastRecordedTrackIdRef.current === currentTrack.videoId) {
      return;
    }

    lastRecordedTrackIdRef.current = currentTrack.videoId;
    void addHistoryEntry(currentTrack);
  }, [addHistoryEntry, currentTrack, ready]);
}
