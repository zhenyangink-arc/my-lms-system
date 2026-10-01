"use client";

import { useState, useSyncExternalStore } from "react";

import { localDateTimeToIso, toLocalDateTimeInputValue } from "@/lib/local-datetime";

const subscribeNothing = () => () => {};

/**
 * 跟随用户电脑时区的日期时间输入（产品决定 2026-10-01：时间一律按电脑时区理解）。
 * 可见输入框不带 name；提交的是名为 `name` 的隐藏字段，值是换算成 UTC 的 ISO 字符串，
 * 服务端动作原样采用，不再按韩国时间或服务器时区解析。清空输入框提交空字符串。
 * `defaultValue` 是存储的时间点（ISO 字符串），初始显示值在浏览器里按电脑时区换算；
 * 服务端渲染时先显示空值，水合后立即显示本地值（不会因服务器时区不同而不一致）。
 */
export function LocalDateTimeField({
  name,
  defaultValue,
  required,
  className,
  ariaLabel,
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const initial = useSyncExternalStore(
    subscribeNothing,
    () => {
      if (!defaultValue) return "";
      const date = new Date(defaultValue);
      return Number.isNaN(date.getTime()) ? "" : toLocalDateTimeInputValue(date);
    },
    () => "",
  );
  const [edited, setEdited] = useState<string | null>(null);
  const value = edited ?? initial;
  return (
    <>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => setEdited(event.target.value)}
        required={required}
        aria-label={ariaLabel}
        className={className}
      />
      <input type="hidden" name={name} value={localDateTimeToIso(value)} />
    </>
  );
}
