/**
 * Lightweight bbcode-like markup for teaching-script text fields:
 * [b]bold[/b], [u]underline[/u], [color=red]colored[/color] (nestable).
 *
 * Kept deliberately tiny (no external rich-text editor/library) because the
 * only two things that ever need to know about it are: the admin editor's
 * selection-based formatting toolbar, and the student-facing renderer. TTS
 * generation and audio-cache hashing must only ever see the *stripped*
 * plain text — students should never hear "b" or "color equals red" read
 * aloud, and adding bold to an already-voiced line must not invalidate its
 * cached audio.
 */

export type RichTextColor = "red" | "orange" | "blue" | "green";

export const RICH_TEXT_COLOR_VALUES: Record<RichTextColor, string> = {
  red: "#dc2626",
  orange: "#ea580c",
  blue: "#2563eb",
  green: "#16a34a",
};

export const RICH_TEXT_COLOR_LABELS: Record<RichTextColor, string> = {
  red: "红色",
  orange: "橙色",
  blue: "蓝色",
  green: "绿色",
};

export type RichChar = {
  char: string;
  bold: boolean;
  underline: boolean;
  color: RichTextColor | null;
};

const COLOR_NAMES = Object.keys(RICH_TEXT_COLOR_VALUES).join("|");

function tagPattern() {
  return new RegExp(`\\[(\\/?)(b|u|color)(?:=(${COLOR_NAMES}))?\\]`, "gi");
}

/**
 * Parses the markup into a flat per-character array, so the student-facing
 * typewriter reveal can slice a growing prefix and keep formatting attached
 * to each already-revealed character. Unmatched or unclosed tags are
 * ignored rather than rejected, since content authors can't always balance
 * tags perfectly while editing, and a half-typed tag must never surface as
 * literal bracket text.
 */
export function parseRichText(raw: string): RichChar[] {
  const result: RichChar[] = [];
  let bold = false;
  let underline = false;
  const colorStack: RichTextColor[] = [];
  let lastIndex = 0;
  const pattern = tagPattern();
  const pushText = (text: string) => {
    for (const char of Array.from(text)) {
      result.push({ char, bold, underline, color: colorStack[colorStack.length - 1] ?? null });
    }
  };
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    pushText(raw.slice(lastIndex, match.index));
    lastIndex = pattern.lastIndex;
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    if (tag === "b") bold = !closing;
    else if (tag === "u") underline = !closing;
    else if (tag === "color") {
      if (closing) colorStack.pop();
      else if (match[3]) colorStack.push(match[3].toLowerCase() as RichTextColor);
    }
  }
  pushText(raw.slice(lastIndex));
  return result;
}

/** Plain, TTS-safe and hash-safe text with all markup removed. */
export function stripRichText(raw: string): string {
  return raw.replace(tagPattern(), "");
}

export function richCharsToPlainText(chars: RichChar[]): string {
  return chars.map((item) => item.char).join("");
}
