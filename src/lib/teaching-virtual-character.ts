export type TeachingVirtualCharacterPlacement = {
  x: number;
  y: number;
  scale: number;
};

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
    y: finiteNumber(source.characterY, fallback.y, 0, 30),
    scale: finiteNumber(source.characterScale, fallback.scale, 0.75, 1.25),
  };
}
