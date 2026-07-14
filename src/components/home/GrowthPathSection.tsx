"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileText,
  GraduationCap,
  Languages,
  MapPinned,
  MessageSquareText,
  PlaneTakeoff,
  School,
  Sparkles,
} from "lucide-react";

import styles from "./home.module.css";

type TrackKey = "study" | "language";

type TrackStep = {
  title: string;
  description: string;
  note: string;
  icon: LucideIcon;
};

type Track = {
  label: string;
  title: string;
  description: string;
  result: string;
  icon: LucideIcon;
  steps: TrackStep[];
};

const tracks: Record<TrackKey, Track> = {
  study: {
    label: "留学规划路线",
    title: "把复杂申请拆成四个清晰阶段",
    description:
      "从了解自己开始，逐步完成院校定位、申请材料和入学衔接，每个阶段都有明确行动。",
    result: "形成一份适合自己的可执行留学方案",
    icon: PlaneTakeoff,
    steps: [
      {
        title: "目标画像",
        description: "梳理专业兴趣、学习基础、预算与理想城市。",
        note: "先了解自己",
        icon: Compass,
      },
      {
        title: "院校定位",
        description: "建立冲刺、匹配、稳妥的院校与专业梯度。",
        note: "找到合适方向",
        icon: School,
      },
      {
        title: "申请准备",
        description: "按时间节点推进材料、文书与面试表达。",
        note: "逐项完成任务",
        icon: FileText,
      },
      {
        title: "入学衔接",
        description: "提前准备签证、住宿、选课与校园生活。",
        note: "安心开启留学",
        icon: MapPinned,
      },
    ],
  },
  language: {
    label: "韩语成长路线",
    title: "让韩语能力真正服务留学生活",
    description:
      "不只追求考试分数，还围绕课堂、面试、生活与社交场景，持续积累能开口、能应用的能力。",
    result: "建立一套可追踪、可应用的韩语能力档案",
    icon: Languages,
    steps: [
      {
        title: "能力诊断",
        description: "了解听、说、读、写的真实基础与薄弱环节。",
        note: "找到提升起点",
        icon: ClipboardCheck,
      },
      {
        title: "目标拆分",
        description: "把等级目标转化为每周可完成的学习任务。",
        note: "每天知道学什么",
        icon: BookOpenCheck,
      },
      {
        title: "场景训练",
        description: "练习面试、课堂、租房、交通等真实表达。",
        note: "学完马上能用",
        icon: MessageSquareText,
      },
      {
        title: "成果沉淀",
        description: "记录作业、提问、反馈和能力变化轨迹。",
        note: "看见持续进步",
        icon: GraduationCap,
      },
    ],
  },
};

export function GrowthPathSection() {
  const [activeTrack, setActiveTrack] = useState<TrackKey>("study");
  const track = tracks[activeTrack];
  const TrackIcon = track.icon;

  return (
    <section id="growth-path" className="scroll-mt-24 bg-[#fffdf8] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f6ff] px-4 py-2 text-sm font-black text-[#2879a9]">
            <Sparkles size={16} />
            双线成长体系
          </span>
          <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-[#173b57] sm:text-5xl">
            两条成长线，同一个留学目标
          </h2>
          <p className="mt-5 text-base leading-8 text-[#61798b] sm:text-lg">
            留学规划解决“下一步往哪里走”，韩语成长解决“到了韩国如何真正学习和生活”。
          </p>
        </div>

        {/* 两个标签控制同一块内容，切换时保留清晰的键盘焦点和选中状态。 */}
        <div
          className="mx-auto mt-10 flex max-w-xl rounded-2xl border border-[#d6e8f2] bg-white p-1.5 shadow-sm"
          role="tablist"
          aria-label="成长路线选择"
        >
          {(Object.keys(tracks) as TrackKey[]).map((key) => {
            const item = tracks[key];
            const Icon = item.icon;
            const active = activeTrack === key;

            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTrack(key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition sm:text-base ${
                  active
                    ? key === "study"
                      ? "bg-[#e6f5ff] text-[#226f9d] shadow-sm"
                      : "bg-[#fff0e9] text-[#c95f48] shadow-sm"
                    : "text-[#7790a2] hover:bg-[#f7fafc]"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          key={activeTrack}
          className={`${styles.panelEnter} mt-10 grid overflow-hidden rounded-[2rem] border border-[#dceaf2] bg-white shadow-[0_24px_70px_rgba(56,111,147,0.11)] lg:grid-cols-[0.36fr_0.64fr]`}
          role="tabpanel"
        >
          <div
            className={`relative overflow-hidden p-7 sm:p-10 ${
              activeTrack === "study" ? "bg-[#eaf7ff]" : "bg-[#fff1eb]"
            }`}
          >
            <div
              className={`absolute -right-14 -top-14 h-40 w-40 rounded-full ${
                activeTrack === "study" ? "bg-[#c7eaff]" : "bg-[#ffd9cc]"
              }`}
            />
            <div className="relative">
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg ${
                  activeTrack === "study" ? "bg-[#54a9d9]" : "bg-[#f47d60]"
                }`}
              >
                <TrackIcon size={28} />
              </span>
              <p className="mt-8 text-sm font-black tracking-[0.16em] text-[#6d8799]">
                {track.label}
              </p>
              <h3 className="mt-3 text-3xl font-black leading-tight text-[#1d4966]">
                {track.title}
              </h3>
              <p className="mt-5 text-sm leading-7 text-[#5d788b] sm:text-base">
                {track.description}
              </p>
              <div className="mt-8 rounded-2xl border border-white/80 bg-white/75 p-4 backdrop-blur">
                <p className="flex items-start gap-2 text-sm font-black leading-6 text-[#285671]">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#4fa775]" />
                  {track.result}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8">
            {track.steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <article
                  key={step.title}
                  className="group relative overflow-hidden rounded-2xl border border-[#e2edf3] bg-[#fbfdfe] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#b9dced] hover:bg-white hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                        activeTrack === "study"
                          ? "bg-[#e2f3fd] text-[#348bc0]"
                          : "bg-[#ffebe4] text-[#db674e]"
                      }`}
                    >
                      <StepIcon size={21} />
                    </span>
                    <span className="text-3xl font-black text-[#dbe9f0]">{index + 1}</span>
                  </div>
                  <p className="mt-5 text-xs font-black text-[#7190a3]">{step.note}</p>
                  <h4 className="mt-1 text-xl font-black text-[#244d69]">{step.title}</h4>
                  <p className="mt-3 text-sm leading-6 text-[#627b8d]">{step.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
