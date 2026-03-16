import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LyricsContent } from "./LyricsContent";
import { cn } from "@/lib/utils";

interface LyricsDisplayProps {
  isVisible?: boolean;
  mobile?: boolean;
  className?: string;
}

export const LyricsDisplay = ({
  isVisible = true,
  mobile = false,
  className,
}: LyricsDisplayProps) => {
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
          歌詞
        </CardTitle>
        <p
          className={cn(
            "text-[var(--text-secondary)]",
            mobile ? "text-sm leading-6" : "text-sm",
          )}
        >
          聚焦正在播放的句子，讓閱讀和旋律一起推進。
        </p>
      </CardHeader>
      <CardContent
        className={cn(
          "flex-1 overflow-hidden min-h-0",
          mobile && "px-0 pb-0 pt-0",
        )}
      >
        <LyricsContent isVisible={isVisible} />
      </CardContent>
    </Card>
  );
};
