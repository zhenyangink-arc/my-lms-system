import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ScanLine, Sparkles } from "lucide-react";

import { ContentStudio } from "./ContentStudio";
import styles from "../ai-hub.module.css";

export const metadata: Metadata = {
  title: "图像与文章工作台｜元智AI",
  description: "使用元智AI识别图像内容、提取文字并自动整理文章。",
};

export default function YuanzhiAiContentPage() {
  return (
    <div className={styles.pageShell}>
      <main className="mx-auto w-full max-w-[1380px] px-4 pb-20 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <Link
          href="/yuanzhi-ai"
          className="inline-flex items-center gap-2 rounded-full border border-[#d8e9f1] bg-white/80 px-4 py-2 text-xs font-black text-[#52758a] shadow-sm transition hover:-translate-x-0.5 hover:bg-white"
        >
          <ArrowLeft size={14} /> 返回元智AI能力中心
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2.25rem] border border-white/90 bg-white/72 px-5 py-8 shadow-[0_28px_80px_rgba(49,95,124,0.13)] backdrop-blur sm:px-9 sm:py-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#f2edfb] px-4 py-2 text-xs font-black tracking-[0.1em] text-[#7863aa]">
                <ScanLine size={15} /> 图像与文章工作台
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-[#1d4864] sm:text-5xl">看懂图片，把零散内容整理成清晰答案</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#6d8797] sm:text-base">
                上传学习材料、截图或照片进行识别，也可以粘贴长文章，一键生成摘要、重点和重新排版后的内容。
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#e2daef] bg-white/80 px-4 py-3 text-xs font-black text-[#6e6092]">
              <Sparkles size={15} /> 内容理解工作流
            </span>
          </div>
        </section>

        <ContentStudio />
      </main>
    </div>
  );
}
