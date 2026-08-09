"use client";

import { useEffect, useState } from "react";

const LOCALE = "zh-CN";

function formatDate(date: Date, options: Intl.DateTimeFormatOptions, timeZone?: string) {
  return new Intl.DateTimeFormat(LOCALE, timeZone ? { ...options, timeZone } : options).format(date);
}

/**
 * 按访问者本地时区显示时间。服务端渲染时不知道访问者在哪个时区，首次渲染先用 UTC
 * 兜底（服务端和客户端首次渲染算出来的结果一致，不会有 hydration 报错）；挂载后
 * 用 useEffect 换成浏览器本地时区重新格式化一次，这时才是访问者实际看到的本地时间。
 */
export function LocalDateTime({
  value,
  options,
  fallback = "—",
}: {
  value: string | number | Date | null | undefined;
  options: Intl.DateTimeFormatOptions;
  fallback?: string;
}) {
  const date = value === null || value === undefined ? null : new Date(value);
  const isValid = date !== null && !Number.isNaN(date.getTime());

  const [formatted, setFormatted] = useState(() =>
    isValid ? formatDate(date, options, "UTC") : fallback
  );

  useEffect(() => {
    // options 由调用方以模块级常量传入，运行期间不会变化；只需要在 value 变化时重算。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormatted(isValid ? formatDate(date, options) : fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, value]);

  return <>{formatted}</>;
}
