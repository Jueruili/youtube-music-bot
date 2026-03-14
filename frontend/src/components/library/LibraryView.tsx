import { useMemo, useState } from "react";
import { useLibraryStore, getCurrentDevice } from "@/stores/libraryStore";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { api } from "@/services/api";
import { formatTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { Playlist, PlaylistTrackEntry, SavedMix } from "@/types/library";
import { ArrowLeft, Music4, Plus, Radio, Trash2 } from "lucide-react";

interface LibraryViewProps {
  isMobile?: boolean;
}

export const LibraryView = ({ isMobile = false }: LibraryViewProps) => {
  const snapshot = useLibraryStore((state) => state.snapshot);
  const ready = useLibraryStore((state) => state.ready);
  const selectedPlaylistId = useLibraryStore((state) => state.selectedPlaylistId);
  const syncStatus = useLibraryStore((state) => state.syncStatus);
  const syncPairCode = useLibraryStore((state) => state.syncPairCode);
  const syncError = useLibraryStore((state) => state.syncError);
  const selectPlaylist = useLibraryStore((state) => state.selectPlaylist);
  const applySyncSession = useLibraryStore((state) => state.applySyncSession);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const renamePlaylist = useLibraryStore((state) => state.renamePlaylist);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);
  const removeTrackFromPlaylist = useLibraryStore((state) => state.removeTrackFromPlaylist);
  const reorderPlaylistTracks = useLibraryStore((state) => state.reorderPlaylistTracks);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const openPlaylistPicker = useLibraryStore((state) => state.openPlaylistPicker);
  const deleteSavedMix = useLibraryStore((state) => state.deleteSavedMix);
  const { showToast } = useToast();
  const [playlistName, setPlaylistName] = useState("");
  const [pairCodeInput, setPairCodeInput] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const selectedPlaylist = useMemo(
    () => snapshot?.playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null,
    [selectedPlaylistId, snapshot?.playlists],
  );
  const currentDevice = getCurrentDevice(snapshot ?? null);

  if (!ready || !snapshot) {
    return (
      <Card className="surface-card flex h-full items-center justify-center rounded-[32px] p-8">
        <p className="text-sm text-[var(--text-secondary)]">正在載入媒體庫…</p>
      </Card>
    );
  }

  const handleCreatePlaylist = async () => {
    const playlist = await createPlaylist(playlistName);
    setPlaylistName("");
    showToast({ message: `已建立「${playlist.name}」`, type: "success" });
  };

  const handlePlayPlaylist = async (playlist: Playlist) => {
    const response = await api.playPlaylist(
      playlist.id,
      playlist.tracks.map((entry) => entry.track),
    );

    if (response.success) {
      showToast({ message: `開始播放「${playlist.name}」`, type: "success" });
      return;
    }

    showToast({ message: response.error || "播放歌單失敗", type: "error" });
  };

  const handleQueuePlaylist = async (playlist: Playlist) => {
    const response = await api.queuePlaylist(
      playlist.id,
      playlist.tracks.map((entry) => entry.track),
    );

    if (response.success) {
      showToast({ message: `已追加「${playlist.name}」`, type: "success" });
      return;
    }

    showToast({ message: response.error || "加入歌單失敗", type: "error" });
  };

  const handleReplayMix = async (savedMix: SavedMix) => {
    const response = await api.createMix(savedMix.seedTrack);

    if (response.success) {
      showToast({ message: "已重新啟動 Mix", type: "success" });
      return;
    }

    showToast({ message: response.error || "重播 Mix 失敗", type: "error" });
  };

  const handleAddTrackToQueue = async (track: PlaylistTrackEntry["track"]) => {
    const response = await api.addToQueue(track);

    if (response.success) {
      showToast({ message: `已加入播放佇列：${track.title}`, type: "success" });
      return;
    }

    showToast({ message: response.error || "加入播放佇列失敗", type: "error" });
  };

  const handlePairDevice = async () => {
    if (!snapshot || !currentDevice || !pairCodeInput.trim()) {
      return;
    }

    setIsPairing(true);
    try {
      const response = await api.pairSyncSession({
        pairCode: pairCodeInput.trim().toUpperCase(),
        profileId: snapshot.profileId,
        device: {
          id: currentDevice.id,
          name: currentDevice.name,
          kind: currentDevice.kind,
        },
      });

      if (!response.success || !response.data) {
        showToast({ message: response.error || "配對失敗", type: "error" });
        return;
      }

      await applySyncSession({
        ...response.data,
        pairCode: response.data.pairCode,
      });
      setPairCodeInput("");
      showToast({ message: "裝置已加入同步 session", type: "success" });
    } finally {
      setIsPairing(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!snapshot?.syncSessionId) {
      return;
    }

    const response = await api.removeSyncDevice(snapshot.syncSessionId, deviceId);

    if (response.success) {
      showToast({ message: "已移除同步裝置", type: "success" });
      return;
    }

    showToast({ message: response.error || "移除裝置失敗", type: "error" });
  };

  const content = selectedPlaylist ? (
    <PlaylistDetail
      playlist={selectedPlaylist}
      draggingIndex={draggingIndex}
      onBack={() => selectPlaylist(null)}
      onQueue={() => handleQueuePlaylist(selectedPlaylist)}
      onPlay={() => handlePlayPlaylist(selectedPlaylist)}
      onRename={async (name) => {
        await renamePlaylist(selectedPlaylist.id, name);
        setEditingPlaylistId(null);
        showToast({ message: "歌單名稱已更新", type: "success" });
      }}
      onDelete={async () => {
        await deletePlaylist(selectedPlaylist.id);
        showToast({ message: "歌單已刪除", type: "success" });
      }}
      onRemoveTrack={async (entryId) => {
        await removeTrackFromPlaylist(selectedPlaylist.id, entryId);
      }}
      onDragStart={setDraggingIndex}
      onDragEnd={() => setDraggingIndex(null)}
      onDropTrack={async (fromIndex, toIndex) => {
        await reorderPlaylistTracks(selectedPlaylist.id, fromIndex, toIndex);
      }}
      onOpenAddTrack={openPlaylistPicker}
      isEditing={editingPlaylistId === selectedPlaylist.id}
      onEditingChange={(isEditing) =>
        setEditingPlaylistId(isEditing ? selectedPlaylist.id : null)
      }
    />
  ) : (
    <div className="space-y-6">
      <div
        className={
          isMobile
            ? "space-y-4"
            : "grid gap-4 md:grid-cols-2 2xl:grid-cols-4"
        }
      >
        <SummaryCard title="收藏歌曲" value={snapshot.favorites.length} />
        <SummaryCard title="播放歷史" value={snapshot.history.length} />
        <SummaryCard title="已儲存 Mix" value={snapshot.savedMixes.length} />
        <SummaryCard title="自定歌單" value={snapshot.playlists.length} />
      </div>

      <Card className="surface-card rounded-[30px] p-5">
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px] 2xl:items-start">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">自定歌單</h3>
            <p className="mt-1 max-w-[44rem] text-sm leading-6 text-[var(--text-secondary)]">
              建立不限數量的歌單，把喜歡的歌曲整理成自己的播放清單。你可以手動排序、直接播放，或加入目前佇列。
            </p>
          </div>
          <div className="surface-subtle rounded-[24px] border p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              建立新歌單
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <input
                value={playlistName}
                onChange={(event) => setPlaylistName(event.target.value)}
                placeholder="例如：深夜放鬆、開車、工作中"
                className="h-12 rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-elevated)] px-4 text-sm text-[var(--text-primary)] outline-none"
              />
              <Button
                className="h-12 rounded-2xl px-5"
                onClick={handleCreatePlaylist}
                disabled={!playlistName.trim()}
              >
                <Plus className="h-4 w-4" />
                建立歌單
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 2xl:grid-cols-2">
          {snapshot.playlists.length === 0 ? (
            <Empty title="尚未建立歌單" description="從搜尋、目前播放或佇列開始收藏想聽的歌。" />
          ) : (
            snapshot.playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="surface-subtle flex items-center justify-between rounded-[24px] border px-4 py-4 text-left transition-transform hover:-translate-y-0.5"
                onClick={() => selectPlaylist(playlist.id)}
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
                  打開
                </span>
              </button>
            ))
          )}
        </div>
      </Card>

      <div className={isMobile ? "space-y-6" : "grid gap-6 2xl:grid-cols-2"}>
        <TrackSection
          title="收藏歌曲"
          description="把想反覆播放的歌曲收進這裡。"
          emptyTitle="還沒有收藏歌曲"
          tracks={snapshot.favorites.map((favorite) => favorite.track)}
          actionLabel="移除收藏"
          onAction={(track) => void toggleFavorite(track)}
          onQueueAction={(track) => void handleAddTrackToQueue(track)}
          onPlaylistAction={(track) => openPlaylistPicker(track)}
        />
        <TrackSection
          title="播放歷史"
          description="依最近播放順序整理。"
          emptyTitle="還沒有播放歷史"
          tracks={snapshot.history.map((entry) => entry.track)}
          actionLabel="收藏"
          onAction={(track) => void toggleFavorite(track)}
          onQueueAction={(track) => void handleAddTrackToQueue(track)}
          onPlaylistAction={(track) => openPlaylistPicker(track)}
        />
      </div>

      <Card className="surface-card rounded-[30px] p-5">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">已儲存 Mix</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            把喜歡的推薦組合留在這裡，之後可以快速重播。
          </p>
        </div>
        <div className="grid gap-3">
          {snapshot.savedMixes.length === 0 ? (
            <Empty title="尚未儲存 Mix" description="從搜尋建立 Mix 後，會自動保存在這裡。" />
          ) : (
            snapshot.savedMixes.map((savedMix) => (
              <div
                key={savedMix.id}
                className="surface-subtle flex flex-col gap-4 rounded-[24px] border px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    {savedMix.seedTrack.title}
                  </p>
                  <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
                    {savedMix.seedTrack.artist} · {savedMix.tracks.length} 首
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => handleReplayMix(savedMix)}
                  >
                    <Radio className="h-4 w-4" />
                    重播 Mix
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl text-red-500"
                    onClick={async () => {
                      await deleteSavedMix(savedMix.id);
                      showToast({ message: "已從媒體庫移除 Mix", type: "success" });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    刪除
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="surface-card rounded-[30px] p-5">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">已配對裝置</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            使用配對碼連接不同裝置，讓收藏、歷史、Mix 和歌單一起同步。
          </p>
        </div>
        <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="surface-subtle rounded-[24px] border px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              配對碼
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[0.28em] text-[var(--text-primary)]">
              {syncPairCode ?? "------"}
            </p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {syncStatus === "connected"
                ? "目前同步已連線，其他裝置輸入這組代碼即可加入。"
                : syncStatus === "connecting"
                  ? "正在建立同步連線..."
                  : "同步尚未就緒，系統會自動重試。"}
            </p>
            {syncError ? (
              <p className="mt-2 text-sm text-red-500">{syncError}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3">
            <input
              value={pairCodeInput}
              onChange={(event) => setPairCodeInput(event.target.value.toUpperCase())}
              placeholder="輸入配對碼"
              className="h-12 min-w-[200px] rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-4 text-sm tracking-[0.22em] text-[var(--text-primary)] uppercase outline-none"
            />
            <Button
              className="h-12 rounded-2xl px-5"
              disabled={isPairing || pairCodeInput.trim().length < 6}
              onClick={() => void handlePairDevice()}
            >
              連接裝置
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          {snapshot.pairedDevices.map((device) => (
            <div
              key={device.id}
              className="surface-subtle flex items-center justify-between gap-4 rounded-[24px] border px-4 py-4"
            >
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)]">
                  {device.name}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {device.kind === "desktop" ? "桌面裝置" : "手機裝置"} · {device.connected ? "已連線" : "離線"}{device.lastSeenAt ? ` · ${new Date(device.lastSeenAt).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {device.id === currentDevice?.id ? (
                  <span className="rounded-full border border-[color:var(--dynamic-ring)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    本機
                  </span>
                ) : null}
                {!device.isCurrentDevice && snapshot.syncSessionId ? (
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => void handleRemoveDevice(device.id)}
                  >
                    移除
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const contentClassName = isMobile
    ? "h-full w-full px-4 pb-[176px] pt-4"
    : "h-full w-full";

  return (
    <Card className="surface-card h-full min-h-0 w-full overflow-hidden rounded-[32px] p-0">
      <ScrollArea className={contentClassName} maxHeight="100%">
        <div
          className={cn(
            "w-full",
            isMobile ? "space-y-6 pb-8" : "space-y-7 p-6 xl:space-y-8 xl:p-8",
          )}
        >
          {content}
        </div>
      </ScrollArea>
    </Card>
  );
};

const SummaryCard = ({ title, value }: { title: string; value: number }) => (
  <Card className="surface-subtle rounded-[28px] border p-5">
    <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
      {title}
    </p>
    <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
      {value}
    </p>
  </Card>
);

interface TrackSectionProps {
  title: string;
  description: string;
  emptyTitle: string;
  tracks: PlaylistTrackEntry["track"][];
  actionLabel: string;
  onAction: (track: PlaylistTrackEntry["track"]) => void;
  onQueueAction: (track: PlaylistTrackEntry["track"]) => void;
  onPlaylistAction: (track: PlaylistTrackEntry["track"]) => void;
}

const TrackSection = ({
  title,
  description,
  emptyTitle,
  tracks,
  actionLabel,
  onAction,
  onQueueAction,
  onPlaylistAction,
}: TrackSectionProps) => (
  <Card className="surface-card rounded-[30px] p-5">
    <div className="mb-4">
      <h3 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
    <div className="grid gap-3">
      {tracks.length === 0 ? (
        <Empty title={emptyTitle} description="先播放或整理幾首歌，這裡就會出現內容。" />
      ) : (
        tracks.slice(0, 8).map((track) => (
          <div
            key={`${title}-${track.videoId}`}
            className="surface-subtle flex flex-col gap-4 rounded-[24px] border px-4 py-4 sm:flex-row sm:items-center"
          >
            <Avatar src={track.thumbnail} alt={track.title} size="md" className="rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                {track.title}
              </p>
              <p className="truncate text-sm text-[var(--text-secondary)]">
                {track.artist} · {formatTime(track.duration)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <Button
                variant="outline"
                className="rounded-2xl px-3"
                onClick={() => onQueueAction(track)}
                aria-label={`加入播放佇列：${track.title}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => onPlaylistAction(track)}
              >
                加入歌單
              </Button>
              <Button className="rounded-2xl" onClick={() => onAction(track)}>
                {actionLabel}
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  </Card>
);

interface PlaylistDetailProps {
  playlist: Playlist;
  draggingIndex: number | null;
  isEditing: boolean;
  onBack: () => void;
  onPlay: () => void;
  onQueue: () => void;
  onDelete: () => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onRemoveTrack: (entryId: string) => Promise<void>;
  onDropTrack: (fromIndex: number, toIndex: number) => Promise<void>;
  onDragStart: (index: number | null) => void;
  onDragEnd: () => void;
  onOpenAddTrack: (track: PlaylistTrackEntry["track"]) => void;
  onEditingChange: (isEditing: boolean) => void;
}

const PlaylistDetail = ({
  playlist,
  draggingIndex,
  isEditing,
  onBack,
  onPlay,
  onQueue,
  onDelete,
  onRename,
  onRemoveTrack,
  onDropTrack,
  onDragStart,
  onDragEnd,
  onOpenAddTrack,
  onEditingChange,
}: PlaylistDetailProps) => {
  const [draftName, setDraftName] = useState(playlist.name);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            返回歌單列表
          </button>
          {isEditing ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                className="h-12 rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-4 text-sm text-[var(--text-primary)] outline-none"
              />
              <Button className="rounded-2xl" onClick={() => void onRename(draftName)}>
                儲存名稱
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                {playlist.name}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                共 {playlist.tracks.length} 首歌曲，可拖曳調整順序。
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Button className="rounded-2xl" onClick={onPlay}>
            <Music4 className="h-4 w-4" />
            播放歌單
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={onQueue}>
            <Plus className="h-4 w-4" />
            加入佇列
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={() => onEditingChange(!isEditing)}>
            {isEditing ? "取消編輯" : "重新命名"}
          </Button>
          <Button variant="outline" className="rounded-2xl text-red-500" onClick={() => void onDelete()}>
            <Trash2 className="h-4 w-4" />
            刪除
          </Button>
        </div>
      </div>

      {playlist.tracks.length === 0 ? (
        <Empty title="歌單目前是空的" description="從搜尋、目前播放或佇列把想聽的歌加入進來。" />
      ) : (
        <div className="grid gap-3">
          {playlist.tracks.map((entry, index) => (
            <div
              key={entry.id}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragEnd={onDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingIndex === null) {
                  return;
                }

                void onDropTrack(draggingIndex, index);
                onDragEnd();
              }}
              className="surface-subtle grid gap-4 rounded-[24px] border px-4 py-4 md:grid-cols-[auto_auto_minmax(0,1fr)_auto]"
            >
              <button
                type="button"
                className="self-center text-sm font-semibold text-[var(--text-muted)]"
                aria-label="拖曳排序"
              >
                ≡
              </button>
              <Avatar src={entry.track.thumbnail} alt={entry.track.title} size="md" className="rounded-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                  {entry.track.title}
                </p>
                <p className="truncate text-sm text-[var(--text-secondary)]">
                  {entry.track.artist} · {formatTime(entry.track.duration)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button variant="outline" className="rounded-2xl" onClick={() => onOpenAddTrack(entry.track)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void onRemoveTrack(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
