export const TEACHING_BLACKBOARD_ELEMENT_TYPES = ["text", "bullets", "expression"] as const;
export const TEACHING_BLACKBOARD_BACKGROUNDS = ["plain", "warm", "grid"] as const;
export const TEACHING_BLACKBOARD_TONES = ["default", "primary", "highlight", "muted"] as const;
export const MAX_TEACHING_BLACKBOARD_SLIDES = 30;
export const MAX_TEACHING_BLACKBOARD_ELEMENTS = 12;
export const MAX_TEACHING_BLACKBOARD_HEADER_LENGTH = 6000;
export const MAX_TEACHING_BLACKBOARD_JSON_LENGTH = 500000;

export type TeachingBlackboardElementType = typeof TEACHING_BLACKBOARD_ELEMENT_TYPES[number];
export type TeachingBlackboardBackground = typeof TEACHING_BLACKBOARD_BACKGROUNDS[number];
export type TeachingBlackboardTone = typeof TEACHING_BLACKBOARD_TONES[number];

export type TeachingBlackboardElement = {
  id: string;
  type: TeachingBlackboardElementType;
  content: string;
  translation?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: 400 | 600 | 700;
  align: "left" | "center" | "right";
  tone: TeachingBlackboardTone;
};

export type TeachingBlackboardSlide = {
  id: string;
  name: string;
  segmentIndex: number;
  background: TeachingBlackboardBackground;
  elements: TeachingBlackboardElement[];
};

export type TeachingBlackboardDisplay = {
  mode: "slides";
  slides: TeachingBlackboardSlide[];
  activeSlide?: TeachingBlackboardSlide | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function safeId(value: unknown, fallback: string) {
  const parsed = String(value ?? "").trim();
  return /^[a-zA-Z0-9_-]{1,80}$/.test(parsed) ? parsed : fallback;
}

function uniqueId(candidate: string, usedIds: Set<string>, fallbackPrefix: string) {
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }
  let suffix = usedIds.size + 1;
  let next = `${fallbackPrefix}-${suffix}`;
  while (usedIds.has(next)) {
    suffix += 1;
    next = `${fallbackPrefix}-${suffix}`;
  }
  usedIds.add(next);
  return next;
}

function stripLegacyFormatting(value: string) {
  return value.replace(/\[(?:\/?b|\/?u|\/?color(?:=[^\]]+)?)\]/gi, "");
}

export function normalizeTeachingBlackboardElement(value: unknown, index: number): TeachingBlackboardElement | null {
  const source = record(value);
  if (!source) return null;
  const type = TEACHING_BLACKBOARD_ELEMENT_TYPES.includes(source.type as TeachingBlackboardElementType)
    ? source.type as TeachingBlackboardElementType
    : "text";
  const fontWeight = source.fontWeight === 400 || source.fontWeight === 600 || source.fontWeight === 700
    ? source.fontWeight
    : 600;
  const align = source.align === "center" || source.align === "right" ? source.align : "left";
  const tone = TEACHING_BLACKBOARD_TONES.includes(source.tone as TeachingBlackboardTone)
    ? source.tone as TeachingBlackboardTone
    : "default";
  const width = finiteNumber(source.width, 84, 4, 100);
  const height = finiteNumber(source.height, 24, 4, 100);
  return {
    id: safeId(source.id, `element-${index + 1}`),
    type,
    content: String(source.content ?? "").slice(0, 600),
    translation: String(source.translation ?? "").slice(0, 300),
    x: finiteNumber(source.x, 8, 0, 100 - width),
    y: finiteNumber(source.y, 8, 0, 100 - height),
    width,
    height,
    fontSize: finiteNumber(source.fontSize, type === "expression" ? 28 : 22, 12, 56),
    fontWeight,
    align,
    tone,
  };
}

