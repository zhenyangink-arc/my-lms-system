import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { YuanzhiAiChat } from "../YuanzhiAiChat";
import styles from "../ai-chat.module.css";

export const metadata: Metadata = {
  title: "使用元智AI｜韩语口语老师",
  description: "用文字或语音和元智AI韩语老师进行真实场景练习。",
};

export default function YuanzhiAiChatPage() {
  return (
    <div className={`${styles.pageShell} min-h-[calc(100vh-76px)]`}>
      <div className="mx-auto max-w-[1480px] px-4 pt-5 sm:px-6 lg:px-8">
        <Link
          href="/yuanzhi-ai"
          className="inline-flex items-center gap-2 rounded-full border border-[#d8e9f1] bg-white/80 px-4 py-2 text-xs font-black text-[#52758a] shadow-sm transition hover:-translate-x-0.5 hover:bg-white"
        >
          <ArrowLeft size={14} /> 返回元智AI能力中心
        </Link>
      </div>
      <YuanzhiAiChat />
    </div>
  );
}
