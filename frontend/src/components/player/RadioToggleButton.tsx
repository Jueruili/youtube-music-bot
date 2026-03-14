import { useState } from "react";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/stores/playerStore";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface RadioToggleButtonProps {
  compact?: boolean;
  indicatorOnly?: boolean;
  className?: string;
}

export const RadioToggleButton = ({
  compact = false,
  indicatorOnly = false,
  className,
}: RadioToggleButtonProps) => {
  const radioEnabled = usePlayerStore((state) => state.playbackState.radioEnabled);
  const currentTrack = usePlayerStore((state) => state.playbackState.currentTrack);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (!currentTrack || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      await api.toggleRadio();
    } finally {
      setIsLoading(false);
    }
  };

  if (indicatorOnly) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
          radioEnabled
            ? "border-[color:var(--dynamic-ring)] bg-[var(--accent-soft)] text-[var(--accent)]"
            : "border-[color:var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
          className,
        )}
      >
        <Radio className="h-3.5 w-3.5" />
        {radioEnabled ? "無限播放開啟" : "無限播放關閉"}
      </div>
    );
  }

  return (
    <Button
      variant={radioEnabled ? "default" : "outline"}
      size={compact ? "sm" : "lg"}
      disabled={!currentTrack || isLoading}
      className={cn(
        compact
          ? "h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-sm leading-none"
          : "h-[52px] shrink-0 whitespace-nowrap rounded-full px-5 text-sm leading-none",
        className,
      )}
      title={radioEnabled ? "關閉無限播放" : "開啟無限播放"}
      onClick={handleToggle}
    >
      <Radio className="h-4 w-4" />
      <span className="whitespace-nowrap">
        {radioEnabled ? "無限播放中" : "無限播放"}
      </span>
    </Button>
  );
};
