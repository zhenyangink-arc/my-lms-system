"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseDateString(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

export function ChineseDateInput({
  value,
  onChange,
  name,
  required,
  max,
  placeholder = "选择日期",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  max?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseDateString(value);
  const today = todayParts();
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.month);
  const containerRef = useRef<HTMLDivElement>(null);

  function toggleCalendar() {
    if (open) {
      setOpen(false);
      return;
    }
    const current = parseDateString(value);
    setViewYear(current?.year ?? today.year);
    setViewMonth(current?.month ?? today.month);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function goToPrevMonth() {
    setViewMonth((month) => {
      if (month === 0) {
        setViewYear((year) => year - 1);
        return 11;
      }
      return month - 1;
    });
  }

  function goToNextMonth() {
    setViewMonth((month) => {
      if (month === 11) {
        setViewYear((year) => year + 1);
        return 0;
      }
      return month + 1;
    });
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<{ day: number; inMonth: boolean; dateStr: string }> = [];
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    const month = viewMonth === 0 ? 11 : viewMonth - 1;
    const year = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day, inMonth: false, dateStr: toDateString(year, month, day) });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, inMonth: true, dateStr: toDateString(viewYear, viewMonth, day) });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const lastInMonthCount = cells.filter((cell) => cell.inMonth).length;
    const day = cells.length - firstWeekday - lastInMonthCount + 1;
    const month = viewMonth === 11 ? 0 : viewMonth + 1;
    const year = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day, inMonth: false, dateStr: toDateString(year, month, day) });
    if (cells.length >= 42) break;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggleCalendar}
        className={
          className ??
          "app-input mt-1.5 w-full rounded-xl border px-2.5 py-2 text-left text-[11px] outline-none"
        }
      >
        {value || <span style={{ color: "var(--app-muted)" }}>{placeholder}</span>}
      </button>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      {open && (
        <div
          className="app-card absolute z-20 mt-1.5 w-64 rounded-xl border p-3 text-xs shadow-lg"
          style={{ backgroundColor: "var(--app-card-bg)" }}
        >
          <div className="flex items-center justify-between">
            <button type="button" onClick={goToPrevMonth} className="rounded-lg p-1 hover:opacity-70">
              <ChevronLeft size={14} />
            </button>
            <p className="font-black">{viewYear}年{pad2(viewMonth + 1)}月</p>
            <button type="button" onClick={goToNextMonth} className="rounded-lg p-1 hover:opacity-70">
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center app-muted-text">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="text-[10px] font-bold">{label}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 text-center">
            {cells.map((cell, index) => {
              const isSelected = cell.dateStr === value;
              const isToday = cell.dateStr === toDateString(today.year, today.month, today.day);
              const isUnavailable = Boolean(max && cell.dateStr > max);
              return (
                <button
                  key={`${cell.dateStr}-${index}`}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => {
                    if (isUnavailable) return;
                    onChange(cell.dateStr);
                    setOpen(false);
                  }}
                  className="rounded-lg py-1 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-35"
                  style={{
                    color: cell.inMonth ? "inherit" : "var(--app-muted)",
                    backgroundColor: isSelected ? "var(--app-accent)" : "transparent",
                    ...(isSelected ? { color: "#fff" } : {}),
                    outline: isToday && !isSelected ? "1px solid var(--app-accent)" : undefined,
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="app-muted-text mt-2 flex items-center justify-between text-[10px] font-bold">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              清除
            </button>
            <button
              type="button"
              onClick={() => {
                const todayValue = toDateString(today.year, today.month, today.day);
                if (!max || todayValue <= max) onChange(todayValue);
                setOpen(false);
              }}
              disabled={Boolean(max && toDateString(today.year, today.month, today.day) > max)}
              className="disabled:cursor-not-allowed disabled:opacity-35"
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
