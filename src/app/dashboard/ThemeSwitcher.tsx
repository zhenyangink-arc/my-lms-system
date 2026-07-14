"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Check, Palette } from "lucide-react";

const THEME_STORAGE_KEY = "puffy-dashboard-theme";
const THEME_CHANGE_EVENT = "puffy-dashboard-theme-change";

const themes = [
  {
    value: "default",
    label: "晴空",
    description: "珊瑚与天蓝",
    colors: ["#f47b5f", "#67bed5", "#f6d98b"],
  },
  {
    value: "warm",
    label: "暖阳",
    description: "杏色与琥珀",
    colors: ["#df8651", "#efb65f", "#ead7bb"],
  },
  {
    value: "green",
    label: "清新",
    description: "薄荷与青绿",
    colors: ["#319b7d", "#79c9b1", "#d7efe4"],
  },
  {
    value: "lavender",
    label: "柔紫",
    description: "薰衣草与莓果",
    colors: ["#8c78c6", "#c4b8e8", "#f0dce5"],
  },
  {
    value: "night",
    label: "夜航",
    description: "深蓝与柔和天青",
    colors: ["#16283a", "#4fa8c5", "#f08a70"],
  },
];

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function getThemeSnapshot() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  return themes.some((item) => item.value === savedTheme)
    ? (savedTheme as string)
    : "default";
}

function getThemeServerSnapshot() {
  return "default";
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-puffy-theme", theme);
  }, [theme]);

  function handleThemeChange(nextTheme: string) {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <div className="app-theme-card rounded-2xl border p-3.5">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="app-soft-card flex h-9 w-9 items-center justify-center rounded-xl border">
          <Palette size={17} />
        </div>

        <div>
          <p className="text-sm font-black">界面主题</p>
          <p className="text-[11px] app-muted-text">白天明亮，夜晚舒适</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {themes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => handleThemeChange(item.value)}
            aria-pressed={theme === item.value}
            title={item.description}
            className={`relative flex items-center gap-2 rounded-xl border p-2 text-left transition hover:-translate-y-0.5 ${
              item.value === "night" ? "col-span-2" : ""
            }`}
            style={{
              borderColor: theme === item.value
                ? "var(--app-accent)"
                : "var(--app-border)",
              backgroundColor: theme === item.value
                ? "var(--app-accent-soft)"
                : "var(--app-card-bg)",
            }}
          >
            <span
              className="h-7 w-7 shrink-0 rounded-lg shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${item.colors[0]} 0 38%, ${item.colors[1]} 38% 70%, ${item.colors[2]} 70%)`,
              }}
            />
            <span className="text-xs font-bold">{item.label}</span>
            {theme === item.value && (
              <span
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: "var(--app-accent)" }}
              >
                <Check size={10} strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
