"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RotateCcw, SunMedium } from "lucide-react";

export const BRIGHTNESS_STORAGE_KEY = "app-dashboard-brightness";
const BRIGHTNESS_CHANGE_EVENT = "app-dashboard-brightness-change";
const THEME_STORAGE_KEY = "app-dashboard-theme";
const THEME_CHANGE_EVENT = "app-dashboard-theme-change";
const MIN_OFFSET = -30;
const MAX_OFFSET = 30;

type ThemeValue = "classic" | "terracotta" | "chatgpt";

const AMBIENT_VARS = {
  bg: "--app-bg",
  soft: "--app-soft-bg",
  border: "--app-border",
  borderSoft: "--app-border-soft",
  heroStart: "--app-hero-start",
  heroEnd: "--app-hero-end",
} as const;

type AmbientKey = keyof typeof AMBIENT_VARS;

// 与 globals.css 中三套主题的画布色保持一致；亮度调节只平移这几个"环境色"，
// 不动纯白的卡片/侧边栏和固定的文字/主色，避免破坏对比度和"卡片纯白"设计规范。
// dark 是调暗时的混合目标色，取自各主题自己的正文文字色，让变暗的画布仍带该主题的色调。
const THEME_PALETTES: Record<ThemeValue, Record<AmbientKey, string> & { dark: string }> = {
  classic: {
    bg: "#fcfbf7",
    soft: "#f6f4ee",
    border: "#ebe9e1",
    borderSoft: "#f1efe8",
    heroStart: "#f8f6ef",
    heroEnd: "#eef6ee",
    dark: "#141413",
  },
  terracotta: {
    bg: "#f9f6f0",
    soft: "#f6efea",
    border: "#ebe4df",
    borderSoft: "#f1ebe5",
    heroStart: "#f5efe6",
    heroEnd: "#f8f2ea",
    dark: "#2d2523",
  },
  chatgpt: {
    bg: "#f7f7f8",
    soft: "#ececf1",
    border: "#e0e0e6",
    borderSoft: "#ebebf0",
    heroStart: "#e9f6f1",
    heroEnd: "#f4faf7",
    dark: "#0d0d0d",
  },
};

// 燕麦画布本身明度已经很高（90%~96%），如果按固定明度值叠加，"调亮"几步就会把所有环境色
// 一起顶到纯白、层次全部消失。改成按比例朝目标色混合（亮时朝白混、暗时朝该主题文字色混），
// 每个颜色离目标色的相对距离不同，混合后仍能保留原本的深浅层次。
function mixHex(hex: string, target: string, t: number): string {
  const from = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const to = [1, 3, 5].map((i) => parseInt(target.slice(i, i + 2), 16));
  const toHex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${from.map((v, i) => toHex(v * (1 - t) + to[i] * t)).join("")}`;
}

function applyBrightness(theme: ThemeValue, offset: number) {
  const style = document.documentElement.style;
  if (offset === 0) {
    Object.values(AMBIENT_VARS).forEach((cssVar) => style.removeProperty(cssVar));
    return;
  }
  const palette = THEME_PALETTES[theme];
  const target = offset > 0 ? "#ffffff" : palette.dark;
  const t = Math.abs(offset) / 100;
  (Object.keys(AMBIENT_VARS) as AmbientKey[]).forEach((key) => {
    style.setProperty(AMBIENT_VARS[key], mixHex(palette[key], target, t));
  });
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(BRIGHTNESS_CHANGE_EVENT, onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(BRIGHTNESS_CHANGE_EVENT, onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function getOffsetSnapshot() {
  const raw = window.localStorage.getItem(BRIGHTNESS_STORAGE_KEY);
  const parsed = raw ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, parsed));
}

function getOffsetServerSnapshot() {
  return 0;
}

function getThemeSnapshot(): ThemeValue {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "terracotta" || saved === "chatgpt" ? saved : "classic";
}

function getThemeServerSnapshot(): ThemeValue {
  return "classic";
}

export function BackgroundBrightnessControl() {
  const offset = useSyncExternalStore(subscribe, getOffsetSnapshot, getOffsetServerSnapshot);
  // 同时订阅主题变化：切主题时要用新主题的调色板重新计算，否则会残留上一个主题的覆盖值。
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getThemeServerSnapshot);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyBrightness(theme, offset);
  }, [theme, offset]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function setOffset(next: number) {
    const clamped = Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, next));
    window.localStorage.setItem(BRIGHTNESS_STORAGE_KEY, String(clamped));
    window.dispatchEvent(new Event(BRIGHTNESS_CHANGE_EVENT));
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="调节背景亮度"
        aria-expanded={open}
        title="背景亮度"
        className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:-translate-y-0.5"
        style={{
          borderColor: open || offset !== 0 ? "var(--app-accent)" : "var(--app-border)",
          backgroundColor: "transparent",
          color: "var(--app-text)",
        }}
      >
        <SunMedium size={15} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="app-card absolute right-0 top-11 z-40 w-64 rounded-2xl border p-4"
          role="dialog"
          aria-label="背景亮度调节"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: "var(--app-text)" }}>
              背景亮度
            </span>
            {offset !== 0 && (
              <button
                type="button"
                onClick={() => setOffset(0)}
                className="flex items-center gap-1 text-[11px] font-semibold transition hover:opacity-70"
                style={{ color: "var(--app-muted)" }}
              >
                <RotateCcw size={11} aria-hidden="true" />
                重置
              </button>
            )}
          </div>

          <input
            type="range"
            min={MIN_OFFSET}
            max={MAX_OFFSET}
            step={1}
            value={offset}
            onChange={(event) => setOffset(Number(event.target.value))}
            className="mt-3 w-full accent-[var(--app-accent)]"
            aria-label="背景亮度"
          />

          <div
            className="mt-1.5 flex items-center justify-between text-[11px]"
            style={{ color: "var(--app-muted)" }}
          >
            <span>较暗</span>
            <span className="font-bold" style={{ color: "var(--app-text)" }}>
              {offset > 0 ? `+${offset}` : offset}
            </span>
            <span>较亮</span>
          </div>
        </div>
      )}
    </div>
  );
}
