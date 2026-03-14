import { create } from "zustand";

type DesktopMode = "player" | "library";

interface AppUiStore {
  desktopMode: DesktopMode;
  setDesktopMode: (mode: DesktopMode) => void;
  isMobileNowPlayingOpen: boolean;
  setMobileNowPlayingOpen: (open: boolean) => void;
}

export const useAppUiStore = create<AppUiStore>((set) => ({
  desktopMode: "player",
  setDesktopMode: (desktopMode) => set({ desktopMode }),
  isMobileNowPlayingOpen: false,
  setMobileNowPlayingOpen: (isMobileNowPlayingOpen) =>
    set({ isMobileNowPlayingOpen }),
}));
