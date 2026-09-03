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

/** Where the floating character sits when the browser window is too narrow
 * (<1280px) for the 3:7 split, so the learning area can take the full width
 * without the teacher disappearing entirely. Same full-body rendering as the
 * other two layouts, just floating over the learning area instead of living
 * in its own teaching-area column. */
export type TeachingNarrowCharacterPlacement = {
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Field names a stage layout (immersive / 3:7 split / …) reads its character
 * placement from. Every layout that positions a full character + dialogue
 * bubble (as opposed to the narrow floating avatar, which only has x/y) goes
 * through {@link resolveVirtualCharacterPlacement} with one of these. */
type VirtualCharacterPlacementFields = {
  x: string;
  y: string;
  scale: string;
  dialogueX: string;
  dialogueY: string;
};

function resolveVirtualCharacterPlacement(
  source: Record<string, unknown>,
  fields: VirtualCharacterPlacementFields,
  fallback: { x: number; y: number; scale: number },
  scaleBounds: readonly [number, number],
): TeachingVirtualCharacterPlacement {
  const x = finiteNumber(source[fields.x], fallback.x, 10, 90);
  const y = finiteNumber(source[fields.y], fallback.y, 0, TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent);
  return {
    x,
    y,
    scale: finiteNumber(source[fields.scale], fallback.scale, scaleBounds[0], scaleBounds[1]),
    dialogueX: finiteNumber(source[fields.dialogueX], Math.min(92, x + 10), 5, 95),
    dialogueY: finiteNumber(source[fields.dialogueY], Math.min(90, y + 30), 5, 90),
  };
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

const IMMERSIVE_PLACEMENT_FIELDS: VirtualCharacterPlacementFields = {
  x: "characterX",
  y: "characterY",
  scale: "characterScale",
  dialogueX: "dialogueX",
  dialogueY: "dialogueY",
};
const IMMERSIVE_SCALE_BOUNDS = [0.75, 1.25] as const;

const SPLIT_PLACEMENT_FIELDS: VirtualCharacterPlacementFields = {
  x: "splitCharacterX",
  y: "splitCharacterY",
  scale: "splitCharacterScale",
  dialogueX: "splitDialogueX",
  dialogueY: "splitDialogueY",
};
const SPLIT_SCALE_BOUNDS = [0.5, 1.25] as const;

export function normalizeTeachingVirtualCharacterPlacement(
  value: unknown,
  positionFallback: unknown = "right",
): TeachingVirtualCharacterPlacement {
  const fallback = defaultTeachingVirtualCharacterPlacement(positionFallback);
  return resolveVirtualCharacterPlacement(asRecord(value), IMMERSIVE_PLACEMENT_FIELDS, fallback, IMMERSIVE_SCALE_BOUNDS);
}

export function normalizeSplitTeachingVirtualCharacterPlacement(
  value: unknown,
  positionFallback: unknown = "right",
): TeachingVirtualCharacterPlacement {
  const source = asRecord(value);
  // 3:7 双区没有单独设置过时，退回到"全屏教学"那一份坐标收窄、缩小后的位置，
  // 而不是和它共用同一个默认值——两种布局的可用空间差太多了。
  const immersive = normalizeTeachingVirtualCharacterPlacement(source, positionFallback);
  const fallback = {
    x: Math.max(32, Math.min(68, immersive.x)),
    y: immersive.y,
    scale: Math.min(immersive.scale, 0.82),
  };
  return resolveVirtualCharacterPlacement(source, SPLIT_PLACEMENT_FIELDS, fallback, SPLIT_SCALE_BOUNDS);
}

export function defaultTeachingNarrowCharacterPlacement(): TeachingNarrowCharacterPlacement {
  return { x: 90, y: 6, scale: 0.6 };
}

export function normalizeNarrowTeachingVirtualCharacterPlacement(
  value: unknown,
): TeachingNarrowCharacterPlacement {
  const source = asRecord(value);
  const fallback = defaultTeachingNarrowCharacterPlacement();
  return {
    x: finiteNumber(source.narrowCharacterX, fallback.x, 10, 90),
    y: finiteNumber(source.narrowCharacterY, fallback.y, 0, TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent),
    scale: finiteNumber(source.narrowCharacterScale, fallback.scale, 0.5, 1.25),
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
  const source = asRecord(value);
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
