"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number) {
  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

// 问候语按访问者本地时间的小时数决定；服务端不知道访问者时区，先用中性的
// "你好" 兜底，挂载后再按浏览器本地时间纠正一次。
export function Greeting({ studentName }: { studentName: string }) {
  const [greeting, setGreeting] = useState("你好");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <>
      {greeting}，{studentName}
    </>
  );
}
