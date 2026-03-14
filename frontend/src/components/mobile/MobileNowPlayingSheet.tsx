import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAppUiStore } from "@/stores/appUiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useLibraryStore } from "@/stores/libraryStore";
import { NowPlaying } from "@/components/player/NowPlaying";
import { ProgressBar } from "@/components/player/ProgressBar";
import { PlaybackControls } from "@/components/player/PlaybackControls";
import { VolumeControl } from "@/components/player/VolumeControl";
import { RadioToggleButton } from "@/components/player/RadioToggleButton";
import { Button } from "@/components/ui/button";

export const MobileNowPlayingSheet = () => {
  const isOpen = useAppUiStore((state) => state.isMobileNowPlayingOpen);
  const setOpen = useAppUiStore((state) => state.setMobileNowPlayingOpen);
  const currentTrack = usePlayerStore((state) => state.playbackState.currentTrack);
  const setMobileActiveTab = usePlayerStore((state) => state.setMobileActiveTab);
  const openPlaylistPicker = useLibraryStore((state) => state.openPlaylistPicker);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="left-0 top-auto h-[92vh] max-h-[92vh] w-full max-w-none translate-x-0 translate-y-0 rounded-t-[32px] rounded-b-none border-0 p-0 lg:hidden">
        <div className="surface-card-strong flex h-full flex-col overflow-hidden rounded-t-[32px] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[var(--surface-border)]" />
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="space-y-8">
              <NowPlaying showIdleState compact={false} />

              {currentTrack ? (
                <>
                  <ProgressBar />
                  <div className="flex justify-center">
                    <PlaybackControls showRadioToggle={false} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <RadioToggleButton compact />
                    <Button
                      variant="outline"
                      className="h-12 rounded-2xl px-4"
                      onClick={() => {
                        openPlaylistPicker(currentTrack);
                      }}
                    >
                      加入歌單
                    </Button>
                  </div>
                  <VolumeControl />
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        setOpen(false);
                        setMobileActiveTab("lyrics");
                      }}
                    >
                      歌詞
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        setOpen(false);
                        setMobileActiveTab("queue");
                      }}
                    >
                      佇列
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        setOpen(false);
                        setMobileActiveTab("library");
                      }}
                    >
                      媒體庫
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
