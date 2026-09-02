export type TeachingVirtualCharacterPlacement = {
  x: number;
  y: number;
  scale: number;
  dialogueX: number;
  dialogueY: number;
};

export type TeachingBlackboardPlacement = {
  x: number;
  y: number;
  scale: number;
};

export type TeachingBlackboardPlacementBounds = {
  minimumXPercent: number;
  maximumXPercent: number;
  minimumTopPercent: number;
  maximumTopPercent: number;
  maximumScale: number;
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
  dialogueBubble: {
    minimumWidthPx: 128,
    preferredWidthCqw: 18,
    maximumWidthPx: 192,
  },
  blackboard: {
    defaultXPercent: 50,
    defaultTopPercent: 11,
    minimumXPercent: 10,
    maximumXPercent: 90,
    minimumTopPercent: 0,
    maximumTopPercent: 70,
    minimumScale: 0.75,
    maximumScale: 1.5,
  },
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
  const x = position === "left" ? 25 : 75;
  return {
    x,
    y: 0,
    scale: 1,
    dialogueX: Math.min(92, x + 10),
    dialogueY: 30,
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
  const x = finiteNumber(source.characterX, fallback.x, 10, 90);
  const y = finiteNumber(source.characterY, fallback.y, 0, TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent);
  return {
    x,
    y,
    scale: finiteNumber(source.characterScale, fallback.scale, 0.75, 1.25),
    dialogueX: finiteNumber(source.dialogueX, Math.min(92, x + 10), 5, 95),
    dialogueY: finiteNumber(source.dialogueY, Math.min(90, y + 30), 5, 90),
  };
}

export function normalizeSplitTeachingVirtualCharacterPlacement(
  value: unknown,
  positionFallback: unknown = "right",
): TeachingVirtualCharacterPlacement {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const immersive = normalizeTeachingVirtualCharacterPlacement(source, positionFallback);
  const fallbackX = Math.max(32, Math.min(68, immersive.x));
  const x = finiteNumber(source.splitCharacterX, fallbackX, 10, 90);
  const y = finiteNumber(source.splitCharacterY, immersive.y, 0, TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent);
  return {
    x,
    y,
    scale: finiteNumber(source.splitCharacterScale, Math.min(immersive.scale, 0.82), 0.5, 1.25),
    dialogueX: finiteNumber(source.splitDialogueX, Math.min(92, x + 10), 5, 95),
    dialogueY: finiteNumber(source.splitDialogueY, Math.min(90, y + 30), 5, 90),
  };
}

export function defaultTeachingBlackboardPlacement(): TeachingBlackboardPlacement {
  return {
    x: TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.defaultXPercent,
    y: TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.defaultTopPercent,
    scale: 1,
  };
}

export function normalizeTeachingBlackboardPlacement(value: unknown): TeachingBlackboardPlacement {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const fallback = defaultTeachingBlackboardPlacement();
  return {
    x: finiteNumber(
      source.x,
      fallback.x,
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumXPercent,
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumXPercent,
    ),
    y: finiteNumber(
      source.y,
      fallback.y,
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumTopPercent,
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumTopPercent,
    ),
    scale: finiteNumber(
      source.scale,
      fallback.scale,
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumScale,
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumScale,
    ),
  };
}

export function teachingBlackboardPlacementBounds(
  viewportWidth: unknown,
  viewportHeight: unknown,
  scale: unknown,
): TeachingBlackboardPlacementBounds {
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
  const geometry = teachingVirtualCharacterPreviewGeometry(width, height);
  const blackboardWidthPx = width * geometry.blackboardWidthPercent / 100;
  const blackboardHeightPx = blackboardWidthPx * 9 / 16;
  const maximumScale = Math.max(0.1, Math.floor(Math.min(
    TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumScale,
    width / blackboardWidthPx,
    height / blackboardHeightPx,
  ) * 100) / 100);
  const requestedScale = finiteNumber(
    scale,
    1,
    0.1,
    TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumScale,
  );
  const safeScale = Math.min(requestedScale, maximumScale);
  const scaledWidthPercent = geometry.blackboardWidthPercent * safeScale;
  const scaledHeightPercent = (
    width * geometry.blackboardWidthPercent / 100 * 9 / 16 * safeScale
  ) / height * 100;
  const halfWidthPercent = Math.min(50, scaledWidthPercent / 2);
  return {
    minimumXPercent: Math.max(
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumXPercent,
      halfWidthPercent,
    ),
    maximumXPercent: Math.min(
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumXPercent,
      100 - halfWidthPercent,
    ),
    minimumTopPercent: TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumTopPercent,
    maximumTopPercent: Math.max(
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumTopPercent,
      Math.min(
        TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumTopPercent,
        100 - scaledHeightPercent,
      ),
    ),
    maximumScale,
  };
}

export function constrainTeachingBlackboardPlacementToViewport(
  value: unknown,
  viewportWidth: unknown,
  viewportHeight: unknown,
): TeachingBlackboardPlacement {
  const placement = normalizeTeachingBlackboardPlacement(value);
  const bounds = teachingBlackboardPlacementBounds(viewportWidth, viewportHeight, placement.scale);
  return {
    x: finiteNumber(placement.x, 50, bounds.minimumXPercent, bounds.maximumXPercent),
    y: finiteNumber(
      placement.y,
      TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.defaultTopPercent,
      bounds.minimumTopPercent,
      bounds.maximumTopPercent,
    ),
    scale: Math.min(placement.scale, bounds.maximumScale),
  };
}
