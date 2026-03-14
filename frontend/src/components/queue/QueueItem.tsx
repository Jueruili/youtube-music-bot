import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { formatTime } from "@/utils/format";
import type { Track } from "@/types";
import { cn } from "@/lib/utils";
import { GripVertical, Library } from "lucide-react";
import type { DragEvent } from "react";

interface QueueItemProps {
  track: Track;
  index: number;
  onRemove: (index: number) => void;
  onAddToPlaylist: (track: Track) => void;
  isRemoving?: boolean;
  isNext?: boolean;
  isDragging?: boolean;
  dropIndicator?: "before" | "after" | null;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (position: "before" | "after") => void;
  onDragEnd: () => void;
}

export const QueueItem = ({
  track,
  index,
  onRemove,
  onAddToPlaylist,
  isRemoving,
  isNext = false,
  isDragging = false,
  dropIndicator = null,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: QueueItemProps) => {
  return (
    <div
      onDrop={(event) => {
        event.preventDefault();
        onDrop(dropIndicator ?? "before");
      }}
      onDragOver={onDragOver}
      className={cn(
        "group relative rounded-[22px] border p-3 transition-all",
        isNext
          ? "border-[color:var(--surface-border)] bg-[color:color-mix(in_srgb,var(--surface-elevated)_84%,var(--accent-soft)_16%)]"
          : "surface-subtle",
        isDragging && "scale-[0.992] opacity-55 shadow-none",
        dropIndicator &&
          "border-[color:var(--accent)] bg-[color:color-mix(in_srgb,var(--surface-elevated)_76%,var(--accent-soft)_24%)] shadow-[0_14px_28px_-24px_var(--accent-glow)]",
      )}
    >
      {dropIndicator ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-5 h-1 rounded-full bg-[var(--accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent-soft)_72%,transparent)]",
            dropIndicator === "before" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2",
          )}
        />
      ) : null}
      <div className="flex items-center gap-3">
        <div className="flex w-12 items-center justify-center gap-1">
          <div
            draggable={!isRemoving}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            title="拖拽重新排序"
            className="flex h-10 w-10 cursor-grab items-center justify-center rounded-2xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)] active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
        <div className="flex w-10 flex-col items-center justify-center gap-1">
          <span className="text-sm font-medium text-[var(--text-muted)]">
            {index + 1}
          </span>
        </div>
        <Avatar src={track.thumbnail} alt={track.title} size="sm" className="rounded-2xl" />
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="truncate text-sm font-medium text-[var(--text-primary)]">
              {track.title}
            </h4>
            {isNext ? (
              <span className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                Next
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-[var(--text-secondary)]">
            {track.artist} • {formatTime(track.duration)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddToPlaylist(track)}
          title="加入歌單"
          className="opacity-40 transition-opacity group-hover:opacity-100"
        >
          <Library className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          disabled={isRemoving}
          title="移除"
          className="opacity-40 transition-opacity group-hover:opacity-100"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
};
