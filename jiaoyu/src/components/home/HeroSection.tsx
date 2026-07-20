import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  Check,
  Compass,
  GraduationCap,
  MessageCircleMore,
  Plane,
  Sparkles,
} from "lucide-react";

import styles from "./home.module.css";

const preparationItems = [
  { label: "目标与预算", state: "已明确" },
  { label: "院校与专业", state: "规划中" },
  { label: "韩语能力", state: "持续成长" },
];

const marqueeItems = [
  "院校定位",
  "专业匹配",
  "材料准备",
  "韩语提升",
  "面试表达",
  "入学适应",
];

export function HeroSection() {
  return (
    <>
      <section className={`${styles.heroGrid} relative isolate overflow-hidden pb-20 pt-14 sm:pb-28 sm:pt-20`}>
        {/* 彩色光斑作为视觉背景，不使用暗色或外部图片。 */}
        <div className="pointer-events-none absolute -left-24 top-36 h-72 w-72 rounded-full bg-[#cfdbff]/55 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-16 h-80 w-80 rounded-full bg-[#ccecff]/65 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#b9e0f7] bg-white/85 px-4 py-2 text-sm font-bold text-[#2877a9] shadow-sm backdrop-blur">
              <Sparkles size={16} />
              韩国留学规划与韩语教育一体化
            </div>

            <h1 className="mx-auto mt-7 max-w-3xl text-[2.65rem] font-black leading-[1.12] tracking-[-0.045em] text-[#153754] sm:text-5xl lg:mx-0 lg:text-6xl">
              <span className="block">让每一步留学</span>
              <span className="mt-2 block">准备，都成为</span>
              <span className="relative mt-2 inline-block text-[#5393f0]">
                看得见的成长
                <span className="absolute -bottom-1 left-0 h-3 w-full -rotate-1 rounded-full bg-[#c8dbff]/70 -z-10" />
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-base font-medium leading-8 text-[#587087] sm:text-lg lg:mx-0">
              从院校定位、专业选择到申请准备，再到韩语表达与韩国生活适应，
              我们把复杂的留学过程拆成一条清晰、可执行、可追踪的成长路线。
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="#start-plan"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5e9bf5] px-7 py-4 text-base font-black text-white shadow-[0_16px_35px_rgba(94, 155, 245,0.28)] transition hover:-translate-y-1 hover:bg-[#4e8ee9]"
              >
                获取专属成长方案
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="#growth-path"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#bdd9ea] bg-white/90 px-7 py-4 text-base font-black text-[#245776] shadow-sm transition hover:-translate-y-1 hover:border-[#78bde5] hover:bg-[#f5faff]"
              >
                <Compass size={18} />
                查看双线成长路线
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-bold text-[#526d82] lg:justify-start">
              {[
                [Check, "规划节点清晰"],
                [MessageCircleMore, "韩语场景训练"],
                [BookOpenCheck, "成果持续沉淀"],
              ].map(([Icon, label]) => {
                const FeatureIcon = Icon as typeof Check;
                return (
                  <span key={label as string} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dff5e8] text-[#2f9860]">
                      <FeatureIcon size={14} strokeWidth={3} />
                    </span>
                    {label as string}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 右侧用成长护照和浮动状态卡展示产品价值。 */}
          <div className="relative mx-auto w-full max-w-[560px] lg:ml-auto">
            <div className={`${styles.softFloat} absolute -left-5 -top-10 z-20 hidden rounded-2xl border border-[#c8dbff] bg-white px-4 py-3 shadow-[0_16px_40px_rgba(68,112,143,0.15)] sm:block`}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f4ff] text-[#5894ef]">
                  <GraduationCap size={20} />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#7990a1]">当前目标</p>
                  <p className="mt-0.5 text-sm font-black text-[#234967]">找到适合自己的院校</p>
                </div>
              </div>
            </div>

            <div className={`${styles.softFloatDelay} absolute -right-3 bottom-16 z-20 hidden rounded-2xl border border-[#cdebd9] bg-white px-4 py-3 shadow-[0_16px_40px_rgba(68,112,143,0.14)] sm:block`}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f7ee] text-[#3b9c68]">
                  <MessageCircleMore size={20} />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#7990a1]">本周韩语成长</p>
                  <p className="mt-0.5 text-sm font-black text-[#234967]">开口表达更自然</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2.25rem] border border-white/90 bg-white/92 p-5 shadow-[0_30px_80px_rgba(48,107,147,0.18)] backdrop-blur sm:p-7">
              <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[#dff3ff]" />
              <div className="relative flex items-center justify-between border-b border-[#e8f1f6] pb-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f3ff] text-[#348ac0]">
                    <Plane size={23} />
                  </span>
                  <div>
                    <p className="text-xs font-black tracking-[0.18em] text-[#6e8ca2]">我的成长护照</p>
                    <p className="mt-1 text-lg font-black text-[#1d4665]">韩国留学准备路线</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#eaf4ff] px-3 py-1.5 text-xs font-black text-[#4e8de9]">
                  进行中
                </span>
              </div>

              <div className="relative mt-6 space-y-5">
                <div className="absolute bottom-6 left-[18px] top-6 w-px bg-gradient-to-b from-[#6ab9e8] via-[#7dacff] to-[#75c995]" />
                {preparationItems.map((item, index) => (
                  <div key={item.label} className="relative flex items-center gap-4 rounded-2xl bg-[#f8fbfd] p-4">
                    <span
                      className={`${index === 1 ? styles.routePulse : ""} z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-4 border-white text-xs font-black text-white ${
                        index === 0
                          ? "bg-[#62b2df]"
                          : index === 1
                            ? "bg-[#5e96f1]"
                            : "bg-[#65bd86]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-[#264d69]">{item.label}</p>
                      <p className="mt-1 text-xs font-bold text-[#7990a1]">{item.state}</p>
                    </div>
                    {index === 0 ? (
                      <Check className="text-[#45a66a]" size={20} />
                    ) : index === 1 ? (
                      <CalendarCheck2 className="text-[#5891ec]" size={20} />
                    ) : (
                      <BookOpenCheck className="text-[#53aa78]" size={20} />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#eaf4ff] p-4">
                  <p className="text-xs font-bold text-[#5d8299]">下一个关键节点</p>
                  <p className="mt-1 text-sm font-black text-[#235777]">完成院校梯度方案</p>
                </div>
                <div className="rounded-2xl bg-[#ebf5ff] p-4">
                  <p className="text-xs font-bold text-[#6b738e]">今日学习建议</p>
                  <p className="mt-1 text-sm font-black text-[#3b619b]">练习校园情境表达</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 循环信息带让首屏与后续内容自然衔接。 */}
      <div className="overflow-hidden border-y border-[#d9ecf7] bg-[#eef7ff] py-4" aria-label="服务范围">
        <div className={styles.marqueeTrack}>
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <div key={`${item}-${index}`} className="flex items-center gap-5 px-5 text-sm font-black text-[#3d718e] sm:px-8 sm:text-base">
              <span className="h-2 w-2 rounded-full bg-[#669cf5]" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
