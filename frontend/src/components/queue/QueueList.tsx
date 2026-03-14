import { QueueItem } from "./QueueItem";
import type { Track } from "@/types";
import type { DragEvent } from "react";

type DropTarget = {
  index: number;
  position: "before" | "after";
} | null;

interface QueueListProps {
  queue: Track[];
  onRemove: (index: number) => void;
  onAddToPlaylist: (track: Track) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  removingIndex: number | null;
  draggingIndex: number | null;
  dropTarget: DropTarget;
  onDragStart: (index: number) => void;
  onDragOver: (target: NonNullable<DropTarget>) => void;
  onDragEnd: () => void;
}

export const QueueList = ({
  queue,
  onRemove,
  onAddToPlaylist,
  onReorder,
  removingIndex,
  draggingIndex,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
}: QueueListProps) => {
  const handleDrop = (index: number, position: "before" | "after") => {
    if (draggingIndex === null) {
      return;
    }

    const insertionIndex = position === "after" ? index + 1 : index;
    const finalIndex =
      draggingIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;

    onReorder(draggingIndex, finalIndex);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    onDragStart(index);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();

    if (draggingIndex === null || draggingIndex === index) {
      return;
    }

    const { top, height } = event.currentTarget.getBoundingClientRect();
    const position =
      event.clientY - top > height / 2 ? "after" : "before";

    event.dataTransfer.dropEffect = "move";
    onDragOver({ index, position });
  };

  return (
    <div className="space-y-2 p-4 pr-3">
      {queue.map((track, index) => (
        <QueueItem
          key={`${track.videoId}-${index}`}
          track={track}
          index={index}
          onRemove={onRemove}
          onAddToPlaylist={onAddToPlaylist}
          isRemoving={removingIndex === index}
          isNext={index === 0}
          isDragging={draggingIndex === index}
          dropIndicator={
            dropTarget?.index === index && draggingIndex !== index
              ? dropTarget.position
              : null
          }
          onDragStart={(event) => handleDragStart(event, index)}
          onDragOver={(event) => handleDragOver(event, index)}
          onDrop={(position) => handleDrop(index, position)}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
};
