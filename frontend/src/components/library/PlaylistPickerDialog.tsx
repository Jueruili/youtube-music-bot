import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibraryStore } from "@/stores/libraryStore";
import { useToast } from "@/components/ui/toast";

const EMPTY_PLAYLISTS: Array<{
  id: string;
  name: string;
  tracks: Array<unknown>;
}> = [];

export const PlaylistPickerDialog = () => {
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const track = useLibraryStore((state) => state.playlistPickerTrack);
  const playlists = useLibraryStore(
    (state) => state.snapshot?.playlists ?? EMPTY_PLAYLISTS,
  );
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);
  const closePlaylistPicker = useLibraryStore((state) => state.closePlaylistPicker);
  const { showToast } = useToast();

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !track) {
      return;
    }

    const playlist = await createPlaylist(newPlaylistName);
    await addTrackToPlaylist(playlist.id, track);
    setNewPlaylistName("");
    closePlaylistPicker();
    showToast({ message: `已加入「${playlist.name}」`, type: "success" });
  };

  const handleAddToExistingPlaylist = async (playlistId: string, playlistName: string) => {
    if (!track) {
      return;
    }

    await addTrackToPlaylist(playlistId, track);
    closePlaylistPicker();
    showToast({ message: `已加入「${playlistName}」`, type: "success" });
  };

  return (
    <Dialog open={Boolean(track)} onOpenChange={(open) => !open && closePlaylistPicker()}>
      <DialogContent className="w-[min(94vw,840px)] max-w-[840px] p-0">
        <div className="border-b border-[color:var(--surface-border)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-2xl">加入自定歌單</DialogTitle>
              <p className="mt-2 truncate text-sm text-[var(--text-secondary)]">
                {track ? `${track.title} · ${track.artist}` : "選擇一張歌單或建立新歌單"}
              </p>
            </div>
            <DialogClose />
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              placeholder="建立新歌單"
              className="h-12"
            />
            <Button
              className="h-12 rounded-2xl px-5"
              onClick={handleCreatePlaylist}
              disabled={!newPlaylistName.trim() || !track}
            >
              建立並加入
            </Button>
          </div>

          <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
            {playlists.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[color:var(--surface-border)] px-4 py-5 text-sm text-[var(--text-secondary)]">
                目前還沒有歌單，先建立第一張吧。
              </p>
            ) : (
              playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="surface-card flex w-full items-center justify-between rounded-[24px] border px-4 py-4 text-left transition-transform hover:-translate-y-0.5"
                  onClick={() =>
                    handleAddToExistingPlaylist(playlist.id, playlist.name)
                  }
                >
                  <div>
                    <p className="text-base font-semibold text-[var(--text-primary)]">
                      {playlist.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {playlist.tracks.length} 首歌曲
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[var(--accent)]">
                    加入
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