export function normalizeTeachingBlackboardSlides(value: unknown): TeachingBlackboardSlide[] {
  const sourceSlides = Array.isArray(value)
    ? value
    : Array.isArray(record(value)?.slides)
      ? record(value)?.slides as unknown[]
      : [];
  const usedSlideIds = new Set<string>();
  return sourceSlides.slice(0, MAX_TEACHING_BLACKBOARD_SLIDES).flatMap((value, slideIndex) => {
    const source = record(value);
    if (!source) return [];
    const background = TEACHING_BLACKBOARD_BACKGROUNDS.includes(source.background as TeachingBlackboardBackground)
      ? source.background as TeachingBlackboardBackground
      : "plain";
    const usedElementIds = new Set<string>();
    const elements = Array.isArray(source.elements)
      ? source.elements.slice(0, MAX_TEACHING_BLACKBOARD_ELEMENTS).flatMap((element, elementIndex) => {
          const normalized = normalizeTeachingBlackboardElement(element, elementIndex);
          return normalized ? [{
            ...normalized,
            id: uniqueId(normalized.id, usedElementIds, "element"),
          }] : [];
        })
      : [];
    return [{
      id: uniqueId(safeId(source.id, `slide-${slideIndex + 1}`), usedSlideIds, "slide"),
      name: String(source.name ?? `画面 ${slideIndex + 1}`).trim().slice(0, 40) || `画面 ${slideIndex + 1}`,
      segmentIndex: Math.round(finiteNumber(source.segmentIndex, slideIndex, 0, 49)),
      background,
      elements,
    }];
  });
}

function localizedText(value: unknown) {
  const source = record(value);
  return String(source?.["zh-CN"] ?? "").trim();
}

/** Converts the old title/items/expression display into one editable canvas. */
export function teachingBlackboardSlidesFromDisplay(value: unknown): TeachingBlackboardSlide[] {
  const source = record(value);
  const savedSlides = normalizeTeachingBlackboardSlides(source?.slides);
  if (savedSlides.length) return savedSlides;
  if (!source) return [];

  const title = stripLegacyFormatting(localizedText(source.title));
  const itemsSource = record(source.items)?.["zh-CN"];
  const items = Array.isArray(itemsSource)
    ? itemsSource.filter((item): item is string => typeof item === "string").map(stripLegacyFormatting).join("\n")
    : "";
  const korean = stripLegacyFormatting(String(source.korean ?? "").trim());
  const translation = stripLegacyFormatting(localizedText(source.translation));
  if (!title && !items && !korean && !translation) return [];

  const elements: TeachingBlackboardElement[] = [];
  if (title) elements.push({
    id: "legacy-title", type: "text", content: title, x: 7, y: 8, width: 86, height: 16,
    fontSize: 30, fontWeight: 700, align: "left", tone: "default",
  });
  if (items) elements.push({
    id: "legacy-items", type: "bullets", content: items, x: 7, y: title ? 28 : 10, width: 86, height: 42,
    fontSize: 20, fontWeight: 600, align: "left", tone: "primary",
  });
  if (korean || translation) elements.push({
    id: "legacy-expression", type: "expression", content: korean, translation, x: 7,
    y: title || items ? 72 : 26, width: 86, height: 20, fontSize: 27, fontWeight: 700, align: "left", tone: "highlight",
  });
  return [{ id: "legacy-slide", name: "画面 1", segmentIndex: 0, background: "plain", elements }];
}

export function teachingBlackboardSlideHeaderLength(slide: TeachingBlackboardSlide) {
  return encodeURIComponent(JSON.stringify({ mode: "slides", activeSlide: slide })).length;
}

export function teachingBlackboardSlideFitsHeader(slide: TeachingBlackboardSlide) {
  return teachingBlackboardSlideHeaderLength(slide) <= MAX_TEACHING_BLACKBOARD_HEADER_LENGTH;
}

export function teachingBlackboardDisplayForSegment(value: unknown, segmentIndex: number) {
  const source = record(value);
  if (!source || source.mode !== "slides") return value;
  const slides = normalizeTeachingBlackboardSlides(source.slides);
  if (!slides.length) return { ...source, slides, activeSlide: null };
  const ordered = [...slides].sort((left, right) => left.segmentIndex - right.segmentIndex);
  const activeSlide = ordered.filter((slide) => slide.segmentIndex <= segmentIndex).at(-1) ?? ordered[0];
  // Only the active canvas crosses the response header boundary. Keeping all
  // slides in the database while returning one avoids oversized HTTP headers.
  return { mode: "slides", activeSlide };
}
