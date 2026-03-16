import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Empty } from "@/components/ui/empty";
import { usePlayerStore } from "@/stores/playerStore";
import { useLyricSync } from "@/hooks/useLyricSync";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { formatTime } from "@/utils/format";
import { Play } from "lucide-react";
import {
  calculateLyricScrollTop,
  isLyricScrollAligned,
} from "@/utils/lyricsAlignment";

const MANUAL_RESUME_DELAY_MS = 1400;
const MANUAL_LEAVE_RESUME_DELAY_MS = 220;

interface LyricsContentProps {
  className?: string;
  /**
   * 變體樣式
   * - `default`: 預設模式（淺色背景）
   * - `dark`: 深色背景模式（全螢幕播放器使用）
   */
  variant?: "default" | "dark";
  isVisible?: boolean;
}

export const LyricsContent = ({
  className,
  variant = "default",
  isVisible = true,
}: LyricsContentProps) => {
  const lyrics = usePlayerStore((state) => state.lyrics);
  const currentTrack = usePlayerStore(
    (state) => state.playbackState.currentTrack,
  );
  const isPlaying = usePlayerStore((state) => state.playbackState.isPlaying);
  const updatePlaybackState = usePlayerStore(
    (state) => state.updatePlaybackState,
  );
  const { currentIndex } = useLyricSync();
  const { showToast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const alignmentFrameRef = useRef<number | null>(null);
  const alignmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualResetFrameRef = useRef<number | null>(null);
  const activeAlignmentIgnoresHoverRef = useRef(false);
  const lastReadyAlignmentKeyRef = useRef<string | null>(null);
  const alignmentDeadlineRef = useRef(0);
  const lastAlignmentFrameTimeRef = useRef<number | null>(null);
  const suppressScrollEventsUntilRef = useRef(0);
  const isHoveringLyricsRef = useRef(false);
  const isManualScrollModeRef = useRef(false);
  const hasVisibleViewportRef = useRef(false);
  const [containerHeight, setContainerHeight] = useState(0);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [isManualScrollMode, setIsManualScrollMode] = useState(false);

  const colorStyles = {
    default: {
      active: "text-3xl font-semibold text-[var(--text-primary)] tracking-tight",
      nearby: "text-lg text-[var(--text-secondary)]",
      distant: "text-base text-[var(--text-muted)]",
    },
    dark: {
      active: "text-3xl font-semibold tracking-tight text-white",
      nearby: "text-lg text-white/80",
      distant: "text-base text-white/42",
    },
  };

  const stopAlignmentSession = useCallback(() => {
    activeAlignmentIgnoresHoverRef.current = false;

    if (alignmentFrameRef.current !== null) {
      window.cancelAnimationFrame(alignmentFrameRef.current);
      alignmentFrameRef.current = null;
    }

    if (alignmentTimeoutRef.current) {
      clearTimeout(alignmentTimeoutRef.current);
      alignmentTimeoutRef.current = null;
    }
  }, []);

  const clearManualResumeTimer = useCallback(() => {
    if (manualResumeTimeoutRef.current) {
      clearTimeout(manualResumeTimeoutRef.current);
      manualResumeTimeoutRef.current = null;
    }
  }, []);

  const setManualScrollModeValue = useCallback((nextValue: boolean) => {
    isManualScrollModeRef.current = nextValue;
    setIsManualScrollMode(nextValue);
  }, []);

  const handleSeekToLyric = async (time: number) => {
    if (!currentTrack || !Number.isFinite(time) || time < 0) {
      return;
    }

    clearManualResumeTimer();
    setManualScrollModeValue(false);

    try {
      if (!isPlaying) {
        const playResponse = await api.play();
        if (!playResponse.success) {
          showToast({ message: playResponse.error || "恢復播放失敗", type: "error" });
          return;
        }
      }

      updatePlaybackState({
        position: time,
        isPlaying: true,
      });

      const response = await api.seek(time);
      if (!response.success) {
        showToast({ message: response.error || "歌詞跳轉失敗", type: "error" });
      }
    } catch {
      showToast({ message: "歌詞跳轉失敗", type: "error" });
    }
  };

  const getTargetScrollTop = useCallback(() => {
    if (
      !scrollAreaRef.current ||
      !activeRef.current ||
      containerHeight <= 0 ||
      scrollAreaRef.current.clientHeight <= 0
    ) {
      return null;
    }

    const scrollArea = scrollAreaRef.current;
    const activeLine = activeRef.current;

    return calculateLyricScrollTop({
      activeOffsetTop: activeLine.offsetTop,
      activeHeight: activeLine.offsetHeight,
      viewportHeight: scrollArea.clientHeight,
      scrollHeight: scrollArea.scrollHeight,
    });
  }, [containerHeight]);

  const startAlignmentSession = useCallback(
    ({
      delay = 0,
      duration = 900,
      initialBehavior = "auto",
      ignoreHover = false,
    }: {
      delay?: number;
      duration?: number;
      initialBehavior?: ScrollBehavior;
      ignoreHover?: boolean;
    } = {}) => {
      if (!isVisible || currentIndex < 0 || isManualScrollModeRef.current) {
        return;
      }

      stopAlignmentSession();
      activeAlignmentIgnoresHoverRef.current = ignoreHover;

      alignmentTimeoutRef.current = setTimeout(() => {
        alignmentDeadlineRef.current = performance.now() + duration;
        lastAlignmentFrameTimeRef.current = null;
        let hasStartedMotion = false;

        const step = (now: number) => {
          if (!isVisible || currentIndex < 0 || isManualScrollModeRef.current) {
            stopAlignmentSession();
            return;
          }

          if (!ignoreHover && isHoveringLyricsRef.current) {
            stopAlignmentSession();
            return;
          }

          const scrollArea = scrollAreaRef.current;
          const targetScrollTop = getTargetScrollTop();

          if (!scrollArea || targetScrollTop === null) {
            alignmentFrameRef.current = window.requestAnimationFrame(step);
            return;
          }

          if (!hasVisibleViewportRef.current && scrollArea.clientHeight > 0) {
            hasVisibleViewportRef.current = true;
          }

          if (!hasVisibleViewportRef.current) {
            alignmentFrameRef.current = window.requestAnimationFrame(step);
            return;
          }

          if (isLyricScrollAligned(scrollArea.scrollTop, targetScrollTop)) {
            stopAlignmentSession();
            return;
          }

          const previousFrameTime = lastAlignmentFrameTimeRef.current ?? now;
          const frameDeltaMs = Math.min(32, Math.max(8, now - previousFrameTime));
          lastAlignmentFrameTimeRef.current = now;

          const distanceToTarget = targetScrollTop - scrollArea.scrollTop;
          const responsiveness = initialBehavior === "auto" ? 13 : 9;
          const easingFactor =
            1 - Math.exp((-frameDeltaMs / 1000) * responsiveness);

          hasStartedMotion = true;
          suppressScrollEventsUntilRef.current = performance.now() + 120;
          scrollArea.scrollTop =
            scrollArea.scrollTop + distanceToTarget * easingFactor;

          if (
            performance.now() < alignmentDeadlineRef.current ||
            (hasStartedMotion &&
              !isLyricScrollAligned(scrollArea.scrollTop, targetScrollTop, 1.5))
          ) {
            alignmentFrameRef.current = window.requestAnimationFrame(step);
          } else {
            stopAlignmentSession();
          }
        };

        alignmentFrameRef.current = window.requestAnimationFrame(step);
      }, delay);
    },
    [currentIndex, getTargetScrollTop, isVisible, stopAlignmentSession],
  );

  const resumeAutomaticFocus = useCallback(
    (duration = 560) => {
      clearManualResumeTimer();
      setManualScrollModeValue(false);

      if (!isVisible || currentIndex < 0) {
        return;
      }

      startAlignmentSession({
        delay: 0,
        duration,
        initialBehavior: "smooth",
        ignoreHover: true,
      });
    },
    [
      clearManualResumeTimer,
      currentIndex,
      isVisible,
      setManualScrollModeValue,
      startAlignmentSession,
    ],
  );

  const scheduleManualResume = useCallback(
    (delay = MANUAL_RESUME_DELAY_MS) => {
      clearManualResumeTimer();
      manualResumeTimeoutRef.current = setTimeout(() => {
        resumeAutomaticFocus();
      }, delay);
    },
    [clearManualResumeTimer, resumeAutomaticFocus],
  );

  const registerManualScrollIntent = useCallback(() => {
    if (!isVisible) {
      return;
    }

    stopAlignmentSession();

    if (!isManualScrollModeRef.current) {
      setManualScrollModeValue(true);
    }

    scheduleManualResume();
  }, [
    isVisible,
    scheduleManualResume,
    setManualScrollModeValue,
    stopAlignmentSession,
  ]);

  useLayoutEffect(() => {
    if (
      currentIndex < 0 ||
      isHoveringLyricsRef.current ||
      isManualScrollModeRef.current ||
      !isVisible
    ) {
      return;
    }

    startAlignmentSession({
      delay: 0,
      duration: 420,
      initialBehavior: "smooth",
    });
  }, [
    containerHeight,
    currentIndex,
    isVisible,
    layoutVersion,
    lyrics.length,
    startAlignmentSession,
  ]);

  useEffect(() => {
    if (
      currentIndex < 0 ||
      !currentTrack?.videoId ||
      isManualScrollModeRef.current ||
      !isVisible
    ) {
      return;
    }

    startAlignmentSession({
      delay: 120,
      duration: 1200,
      initialBehavior: "auto",
      ignoreHover: true,
    });
  }, [
    currentIndex,
    currentTrack?.videoId,
    isPlaying,
    isVisible,
    layoutVersion,
    lyrics.length,
    startAlignmentSession,
  ]);

  useEffect(() => {
    const readyAlignmentKey =
      currentTrack?.videoId &&
      lyrics.length > 0 &&
      currentIndex >= 0 &&
      isVisible &&
      containerHeight > 0
        ? `${currentTrack.videoId}:${lyrics.length}:${layoutVersion}:${containerHeight}`
        : null;

    if (!readyAlignmentKey || isManualScrollModeRef.current) {
      return;
    }

    if (lastReadyAlignmentKeyRef.current === readyAlignmentKey) {
      return;
    }

    lastReadyAlignmentKeyRef.current = readyAlignmentKey;

    startAlignmentSession({
      delay: 0,
      duration: 1400,
      initialBehavior: "auto",
      ignoreHover: true,
    });
  }, [
    containerHeight,
    currentIndex,
    currentTrack?.videoId,
    isVisible,
    layoutVersion,
    lyrics.length,
    startAlignmentSession,
  ]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const content = contentRef.current;

    if (!scrollArea || !content) {
      return;
    }

    const syncLayout = () => {
      const nextHeight = scrollArea.clientHeight;
      hasVisibleViewportRef.current = nextHeight > 0;
      setContainerHeight(nextHeight);
      setLayoutVersion((value) => value + 1);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncLayout();
    });

    syncLayout();
    resizeObserver.observe(scrollArea);
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [isVisible, lyrics.length]);

  useEffect(() => {
    clearManualResumeTimer();
    isManualScrollModeRef.current = false;
    lastReadyAlignmentKeyRef.current = null;

    if (manualResetFrameRef.current !== null) {
      window.cancelAnimationFrame(manualResetFrameRef.current);
    }

    manualResetFrameRef.current = window.requestAnimationFrame(() => {
      setIsManualScrollMode(false);
      manualResetFrameRef.current = null;
    });

    return () => {
      if (manualResetFrameRef.current !== null) {
        window.cancelAnimationFrame(manualResetFrameRef.current);
        manualResetFrameRef.current = null;
      }
    };
  }, [clearManualResumeTimer, currentTrack?.videoId]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;

    if (!scrollArea) {
      return;
    }

    const handleMouseEnter = () => {
      isHoveringLyricsRef.current = true;

      if (!activeAlignmentIgnoresHoverRef.current) {
        stopAlignmentSession();
      }
    };

    const handleMouseLeave = () => {
      isHoveringLyricsRef.current = false;

      if (isManualScrollModeRef.current) {
        scheduleManualResume(MANUAL_LEAVE_RESUME_DELAY_MS);
        return;
      }

      if (currentIndex >= 0) {
        startAlignmentSession({
          delay: 0,
          duration: 480,
          initialBehavior: "smooth",
        });
      }
    };

    const handleWheel = () => {
      registerManualScrollIntent();
    };

    const handleTouchStart = () => {
      registerManualScrollIntent();
    };

    const handleTouchMove = () => {
      registerManualScrollIntent();
    };

    const handleScroll = () => {
      if (performance.now() < suppressScrollEventsUntilRef.current) {
        return;
      }

      registerManualScrollIntent();
    };

    scrollArea.addEventListener("mouseenter", handleMouseEnter);
    scrollArea.addEventListener("mouseleave", handleMouseLeave);
    scrollArea.addEventListener("wheel", handleWheel, { passive: true });
    scrollArea.addEventListener("touchstart", handleTouchStart, { passive: true });
    scrollArea.addEventListener("touchmove", handleTouchMove, { passive: true });
    scrollArea.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollArea.removeEventListener("mouseenter", handleMouseEnter);
      scrollArea.removeEventListener("mouseleave", handleMouseLeave);
      scrollArea.removeEventListener("wheel", handleWheel);
      scrollArea.removeEventListener("touchstart", handleTouchStart);
      scrollArea.removeEventListener("touchmove", handleTouchMove);
      scrollArea.removeEventListener("scroll", handleScroll);
    };
  }, [
    currentIndex,
    registerManualScrollIntent,
    scheduleManualResume,
    startAlignmentSession,
    stopAlignmentSession,
  ]);

  useEffect(() => {
    const handleVisibilityReset = () => {
      if (document.visibilityState === "visible" && currentIndex >= 0 && isVisible) {
        startAlignmentSession({
          ignoreHover: false,
          delay: 0,
          duration: 1600,
          initialBehavior: "auto",
        });
      }
    };

    const handleWindowFocus = () => {
      if (currentIndex >= 0 && isVisible) {
        startAlignmentSession({
          ignoreHover: false,
          delay: 0,
          duration: 1600,
          initialBehavior: "auto",
        });
      }
    };

    const handlePageShow = () => {
      if (currentIndex >= 0 && isVisible) {
        startAlignmentSession({
          ignoreHover: false,
          delay: 0,
          duration: 1800,
          initialBehavior: "auto",
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityReset);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityReset);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pageshow", handlePageShow);
      stopAlignmentSession();
      clearManualResumeTimer();
    };
  }, [
    clearManualResumeTimer,
    currentIndex,
    isVisible,
    startAlignmentSession,
    stopAlignmentSession,
  ]);

  useEffect(() => {
    if (!isVisible || currentIndex < 0 || isManualScrollModeRef.current) {
      return;
    }

    startAlignmentSession({
      delay: 40,
      duration: 1200,
      initialBehavior: "auto",
      ignoreHover: false,
    });
  }, [currentIndex, isVisible, layoutVersion, startAlignmentSession]);

  if (lyrics.length === 0) {
    return <Empty title="沒有歌詞" description="此歌曲沒有可用的歌詞" />;
  }

  const spacerHeight = containerHeight / 2;

  return (
    <div className={cn("relative h-full min-h-0", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-[linear-gradient(180deg,var(--surface-elevated)_0%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-[linear-gradient(0deg,var(--surface-elevated)_0%,transparent_100%)]" />
      <ScrollArea
        ref={scrollAreaRef}
        className="desktop-scrollbar h-full min-h-0 w-full"
        maxHeight="100%"
      >
        <div ref={contentRef} className="relative space-y-3 px-4 py-10 lg:px-6">
          <div style={{ height: spacerHeight }} />
          {lyrics.map((line, index) => {
            const distance =
              currentIndex < 0 ? 0 : Math.abs(index - currentIndex);
            const isActive = index === currentIndex;
            const isNearby = distance <= 1;
            const opacity = isManualScrollMode
              ? currentIndex < 0
                ? 1
                : Math.max(0.48, 1 - distance * 0.08)
              : currentIndex < 0
                ? 1
                : Math.max(0.18, 1 - distance * 0.145);
            const scale = isManualScrollMode
              ? isActive
                ? 1.015
                : Math.max(0.97, 1 - distance * 0.006)
              : isActive
                ? 1.028
                : Math.max(0.94, 1 - distance * 0.018);
            const blur = isManualScrollMode
              ? isActive
                ? 0
                : isNearby
                  ? Math.min(0.35, distance * 0.18)
                  : Math.min(0.9, Math.max(0, distance - 1) * 0.18 + 0.4)
              : isActive
                ? 0
                : Math.min(2.8, Math.max(0, distance - 1) * 0.72);
            const translateY = isManualScrollMode
              ? isActive
                ? 0
                : Math.min(4, distance * 0.7)
              : isActive
                ? 0
                : Math.min(10, distance * 1.6);
            const backgroundMix = isActive
              ? "color-mix(in srgb, var(--surface-elevated) 66%, var(--accent-soft) 34%)"
              : isNearby
                ? "color-mix(in srgb, var(--surface-elevated) 76%, var(--accent-soft) 18%)"
                : "transparent";

            return (
              <div
                key={index}
                ref={isActive ? activeRef : null}
                style={{
                  opacity,
                  transform: `translateY(${translateY}px) scale(${scale})`,
                  filter: `blur(${blur}px)`,
                  background: backgroundMix,
                }}
                className={cn(
                  "group/lyric relative rounded-[24px] px-14 transition-[opacity,transform,filter,background,box-shadow] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform,filter]",
                  "hover:bg-[color:color-mix(in_srgb,var(--surface-elevated)_78%,var(--accent-soft)_22%)]",
                  isActive && "shadow-[0_18px_30px_-28px_var(--accent-glow)]",
                )}
              >
                <button
                  type="button"
                  onClick={() => void handleSeekToLyric(line.time)}
                  title={`從 ${formatTime(line.time)} 開始播放`}
                  aria-label={`跳轉到 ${formatTime(line.time)}：${line.text}`}
                  className={cn(
                    "absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border transition-all",
                    "border-[color:var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
                    "hover:border-[color:var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
                    "opacity-0 lg:group-hover/lyric:opacity-100 lg:group-focus-within/lyric:opacity-100",
                  )}
                >
                  <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                </button>

                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => void handleSeekToLyric(line.time)}
                    className={cn(
                      "w-full cursor-pointer rounded-[20px] px-2 py-3 text-center leading-relaxed transition-[color,opacity,transform,text-shadow] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                      "hover:text-[var(--text-primary)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
                      isActive
                        ? colorStyles[variant].active
                        : isNearby
                          ? colorStyles[variant].nearby
                          : colorStyles[variant].distant,
                    )}
                    style={{
                      textShadow: isActive
                        ? "0 10px 28px color-mix(in srgb, var(--accent-glow) 38%, transparent)"
                        : "none",
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void handleSeekToLyric(line.time);
                      }
                    }}
                  >
                    {line.text}
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ height: spacerHeight }} />
        </div>
      </ScrollArea>
    </div>
  );
};
