export type TeachingVirtualCharacterPlacement = {
  x: number;
  y: number;
  scale: number;
};

export type TeachingVirtualCharacterPreviewGeometry = {
  aspectRatio: string;
  headerHeightPercent: number;
  metadataLeftPercent: number;
  metadataTopPercent: number;
  blackboardLeftPercent: number;
  blackboardTopPercent: number;
  blackboardWidthPercent: number;
  bubbleWidthPercent: number;
};

export const TEACHING_VIRTUAL_CHARACTER_STAGE = {
  characterHeightPercent: 48,
  maximumBottomPercent: 80,
  viewportTopPx: 0,
  viewportBottomPx: 0,
  preview: {
    fallbackViewportWidthPx: 1920,
    fallbackViewportHeightPx: 1080,
    focusedContentMaxWidthPx: 920,
    contentInsetPx: 32,
    learningHeaderHeightPx: 56,
    contentTopPaddingPx: 20,
    metadataHeightPx: 20,
    blackboardGapPx: 16,
    bubbleMaxWidthPx: 192,
  },
} as const;

export function teachingVirtualCharacterPreviewGeometry(
  viewportWidth: unknown,
  viewportHeight: unknown,
): TeachingVirtualCharacterPreviewGeometry {
  const width = finiteNumber(
    viewportWidth,
    TEACHING_VIRTUAL_CHARACTER_STAGE.preview.fallbackViewportWidthPx,
    320,
    7680,
  );
  const height = finiteNumber(
    viewportHeight,
    TEACHING_VIRTUAL_CHARACTER_STAGE.preview.fallbackViewportHeightPx,
    320,
    4320,
  );
  const focusedWidth = Math.min(TEACHING_VIRTUAL_CHARACTER_STAGE.preview.focusedContentMaxWidthPx, width);
  const blackboardWidthPx = Math.max(
    256,
    focusedWidth - TEACHING_VIRTUAL_CHARACTER_STAGE.preview.contentInsetPx * 2,
  );
  const blackboardWidthPercent = blackboardWidthPx / width * 100;
  const blackboardLeftPercent = (100 - blackboardWidthPercent) / 2;
  const metadataTopPx = TEACHING_VIRTUAL_CHARACTER_STAGE.preview.learningHeaderHeightPx
    + TEACHING_VIRTUAL_CHARACTER_STAGE.preview.contentTopPaddingPx;
  const blackboardTopPx = metadataTopPx
    + TEACHING_VIRTUAL_CHARACTER_STAGE.preview.metadataHeightPx
    + TEACHING_VIRTUAL_CHARACTER_STAGE.preview.blackboardGapPx;
  return {
    aspectRatio: `${width} / ${height}`,
    headerHeightPercent: TEACHING_VIRTUAL_CHARACTER_STAGE.preview.learningHeaderHeightPx / height * 100,
    metadataLeftPercent: blackboardLeftPercent,
    metadataTopPercent: metadataTopPx / height * 100,
    blackboardLeftPercent,
    blackboardTopPercent: blackboardTopPx / height * 100,
    blackboardWidthPercent,
    bubbleWidthPercent: TEACHING_VIRTUAL_CHARACTER_STAGE.preview.bubbleMaxWidthPx / width * 100,
  };
}

function finiteNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

export function defaultTeachingVirtualCharacterPlacement(position: unknown): TeachingVirtualCharacterPlacement {
  return {
    x: position === "left" ? 25 : 75,
    y: 0,
    scale: 1,
  };
}

export function normalizeTeachingVirtualCharacterPlacement(
  value: unknown,
  positionFallback: unknown = "right",
): TeachingVirtualCharacterPlacement {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const fallback = defaultTeachingVirtualCharacterPlacement(positionFallback);
  return {
    x: finiteNumber(source.characterX, fallback.x, 10, 90),
    y: finiteNumber(source.characterY, fallback.y, 0, TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent),
    scale: finiteNumber(source.characterScale, fallback.scale, 0.75, 1.25),
  };
}
