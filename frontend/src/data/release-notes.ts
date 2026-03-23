export interface ReleaseNotesEntry {
  version: string;
  title: string;
  highlights: string[];
}

const releaseNotesByVersion: Record<string, ReleaseNotesEntry> = {
  "0.6.0": {
    version: "0.6.0",
    title: "性能提升與無縫播放",
    highlights: [
      "新增下一首預加載機制，降低切歌時等待串流解析的停頓感。",
      "播放器支援可調整秒數的 Crossfade，並優化淡入淡出曲線，讓歌曲之間的銜接更自然。",
      "播放器介面新增 Crossfade 開關與秒數控制，桌面與手機版都可即時同步。",
      "手動捲動歌詞時會降低模糊並提升鄰近行可讀性，方便邊看邊找段落。",
      "播放核心加入更積極的 stream URL 快取與重用，減少重複解析負擔。",
    ],
  },
  "0.5.0": {
    version: "0.5.0",
    title: "搜尋與播放切換修正",
    highlights: [
      "搜尋結果現在可正確加入播放佇列，並在空佇列時自動開始播放。",
      "支援從 YouTube / YouTube Music 連結解析單曲、歌單、專輯與 Mix 內容。",
      "Mix 列表中的單首歌曲或影片可各自加入播放佇列、歌單與收藏。",
      "Mix 內容的作者名稱顯示已修正，不再誤顯示為 Unknown。",
      "WebSocket 連線穩定性已改善，降低前端重複掛載造成的斷線問題。",
      "播放器在手動跳歌與自動切歌時會顯示正確的載入狀態，且不再沿用上一首的進度條位置。",
    ],
  },
  "0.4.0": {
    version: "0.4.0",
    title: "播放體驗更新",
    highlights: [
      "歌單列右側的加號按鈕現在會直接將歌曲加入播放佇列。",
      "新增 Cmd/Ctrl + K 快捷鍵，可快速聚焦到搜尋功能。",
      "桌面播放器中的長歌名、歌手名稱與專輯名稱會在需要時改為跑馬燈顯示，且只在實際捲動時套用邊緣虛化。",
      "歌曲項目可開啟專輯檢視，快速瀏覽同專輯的其他曲目。",
      "專輯檢視中的歌曲現在可直接加入收藏、加入歌單，並可一次把整張專輯加入播放佇列。",
      "已儲存 Mix 區塊改為可完整展開並以內部捲動瀏覽，不再出現內容被截斷的情況。",
      "新增可捲動的版本更新說明對話框，可查看此版本的重點變更與建置資訊。",
    ],
  },
};

export function getReleaseNotesForVersion(version: string): ReleaseNotesEntry | null {
  return releaseNotesByVersion[version] ?? null;
}
