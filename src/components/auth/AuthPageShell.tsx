import type { ReactNode } from "react";
import {
  BookOpenCheck,
  Check,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Languages,
  Sparkles,
  UserRound,
} from "lucide-react";

import styles from "./auth.module.css";

type AuthVariant = "login" | "register";

const shellContent = {
  login: {
    badge: "欢迎回到你的成长路线",
    title: "继续上一次的学习与规划",
    description:
      "登录后查看课程进度、老师反馈和留学任务，让今天的每一步都接在昨天的成长上。",
    icon: Compass,
    steps: [
      [GraduationCap, "院校方案", "已经保存"],
      [Languages, "韩语成长", "持续记录"],
      [BookOpenCheck, "本周任务", "等待继续"],
    ],
  },
  register: {
    badge: "建立你的专属成长档案",
    title: "从一个名字开始，让目标逐渐清晰",
    description:
      "注册后可以保存留学路线、课程进度和学习反馈，把零散准备变成一套看得见的成长计划。",
    icon: UserRound,
    steps: [
      [UserRound, "填写基本信息", "认识你的起点"],
      [ClipboardCheck, "建立成长档案", "保存目标与进度"],
      [BookOpenCheck, "开始规划学习", "每一步都有记录"],
    ],
  },
} as const;

export function AuthPageShell({
  variant,
  children,
}: {
  variant: AuthVariant;
  children: ReactNode;
}) {
  const content = shellContent[variant];
  const MainIcon = content.icon;

  return (
    <div className={`${styles.authBackdrop} min-h-[calc(100vh-76px)] px-5 py-12 sm:px-8 sm:py-16`}>
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#ffd9c8]/45 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-12 h-80 w-80 rounded-full bg-[#ccecff]/55 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.54fr_0.46fr] lg:gap-16">
        <section className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#c8e4f3] bg-white/85 px-4 py-2 text-sm font-black text-[#327ca7] shadow-sm backdrop-blur">
            <Sparkles size={16} />
            {content.badge}
          </span>
          <h1 className="mt-6 text-4xl font-black leading-[1.15] tracking-[-0.04em] text-[#173d59] sm:text-5xl">
            {content.title}
          </h1>
          <p className="mt-5 text-base leading-8 text-[#607a8c] sm:text-lg">
            {content.description}
          </p>

          {/* 进度卡把账号动作和用户的成长目标建立直接联系。 */}
          <div className="relative mt-9 rounded-[2rem] border border-white/90 bg-white/82 p-5 text-left shadow-[0_24px_65px_rgba(58,111,145,0.14)] backdrop-blur sm:p-6">
            <div className="flex items-center justify-between border-b border-[#e4eef3] pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e7f5fd] text-[#3488b7]">
                  <MainIcon size={22} />
                </span>
                <div>
                  <p className="text-xs font-black text-[#8195a2]">成长档案</p>
                  <p className="mt-0.5 font-black text-[#264d68]">
                    {variant === "login" ? "等待你继续" : "三步即可开始"}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#fff0e9] px-3 py-1.5 text-xs font-black text-[#dd6b51]">
                {variant === "login" ? "已保存" : "待建立"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {content.steps.map(([Icon, title, note], index) => (
                <div key={title} className="rounded-2xl bg-[#f7fbfd] p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#4c94bb] shadow-sm">
                      <Icon size={18} />
                    </span>
                    {variant === "login" && index < 2 ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e7f7ed] text-[#45a46c]">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="text-xl font-black text-[#d8e7ee]">{index + 1}</span>
                    )}
                  </div>
                  <p className="mt-4 text-sm font-black text-[#315773]">{title}</p>
                  <p className="mt-1 text-xs font-bold text-[#8298a7]">{note}</p>
                </div>
              ))}
            </div>

            <div className={`${styles.softFloat} absolute -bottom-5 -right-3 hidden items-center gap-2 rounded-2xl border border-[#d6eadf] bg-white px-4 py-3 text-sm font-black text-[#3d7b59] shadow-lg sm:flex`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f7ee]">
                <Check size={16} strokeWidth={3} />
              </span>
              信息安全保存
            </div>
          </div>
        </section>

        <div className={`${styles.cardEnter} mx-auto w-full max-w-md`}>{children}</div>
      </div>
    </div>
  );
}
