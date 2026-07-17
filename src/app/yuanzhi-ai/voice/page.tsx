import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AudioLines } from "lucide-react";

import { VoiceStudio } from "./VoiceStudio";
import styles from "../ai-hub.module.css";

export const metadata: Metadata = {
  title: "智能语音工具｜元智AI",
  description: "使用元智AI完成语音转文字、自然语音生成和本人声音克隆。",
};

export default function YuanzhiAiVoicePage() {
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
              <span className="inline-flex items-center gap-2 rounded-full bg-[#fff0eb] px-4 py-2 text-xs font-black tracking-[0.1em] text-[#d46750]">
                <AudioLines size={15} /> 智能语音实验室
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-[#1d4864] sm:text-5xl">让声音变成内容，也让文字拥有声音</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#6d8797] sm:text-base">
                一个页面完成语音转写与自然语音生成。支持中韩双语、主题音色，以及上传本人声音样本进行克隆。
              </p>
            </div>
          </div>
        </section>

        <VoiceStudio />
      </main>
    </div>
  );
}
