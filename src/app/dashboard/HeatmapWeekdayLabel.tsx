"use client";

import { useEffect, useState } from "react";

const WEEKDAY_OPTIONS: Intl.DateTimeFormatOptions = { weekday: "short" };

// dateString（如 "2026-08-05"）代表的日历日已经在服务端按学习记录聚合定死，这里
// 只是把它翻译成星期几的短标签，用访问者本地时区不会影响是哪一天，只影响标签本身
// 会不会因为服务端不知道时区而先显示 UTC 版本、挂载后再纠正成本地版本。
export function HeatmapWeekdayLabel({ dateString }: { dateString: string }) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const [label, setLabel] = useState(() =>
    new Intl.DateTimeFormat("zh-CN", { ...WEEKDAY_OPTIONS, timeZone: "UTC" }).format(date)
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(new Intl.DateTimeFormat("zh-CN", WEEKDAY_OPTIONS).format(date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateString]);

  return <>{label}</>;
}
