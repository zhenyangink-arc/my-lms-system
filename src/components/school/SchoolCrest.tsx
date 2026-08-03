import { GraduationCap } from "lucide-react";

function safeImageUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 校徽缺失时使用稳定占位图，避免学校列表出现破图。 */
export function SchoolCrest({ logoUrl, name, size = "md" }: { logoUrl?: string | null; name: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const imageUrl = safeImageUrl(logoUrl);
  const sizeClass = size === "lg" ? "h-20 w-20 rounded-[22px]" : size === "sm" ? "h-10 w-10 rounded-xl" : size === "xs" ? "h-6 w-6 rounded-md" : "h-14 w-14 rounded-2xl";

  return (
    <span
      role="img"
      aria-label={`${name}校徽`}
      className={`${size === "xs" ? "border border-black/10 bg-white" : "app-soft-card border"} flex shrink-0 items-center justify-center bg-contain bg-center bg-no-repeat ${sizeClass}`}
      style={imageUrl ? { backgroundImage: `url(${JSON.stringify(imageUrl).slice(1, -1)})`, backgroundColor: "white" } : { color: "var(--app-accent)" }}
    >
      {!imageUrl && <GraduationCap size={size === "lg" ? 30 : size === "sm" ? 17 : size === "xs" ? 12 : 22} />}
    </span>
  );
}
