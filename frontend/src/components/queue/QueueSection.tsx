import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { QueueContent } from "./QueueContent";
import { usePlayerStore } from "@/stores/playerStore";
import { cn } from "@/lib/utils";

interface QueueSectionProps {
  mobile?: boolean;
  className?: string;
}

export const QueueSection = ({ mobile = false, className }: QueueSectionProps) => {
  const queue = usePlayerStore((state) => state.playbackState.queue);

  return (
    <Card
      className={cn(
        "h-full min-h-0 flex flex-col overflow-hidden",
        mobile
          ? "rounded-[28px] border-0 bg-transparent shadow-none"
          : "desktop-side-panel",
        className,
      )}
    >
      <CardHeader
        className={cn(
          "flex-shrink-0",
          mobile && "space-y-1 px-1 pb-3 pt-1",
        )}
      >
        <CardTitle className={cn(mobile ? "text-[1.55rem] leading-none" : "text-xl")}>
          播放佇列 ({queue.length})
        </CardTitle>
        <p
          className={cn(
            "text-[var(--text-secondary)]",
            mobile ? "text-sm leading-6" : "text-sm",
          )}
        >
          接下來會播放的歌曲清單，第一首會是下一首登場。
        </p>
      </CardHeader>
      <CardContent
        className={cn(
          "flex-1 min-h-0 overflow-hidden",
          mobile && "px-0 pb-0 pt-0",
        )}
      >
        <QueueContent mobile={mobile} className="h-full" />
      </CardContent>
    </Card>
  );
};
