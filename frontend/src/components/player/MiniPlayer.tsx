import { useState } from "react";
import { AnimatedAvatar } from "@/components/ui/animated-avatar";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/stores/playerStore";
import { useAppUiStore } from "@/stores/appUiStore";
import { api } from "@/services/api";
import { RadioToggleButton } from "./RadioToggleButton";

export const MiniPlayer = () => {
  const currentTrack = usePlayerStore(
    (state) => state.playbackState.currentTrack,
  );
  const isPlaying = usePlayerStore((state) => state.playbackState.isPlaying);
  const position = usePlayerStore((state) => state.playbackState.position);
  const duration = usePlayerStore((state) => state.playbackState.duration);
  const setMobileNowPlayingOpen = useAppUiStore(
    (state) => state.setMobileNowPlayingOpen,
  );
  const [isLoading, setIsLoading] = useState(false);

  const handlePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      if (isPlaying) {
        await api.pause();
      } else {
        await api.play();
      }
    } catch (error) {
      console.error("播放/暫停失敗:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      await api.skip();
    } catch (error) {
      console.error("跳過失敗:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 計算進度百分比
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div
      className="fixed bottom-[84px] left-0 right-0 z-50 border-t border-[color:var(--surface-border)] bg-[var(--surface-elevated)]/95 transition-colors lg:hidden"
      onClick={() => {
        if (currentTrack) {
          setMobileNowPlayingOpen(true);
        }
      }}
    >
      {/* 進度條 */}
      <div className="h-1 bg-[var(--surface-border)]">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 播放信息與控制 */}
      <div className="flex items-center gap-3 p-3 relative">
        {currentTrack ? (
          <>
            {/* 專輯封面 */}
            <AnimatedAvatar
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              size="sm"
            />

            {/* 歌曲信息 */}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {currentTrack.title}
              </p>
              <p className="truncate text-xs text-[var(--text-secondary)]">
                {currentTrack.artist}
              </p>
            </div>

            <RadioToggleButton indicatorOnly className="hidden sm:inline-flex" />

            {/* 播放控制 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayPause}
                disabled={isLoading}
                title={isPlaying ? "暫停" : "播放"}
              >
                {isPlaying ? (
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                disabled={isLoading}
                title="下一首"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4l10 8-10 8V4zm12 0v16h2V4h-2z" />
                </svg>
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* 無歌曲時的預設狀態 */}
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--surface-muted)]">
                <svg
                  className="h-6 w-6 text-[var(--text-muted)]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  尚無播放歌曲
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  搜尋並加入歌曲開始播放
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
