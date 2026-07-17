import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  FileText,
  ImageIcon,
  Languages,
  Mic2,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";

import styles from "./ai-hub.module.css";

export const metadata: Metadata = {
  title: "元智AI｜智能学习与内容工具",
  description: "认识元智AI，并进入韩语对话、智能语音和图像内容工作台。",
};

const entries = [
  {
    href: "/yuanzhi-ai/chat",
    eyebrow: "韩语智能老师",
    title: "使用元智AI",
    description: "和韩语智能老师自然对话，练口语、改表达、听中韩双语高质量语音。",
    icon: Bot,
    accent: "blue",
    features: ["中韩双语对话", "按住说话", "自然语音朗读"],
    action: "进入对话教室",
  },
  {
    href: "/yuanzhi-ai/voice",
    eyebrow: "智能语音实验室",
    title: "智能语音工具",
    description: "把录音快速转成文字，或将中韩文本生成自然语音，还可选择主题音色与本人声音克隆。",
    icon: Mic2,
    accent: "coral",
    features: ["语音转文字", "文字转语音", "本人声音克隆"],
    action: "打开语音实验室",
  },
  {
    href: "/yuanzhi-ai/content",
    eyebrow: "图像与文章工作台",
    title: "图像与文章工作台",
    description: "上传图片识别内容，将零散文字自动整理成摘要、重点和清晰文章结构。",
    icon: ScanLine,
    accent: "violet",
    features: ["图像识别", "文字提取", "文章自动整理"],
    action: "进入智能工作台",
  },
] as const;

export default function YuanzhiAiPage() {
  return (
    <div className={styles.pageShell}>
      <main className="mx-auto w-full max-w-[1480px] px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <section className={`${styles.heroPanel} relative overflow-hidden rounded-[2.25rem] border border-white/80 px-5 py-9 shadow-[0_32px_100px_rgba(42,94,126,0.14)] sm:px-10 sm:py-12 lg:px-14 lg:py-16`}>
          <div className={styles.heroGlowOne} />
          <div className={styles.heroGlowTwo} />
          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#cce6f4] bg-white/80 px-4 py-2 text-xs font-black tracking-[0.12em] text-[#3985a9] shadow-sm backdrop-blur">
                <Sparkles size={15} /> 元智AI 能力中心
              </span>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.12] tracking-[-0.055em] text-[#173d59] sm:text-6xl">
                从一句话开始，
                <span className={styles.heroGradientText}>让学习与表达更轻松</span>
              </h1>
              <p className="mt-6 max-w-2xl text-sm font-medium leading-8 text-[#607d8f] sm:text-base">
                元智AI 把韩语陪练、智能语音、图像识别和文章整理放进一个简单入口。
                你只需要选择任务，剩下的交给智能助手完成。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/yuanzhi-ai/chat"
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#297fae] px-6 text-sm font-black text-white shadow-[0_14px_32px_rgba(41,127,174,0.25)] transition hover:-translate-y-0.5 hover:bg-[#216f9a]"
                >
                  立即使用元智AI <ArrowRight size={17} />
                </Link>
                <a
                  href="#ai-entries"
                  className="inline-flex min-h-12 items-center rounded-2xl border border-[#d6e8f1] bg-white/80 px-6 text-sm font-black text-[#476c82] transition hover:border-[#abd3e6] hover:bg-white"
                >
                  查看全部能力
                </a>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[#6e8999]">
                {["中韩双语友好", "统一自然音色", "清晰任务流程"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5f6ed] text-[#44976a]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className={`${styles.heroConsole} relative mx-auto w-full max-w-[500px] rounded-[2rem] border border-white/85 bg-white/82 p-4 shadow-[0_28px_70px_rgba(55,105,136,0.16)] backdrop-blur sm:p-6`}>
              <div className="flex items-center justify-between border-b border-[#e6eff3] pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#67b9e5] to-[#8173c2] text-white shadow-sm">
                    <Sparkles size={22} />
                  </span>
                  <div>
                    <p className="font-black text-[#254f6b]">元智AI</p>
                    <p className="mt-0.5 text-[11px] font-bold text-[#7a94a4]">你的智能学习搭档</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#e9f7ef] px-3 py-1.5 text-[11px] font-black text-[#3f9567]">
                  <span className={`${styles.onlineDot} h-2 w-2 rounded-full bg-[#4ca774]`} /> 在线
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  [Languages, "对话陪练", "自然中韩表达", "#eaf7ff", "#3988b2"],
                  [Volume2, "智能语音", "高质量声音生成", "#fff0eb", "#dc674f"],
                  [ImageIcon, "看懂图片", "识别图像与文字", "#f2edfb", "#8065b1"],
                  [FileText, "整理文章", "摘要与重点提炼", "#edf7ef", "#4f976c"],
                ].map(([Icon, title, description, background, color]) => {
                  const ItemIcon = Icon as typeof Languages;
                  return (
                    <div key={title as string} className="rounded-2xl border border-[#e5eef2] bg-white p-4 shadow-sm">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: background as string, color: color as string }}>
                        <ItemIcon size={17} />
                      </span>
                      <p className="mt-3 text-sm font-black text-[#315a73]">{title as string}</p>
                      <p className="mt-1 text-[11px] font-medium text-[#8299a7]">{description as string}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f4f9fb] px-4 py-3 text-xs font-bold text-[#668396]">
                <ShieldCheck size={17} className="text-[#4c9a70]" />
                你的输入只用于完成当前任务
              </div>
            </div>
          </div>
        </section>

        <section id="ai-entries" className="pt-16 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-black tracking-[0.18em] text-[#5b91ae]">选择需要的工具</span>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#1e4864] sm:text-4xl">今天想让元智AI帮你做什么？</h2>
            <p className="mt-4 text-sm leading-7 text-[#718a99]">三个入口彼此独立，随时可以回到这里切换任务。</p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {entries.map((entry) => {
              const EntryIcon = entry.icon;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`${styles.entryCard} ${styles[entry.accent]} group flex min-h-[390px] flex-col rounded-[2rem] border p-6 sm:p-7`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className={`${styles.entryIcon} flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg`}>
                      <EntryIcon size={25} />
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/75 text-[#55778b] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <ArrowRight size={18} className="-rotate-45" />
                    </span>
                  </div>
                  <p className="mt-8 text-[10px] font-black tracking-[0.16em] text-[#7b93a2]">{entry.eyebrow}</p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#234d68]">{entry.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-7 text-[#688493]">{entry.description}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {entry.features.map((feature) => (
                      <span key={feature} className="rounded-full border border-white/90 bg-white/72 px-3 py-1.5 text-[11px] font-black text-[#5d7b8e] shadow-sm">
                        {feature}
                      </span>
                    ))}
                  </div>
                  <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-black text-[#315f7a]">
                    {entry.action} <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-16 rounded-[2rem] border border-[#dcebf2] bg-white/70 px-5 py-7 shadow-sm sm:px-8">
          <div className="grid gap-6 text-center sm:grid-cols-3 sm:text-left">
            {[
              ["01", "选择能力", "从对话、语音或内容工具中选择入口"],
              ["02", "提供内容", "输入文字、说话或上传你的文件"],
              ["03", "获得结果", "查看、播放、复制或继续优化结果"],
            ].map(([number, title, detail]) => (
              <div key={number} className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eaf6fb] text-xs font-black text-[#3a86aa]">{number}</span>
                <div>
                  <p className="text-sm font-black text-[#315a73]">{title}</p>
                  <p className="mt-1 text-xs leading-6 text-[#7d94a2]">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
