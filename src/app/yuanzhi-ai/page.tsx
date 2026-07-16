import type { Metadata } from "next";

import { YuanzhiAiChat } from "./YuanzhiAiChat";
import styles from "./ai-chat.module.css";

export const metadata: Metadata = {
  title: "元智AI｜韩语口语老师",
  description: "随时用文字或语音与元智 AI 韩语老师练习真实场景表达。",
};

export default function YuanzhiAiPage() {
  return (
    <div className={`${styles.pageShell} min-h-[calc(100vh-76px)]`}>
      <YuanzhiAiChat />
    </div>
  );
}
