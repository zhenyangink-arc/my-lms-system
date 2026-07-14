import Link from "next/link";
import { ArrowRight, Check, MessageCircleMore, Sparkles } from "lucide-react";

export function QuestionSection() {
  return (
    <section id="start-plan" className="scroll-mt-24 bg-[#fffdf8] px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-[#cfe8f6] bg-gradient-to-br from-[#e9f7ff] via-[#fff8f1] to-[#eaf9ef] px-6 py-12 shadow-[0_26px_70px_rgba(61,117,150,0.13)] sm:px-12 sm:py-16 lg:px-16">
        <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-[#ccecff]/70 blur-2xl" />
        <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[#ffd9ca]/65 blur-2xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[0.62fr_0.38fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-black text-[#4a809e] shadow-sm">
              <Sparkles size={16} />
              从今天开始变清晰
            </span>
            <h2 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-[-0.035em] text-[#173b57] sm:text-5xl">
              你的韩国留学计划，
              <br className="hidden sm:block" />
              可以从一个明确目标开始
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#5d788b] sm:text-lg">
              告诉我们你的学习阶段、专业方向和韩语基础，先建立属于你的成长起点。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f3785b] px-7 py-4 text-base font-black text-white shadow-[0_16px_35px_rgba(243,120,91,0.25)] transition hover:-translate-y-1 hover:bg-[#e4674b]"
              >
                免费建立成长档案
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/dashboard/help"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white bg-white/85 px-7 py-4 text-base font-black text-[#2d6482] shadow-sm transition hover:-translate-y-1 hover:bg-white"
              >
                <MessageCircleMore size={18} />
                查看常见问题
              </Link>
            </div>
          </div>

          {/* 咨询准备清单帮助用户理解开始规划所需的信息。 */}
          <div className="rounded-[2rem] border border-white/90 bg-white/80 p-6 shadow-lg backdrop-blur sm:p-7">
            <p className="text-sm font-black text-[#7690a1]">开始前，只需想清楚三件事</p>
            <div className="mt-5 space-y-4">
              {[
                "想去韩国学习什么",
                "目前处于哪个学习阶段",
                "最希望优先解决什么问题",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-[#f8fbfd] px-4 py-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f7ee] text-[#45a56e]">
                    <Check size={16} strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-[#9aabb6]">第 {index + 1} 项</p>
                    <p className="mt-0.5 text-sm font-black text-[#365c74]">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
