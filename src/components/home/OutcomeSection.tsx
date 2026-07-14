import {
  BarChart3,
  BookMarked,
  CheckCircle2,
  ClipboardList,
  LineChart,
  MessageSquareMore,
  Trophy,
} from "lucide-react";

import styles from "./home.module.css";

const skillItems = [
  { label: "听力理解", width: "78%", color: "bg-[#69b8e4]" },
  { label: "口语表达", width: "64%", color: "bg-[#f28a6f]" },
  { label: "阅读能力", width: "86%", color: "bg-[#68bd85]" },
  { label: "写作能力", width: "71%", color: "bg-[#f0b95f]" },
];

const activityColors = [
  "bg-[#dff2fc]",
  "bg-[#9fd6f2]",
  "bg-[#62b7e2]",
  "bg-[#eaf7ee]",
  "bg-[#8fd2a8]",
  "bg-[#fbe4da]",
  "bg-[#f49a80]",
  "bg-[#dff2fc]",
  "bg-[#7bc4e8]",
  "bg-[#eaf7ee]",
  "bg-[#61ba82]",
  "bg-[#fff0c9]",
  "bg-[#efbb58]",
  "bg-[#fbe4da]",
  "bg-[#f27f63]",
  "bg-[#dff2fc]",
  "bg-[#a6daf3]",
  "bg-[#eaf7ee]",
  "bg-[#76c993]",
  "bg-[#fbe4da]",
  "bg-[#f6af9b]",
];

export function OutcomeSection() {
  return (
    <section id="outcomes" className="scroll-mt-24 bg-[#f4fbff] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-end gap-6 lg:grid-cols-[0.62fr_0.38fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#3782ad] shadow-sm">
              <LineChart size={16} />
              成长成果可视化
            </span>
            <h2 className="mt-5 max-w-3xl text-3xl font-black tracking-[-0.035em] text-[#173b57] sm:text-5xl">
              学习成果，不只是一张成绩单
            </h2>
          </div>
          <p className="text-base leading-8 text-[#607b8e] sm:text-lg">
            每一次学习、提问和任务完成，都会沉淀为清晰的成长记录，让学生和老师都知道下一步该做什么。
          </p>
        </div>

        {/* 下方是学习控制台的明亮示意，不展示虚构的真实学生数据。 */}
        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          <article className="rounded-[2rem] border border-[#dcebf3] bg-white p-6 shadow-[0_18px_50px_rgba(64,118,151,0.1)] sm:p-8 lg:col-span-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[#7290a3]">四项韩语能力轨迹</p>
                <h3 className="mt-1 text-2xl font-black text-[#214b68]">知道优势，也知道下一步</h3>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e7f5fd] text-[#3587b6]">
                <BarChart3 size={22} />
              </span>
            </div>

            <div className="mt-8 space-y-5">
              {skillItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm font-bold">
                    <span className="text-[#46657a]">{item.label}</span>
                    <span className="text-[#86a0b1]">持续积累</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#edf4f7]">
                    <div
                      className={`${styles.progressSheen} ${item.color} h-full rounded-full`}
                      style={{ width: item.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#f6daca] bg-[#fff6f0] p-6 sm:p-8 lg:col-span-5">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#ffdfd2]" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-[#ae725f]">留学准备进度</p>
                <h3 className="mt-1 text-2xl font-black text-[#7f4435]">申请任务同步积累</h3>
              </div>
              <ClipboardList className="text-[#e8795d]" size={26} />
            </div>

            <div className="relative mt-8 flex flex-col items-center gap-7 sm:flex-row">
              <div
                className="grid h-36 w-36 shrink-0 place-items-center rounded-full p-3"
                style={{
                  background:
                    "conic-gradient(#f08367 0deg 282deg, #f7ddcf 282deg 360deg)",
                }}
                aria-label="留学准备进度持续更新"
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-white text-center shadow-inner">
                  <div>
                    <p className="text-2xl font-black text-[#c75f47]">同步</p>
                    <p className="mt-1 text-xs font-bold text-[#a17b6d]">规划与行动</p>
                  </div>
                </div>
              </div>
              <div className="w-full space-y-3">
                {["院校梯度方案", "材料准备清单", "入学衔接任务"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-white/75 px-4 py-3">
                    {index < 2 ? (
                      <CheckCircle2 size={18} className="shrink-0 text-[#50a875]" />
                    ) : (
                      <span className={`${styles.routePulse} h-4 w-4 shrink-0 rounded-full bg-[#f08063]`} />
                    )}
                    <span className="text-sm font-black text-[#785547]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-[#dcebf3] bg-white p-6 sm:p-8 lg:col-span-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-[#7290a3]">学习连续性</p>
                <h3 className="mt-1 text-2xl font-black text-[#214b68]">每天一点，成长有迹可循</h3>
              </div>
              <Trophy size={24} className="text-[#e5aa3b]" />
            </div>
            <div className="mt-7 grid grid-cols-7 gap-2" aria-label="学习活跃记录示意">
              {activityColors.map((color, index) => (
                <span key={index} className={`aspect-square rounded-md ${color}`} />
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-[#6a8293]">
              课程进度、练习记录与老师反馈汇总在同一个成长档案中。
            </p>
          </article>

          <article className="rounded-[2rem] border border-[#d8eadf] bg-[#f2fbf5] p-6 sm:p-8 lg:col-span-7">
            <div className="grid gap-6 sm:grid-cols-[0.45fr_0.55fr] sm:items-center">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#45a56e] shadow-sm">
                  <BookMarked size={23} />
                </span>
                <h3 className="mt-5 text-2xl font-black text-[#245a40]">属于你的成长档案</h3>
                <p className="mt-3 text-sm leading-7 text-[#5e806e]">
                  不只记录“学过什么”，更记录“已经会做什么”。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [BookMarked, "课程学习记录"],
                  [MessageSquareMore, "师生问答反馈"],
                  [ClipboardList, "申请任务节点"],
                  [Trophy, "阶段成果归档"],
                ].map(([Icon, label]) => {
                  const ItemIcon = Icon as typeof BookMarked;
                  return (
                    <div key={label as string} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#37634d] shadow-sm">
                      <ItemIcon size={17} className="shrink-0 text-[#55ac78]" />
                      {label as string}
                    </div>
                  );
                })}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
