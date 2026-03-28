/**
 * YouTube 縮略圖解析度級別
 */
export const ThumbnailQuality = {
  /** 120x90 */
  DEFAULT: "default",
  /** 320x180 */
  MEDIUM: "mqdefault",
  /** 480x360 */
  HIGH: "hqdefault",
  /** 640x480 */
  STANDARD: "sddefault",
  /** 1280x720 (可能不可用) */
  MAXRES: "maxresdefault",
} as const;

export type ThumbnailQuality =
  (typeof ThumbnailQuality)[keyof typeof ThumbnailQuality];

type SourceThumbnailVariant =
  | "default"
  | "mqdefault"
  | "hqdefault"
  | "sddefault"
  | "hq720"
  | "maxresdefault";

const THUMBNAIL_QUALITY_FALLBACKS: Record<ThumbnailQuality, ThumbnailQuality[]> =
  {
    [ThumbnailQuality.MAXRES]: [
      ThumbnailQuality.MAXRES,
      ThumbnailQuality.STANDARD,
      ThumbnailQuality.HIGH,
      ThumbnailQuality.MEDIUM,
      ThumbnailQuality.DEFAULT,
    ],
    [ThumbnailQuality.STANDARD]: [
      ThumbnailQuality.STANDARD,
      ThumbnailQuality.HIGH,
      ThumbnailQuality.MEDIUM,
      ThumbnailQuality.DEFAULT,
    ],
    [ThumbnailQuality.HIGH]: [
      ThumbnailQuality.HIGH,
      ThumbnailQuality.MEDIUM,
      ThumbnailQuality.DEFAULT,
    ],
    [ThumbnailQuality.MEDIUM]: [
      ThumbnailQuality.MEDIUM,
      ThumbnailQuality.DEFAULT,
    ],
    [ThumbnailQuality.DEFAULT]: [ThumbnailQuality.DEFAULT],
  };

const SOURCE_THUMBNAIL_RANK: Record<SourceThumbnailVariant, number> = {
  default: 1,
  mqdefault: 2,
  hqdefault: 3,
  sddefault: 4,
  hq720: 5,
  maxresdefault: 6,
};

const REQUESTED_THUMBNAIL_RANK: Record<ThumbnailQuality, number> = {
  [ThumbnailQuality.DEFAULT]: 1,
  [ThumbnailQuality.MEDIUM]: 2,
  [ThumbnailQuality.HIGH]: 3,
  [ThumbnailQuality.STANDARD]: 4,
  [ThumbnailQuality.MAXRES]: 6,
};

function getSourceThumbnailVariant(url: string): SourceThumbnailVariant | null {
  const match = url.match(
    /\/(default|mqdefault|hqdefault|sddefault|hq720|maxresdefault)\.(?:jpg|webp)(?:[?#].*)?$/i,
  );

  return (match?.[1]?.toLowerCase() as SourceThumbnailVariant | undefined) ?? null;
}

/**
 * 將 YouTube 縮略圖 URL 轉換為指定解析度
 *
 * @param url 原始縮略圖 URL
 * @param quality 目標解析度級別（預設：HIGH）
 * @returns 高解析度縮略圖 URL
 *
 * @example
 * ```ts
 * const thumbnail = "https://i.ytimg.com/vi/VIDEO_ID/default.jpg";
 * const hqThumbnail = getHighQualityThumbnail(thumbnail);
 * // Returns: "https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg"
 * ```
 */
export function getHighQualityThumbnail(
  url: string,
  quality: ThumbnailQuality = ThumbnailQuality.HIGH,
): string {
  if (!url) return url;

  const youtubeVideoMatch = url.match(
    /(?:i\.ytimg\.com|img\.youtube\.com)\/vi(?:_webp)?\/([^/?]+)/i,
  );

  if (youtubeVideoMatch?.[1]) {
    const videoId = youtubeVideoMatch[1];
    return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
  }

  return url;
}

/**
 * 針對 YouTube / YouTube Music 的縮圖 URL 做較高解析度轉換。
 * 支援標準 i.ytimg 與 lh3.googleusercontent 的 size suffix。
 */
export function getOptimizedThumbnail(
  url: string,
  quality: ThumbnailQuality = ThumbnailQuality.HIGH,
): string {
  if (!url) return url;

  const youtubeThumbnail = getHighQualityThumbnail(url, quality);
  if (youtubeThumbnail !== url) {
    return youtubeThumbnail;
  }

  if (url.includes("googleusercontent.com")) {
    const suffixPattern = /=w\d+-h\d+(-[a-z0-9-]+)?$/i;

    if (suffixPattern.test(url)) {
      if (quality === ThumbnailQuality.MAXRES) {
        return url.replace(suffixPattern, "=s720-c-k-c0x00ffffff-no-rj");
      }

      if (quality === ThumbnailQuality.STANDARD) {
        return url.replace(suffixPattern, "=s512-c-k-c0x00ffffff-no-rj");
      }

      return url.replace(suffixPattern, "=s360-c-k-c0x00ffffff-no-rj");
    }
  }

  return url;
}

export function getOptimizedThumbnailCandidates(
  url: string,
  preferredQuality: ThumbnailQuality = ThumbnailQuality.HIGH,
): string[] {
  if (!url) {
    return [];
  }

  const generatedCandidates = THUMBNAIL_QUALITY_FALLBACKS[preferredQuality].map(
    (quality) => getOptimizedThumbnail(url, quality),
  );
  const sourceVariant = getSourceThumbnailVariant(url);
  const sourceRank = sourceVariant ? SOURCE_THUMBNAIL_RANK[sourceVariant] : 0;

  if (sourceRank <= 0) {
    return Array.from(new Set([...generatedCandidates, url].filter(Boolean)));
  }

  const higherRankCandidates: string[] = [];
  const lowerOrEqualRankCandidates: string[] = [];

  for (const candidate of generatedCandidates) {
    const candidateVariant = getSourceThumbnailVariant(candidate);
    const candidateRank = candidateVariant
      ? SOURCE_THUMBNAIL_RANK[candidateVariant]
      : REQUESTED_THUMBNAIL_RANK[preferredQuality];

    if (candidateRank > sourceRank) {
      higherRankCandidates.push(candidate);
      continue;
    }

    lowerOrEqualRankCandidates.push(candidate);
  }

  const candidates = [
    ...higherRankCandidates,
    url,
    ...lowerOrEqualRankCandidates,
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}
