"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Compass,
  Headphones,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Mic2,
  NotebookPen,
  Sparkles,
} from "lucide-react";

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;

export const KOREAN_LEVEL_ONE_GUIDE_PAGE_COUNT = 13;

type PageProps = {
  children: React.ReactNode;
  number: string;
  section?: string;
  cover?: boolean;
};

type FlipBookHandle = {
  pageFlip: () => { flipNext: () => void; flipPrev: () => void } | undefined;
};

type LessonCardProps = {
  number: number;
  korean: string;
  chinese: string;
  focus: string;
};

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { children, number, section = "课程导读", cover = false },
  ref
) {
  return (
    <div
      ref={ref}
      className="h-full overflow-hidden bg-[var(--card)] text-[var(--foreground-secondary)] shadow-sm"
    >
      {cover ? (
        children
      ) : (
        <div className="book-black-copy flex h-full flex-col px-10 py-6">
        <div className="border-b border-[var(--status-success-surface)] pb-2 text-[12px] font-bold tracking-[0.12em]">
            <span className="text-[var(--foreground)]">{section}</span>
          </div>
          <div className="min-h-0 flex-1 pt-5">{children}</div>
        <div className="mt-3 flex justify-between border-t border-[var(--surface-soft)] pt-2 text-[12px] font-bold text-[var(--foreground-muted)]">
            <span>韩国语 1级</span>
            <span>{number}</span>
          </div>
        </div>
      )}
    </div>
  );
});

function LessonCard({ number, korean, chinese, focus }: LessonCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--status-success-surface)] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--status-success-surface)] text-xs font-bold text-[var(--status-success)]">
          {String(number).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <h4 className="text-[15px] font-bold leading-6 text-[var(--primary)]">{korean}</h4>
          <p className="mt-0.5 text-xs font-bold text-[var(--foreground-secondary)]">{chinese}</p>
          <p className="mt-2 text-xs leading-5 text-[var(--status-warning)]">{focus}</p>
        </div>
      </div>
    </article>
  );
}

function StructureCard({
  number,
  title,
  description,
  task,
}: {
  number: string;
  title: string;
  description: string;
  task: string;
}) {
  return (
    <article className="rounded-2xl border border-[var(--status-success-surface)] bg-[var(--card)] p-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-[var(--destructive)]">{number}</span>
        <h4 className="font-bold text-[var(--foreground-secondary)]">{title}</h4>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--foreground-muted)]">{description}</p>
      <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] font-bold leading-5 text-[var(--foreground-secondary)]">
        使用动作：{task}
      </p>
    </article>
  );
}

export function KoreanLevelOneGuideBook({
  isFullscreen,
  onPageChange,
}: {
  isFullscreen: boolean;
  onPageChange?: (page: number) => void;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const flipBookRef = useRef<FlipBookHandle>(null);
  const [scale, setScale] = useState(0.7);

  useEffect(() => {
    const resize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setScale(
        Math.min(
          (rect.width - 34) / BOOK_WIDTH,
          (rect.height - 28) / BOOK_HEIGHT,
          isFullscreen ? 1 : 0.86
        )
      );
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isFullscreen]);

  return (
    <section
      ref={containerRef}
      className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2"
    >
      <div
        className="relative shrink-0"
        style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}
      >
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
          aria-label="上一页"
          className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border-subtle)] bg-white p-3 text-[var(--status-success)] shadow-lg transition hover:bg-[var(--status-success-surface)]"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
          aria-label="下一页"
          className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border-subtle)] bg-white p-3 text-[var(--status-success)] shadow-lg transition hover:bg-[var(--status-success-surface)]"
        >
          <ArrowRight size={18} />
        </button>

        <div
          className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left"
          style={{ transform: `scale(${scale})` }}
        >
          <HTMLFlipBook
            ref={flipBookRef}
            width={590}
            height={822}
            startPage={0}
            size="fixed"
            minWidth={590}
            maxWidth={590}
            minHeight={822}
            maxHeight={822}
            drawShadow
            maxShadowOpacity={0.32}
            flippingTime={650}
            usePortrait
            startZIndex={0}
            autoSize={false}
            showCover={false}
            mobileScrollSupport
            swipeDistance={24}
            clickEventForward
            useMouseEvents={true}
            showPageCorners={false}
            disableFlipByClick
            onFlip={(event) => onPageChange?.(event.data)}
            className="h-[822px] w-[1180px]"
            style={{}}
          >
            <Page number="封面" cover>
              <div className="relative h-full overflow-hidden bg-[var(--surface-soft)] text-[var(--foreground)]">
                <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[38px] border-[var(--border-subtle)]" />
                <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[var(--status-success-surface)]" />
                <div className="relative flex h-full flex-col px-14 py-12">
                  <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.2em] text-[var(--foreground-secondary)]">
                    <span>韩国语</span>
                    <span>一级 · 上册和下册</span>
                  </div>
                  <div className="my-auto">
                    <div className="flex items-end gap-6">
                      <div>
                        <p className="text-sm font-bold tracking-[0.28em] text-[var(--destructive)]">
                          适配《首尔大韩国语1》进度的学习笔记
                        </p>
                        <h3 className="mt-5 text-[58px] font-bold leading-[1.02] tracking-[-0.06em] text-[var(--foreground)]">
                          韩语1级
                          <span className="mt-2 block text-[42px] tracking-[-0.04em]">
                            学习和语法全解
                          </span>
                        </h3>
                      </div>
                      <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-[var(--border-subtle)] text-[72px] font-bold leading-none text-[var(--destructive)]">
                        1
                      </span>
                    </div>
                    <div className="mt-9 w-64 border-t border-[var(--foreground)]/25 pt-6">
                      <p className="text-4xl font-bold tracking-tight">课程导读</p>
                      <p className="mt-3 text-xs font-bold tracking-[0.18em] text-[var(--foreground-secondary)]">
                        课程指南
                      </p>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-[var(--foreground-secondary)] p-7 text-white">
                    <p className="text-xl font-bold">从第一句“안녕하세요?”开始</p>
                    <p className="mt-3 text-sm leading-7 text-white/70">
                      用16课搭建韩国生活中的基础沟通能力，让每一个词、每一个句型都走进真实使用场景。
                    </p>
                  </div>
                </div>
              </div>
            </Page>

            <Page number="01" section="01 · 写给即将出发的你">
              <div className="flex h-full flex-col">
                <Compass className="text-[var(--status-success)]" size={30} />
                <h3 className="mt-3 text-4xl font-bold leading-tight text-[var(--primary)]">
                  欢迎你，未来的韩语使用者
                </h3>
                <div className="mt-6 space-y-4 text-[15px] leading-8 text-[var(--foreground-secondary)]">
                  <p>
                    如果你刚刚认识韩文字母，或者还不敢开口说出完整句子，请放心：韩国语1级本来就是一条为初学者铺设的路。你不需要“一次全懂”，只需要在每一课里多听一次、多说一句、多完成一个真实任务。
                  </p>
                  <p>
                    本书完整配套1A与1B两册，共16课。学习从问候、自我介绍和辨认身边事物开始，逐步进入购物、天气、约会、家庭、电话、就医、交通、问路、兴趣与旅行计划等生活场景。
                  </p>
                  <p>
                    我们希望你学到的不是孤立的知识点，而是能在需要时自然说出口的表达。语法是骨架，词汇是材料，听说读写练习则把它们变成真正属于你的语言能力。
                  </p>
                </div>
                <div className="mt-auto rounded-3xl bg-[var(--primary)] p-6 text-white">
                  <p className="text-lg font-bold">《韩语1级学习和语法全解》</p>
                  <p className="mt-2 text-sm font-bold leading-7 text-[var(--border-subtle)]">
                    适配《首尔大韩国语1》进度的学习笔记
                  </p>
                  <p className="mt-2 text-xs leading-6 text-white/60">
                    本书依据课程主题与语法进度独立编写，所有讲解、例句、对话、阅读及练习均为原创内容。
                  </p>
                </div>
              </div>
            </Page>

            <Page number="02" section="完成16课后，你将能够">
              <div className="flex h-full flex-col">
                <Sparkles className="text-[var(--status-success)]" size={28} />
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">
                  在韩国生活中完成这些基础任务
                </h3>
                <div className="mt-7 grid grid-cols-2 gap-4">
                  {[
                    ["建立联系", "自然问候、介绍自己，也能介绍家人与基本关系。"],
                    ["表达日常", "描述正在做什么、过去做过什么，以及一天的作息。"],
                    ["处理生活", "询价购物、谈天气、看时间、接打简单电话。"],
                    ["照顾自己", "说明身体不适，在医院完成基础问诊交流。"],
                    ["顺利出行", "听懂换乘提示，询问地点，并给出简明方向。"],
                    ["安排未来", "提出邀约、谈兴趣，说明假期与旅行计划。"],
                  ].map(([title, text], index) => (
                    <article
                      key={title}
                      className="rounded-2xl border border-[var(--status-success-surface)] bg-[var(--card)] p-4"
                    >
                      <span className="text-xs font-bold text-[var(--destructive)]">
                        0{index + 1}
                      </span>
                      <h4 className="mt-2 font-bold text-[var(--foreground-secondary)]">{title}</h4>
                      <p className="mt-2 text-xs leading-6 text-[var(--foreground-muted)]">{text}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-5">
                  <CheckCircle2 className="shrink-0 text-[var(--destructive)]" size={25} />
                  <p className="text-sm font-bold leading-6 text-[var(--status-warning)]">
                    最终目标：面对熟悉的生活情境，能够听懂关键信息，并用简短、完整、得体的韩语作出回应。
                  </p>
                </div>
              </div>
            </Page>

            <Page number="03" section="02 · 从生存表达走向生活交流">
              <div className="flex h-full flex-col">
                <BookOpenCheck className="text-[var(--status-success)]" size={28} />
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">
                  四个模块，一条清晰的成长路线
                </h3>
                <p className="mt-4 text-sm leading-7 text-[var(--foreground-secondary)]">
                  16课不是16个彼此分离的主题，而是一条由“认识彼此”逐渐走向“独立行动与安排未来”的能力阶梯。
                </p>
                <div className="relative mt-7 space-y-4">
                  <div className="absolute bottom-6 left-[19px] top-6 w-px bg-[var(--border-subtle)]" />
                  {[
                    ["模块一", "基础破冰", "第1—4课", "认识人、事、动作与空间"],
                    ["模块二", "生活运转", "第5—8课", "谈经历、购物、天气与约定"],
                    ["模块三", "关系与照护", "第9—12课", "家庭、时间、电话与健康"],
                    ["模块四", "出行与未来", "第13—16课", "交通、问路、兴趣与计划"],
                  ].map(([label, title, lessons, goal], index) => (
                    <div key={label} className="relative flex gap-4">
                      <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--status-success)] text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="flex flex-1 items-center justify-between rounded-2xl border border-[var(--status-success-surface)] bg-white px-5 py-4">
                        <div>
                          <p className="text-[11px] font-bold tracking-[0.12em] text-[var(--destructive)]">
                            {label} · {lessons}
                          </p>
                          <h4 className="mt-1 text-lg font-bold text-[var(--foreground-secondary)]">{title}</h4>
                        </div>
                        <p className="max-w-[190px] text-right text-xs leading-5 text-[var(--foreground-muted)]">
                          {goal}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-auto rounded-2xl bg-[var(--status-success-surface)] px-5 py-4 text-sm font-bold leading-6 text-[var(--status-success)]">
                  每完成一个模块，请用“我现在能做什么”检验学习成果，而不是只用“我背了多少”衡量进步。
                </div>
              </div>
            </Page>

            <Page number="04" section="MODULE 01 · 1A 第1—4课">
              <div className="flex h-full flex-col">
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">基础破冰：让语言开始运转</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
                  先学会确认“我是谁、这是什么、我在做什么、它在哪里”，搭起最基础的韩语句子框架。
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <LessonCard
                    number={1}
                    korean="안녕하세요?"
                    chinese="你好？"
                    focus="问候与自我介绍"
                  />
                  <LessonCard
                    number={2}
                    korean="이거는 뭐예요?"
                    chinese="这是什么？"
                    focus="询问事物名称"
                  />
                  <LessonCard
                    number={3}
                    korean="한국어를 공부해요."
                    chinese="我学习韩语。"
                    focus="描述日常动作"
                  />
                  <LessonCard
                    number={4}
                    korean="어디에 있어요?"
                    chinese="在哪里？"
                    focus="描述位置与存在"
                  />
                </div>
                <div className="mt-auto rounded-3xl bg-[var(--primary)] p-6 text-white">
                  <p className="text-xs font-bold tracking-[0.14em] text-[var(--border-subtle)]">阶段任务</p>
                  <p className="mt-2 text-lg font-bold">完成一次“初次见面＋认识环境”的交流</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    能介绍自己，询问物品名称，说出正在进行的动作，并说明常见人物或物品的位置。
                  </p>
                </div>
              </div>
            </Page>

            <Page number="05" section="MODULE 02 · 1A 第5—8课">
              <div className="flex h-full flex-col">
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">生活运转：把句子放进一天</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
                  从“现在”扩展到“过去”，再进入数字、天气和邀约，让你能够谈论真实发生的生活。
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <LessonCard
                    number={5}
                    korean="주말에 친구를 만났어요."
                    chinese="周末见了朋友。"
                    focus="谈论过去的经历"
                  />
                  <LessonCard
                    number={6}
                    korean="얼마예요?"
                    chinese="多少钱？"
                    focus="购物与数字表达"
                  />
                  <LessonCard
                    number={7}
                    korean="날씨가 어떻습니까?"
                    chinese="天气怎么样？"
                    focus="谈论天气与季节"
                  />
                  <LessonCard
                    number={8}
                    korean="영화 볼까요?"
                    chinese="去看电影好吗？"
                    focus="提议与约定"
                  />
                </div>
                <div className="mt-auto rounded-3xl bg-[var(--status-warning-surface)] p-6 text-[var(--destructive)]">
                  <p className="text-xs font-bold tracking-[0.14em] text-[var(--destructive)]">1A阶段里程碑</p>
                  <p className="mt-2 text-lg font-bold">完成基础生存交际</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--status-warning)]">
                    能谈周末经历、询价购物、交流天气，并主动发出一个简单邀约、确认约定。
                  </p>
                </div>
              </div>
            </Page>

            <Page number="06" section="MODULE 03 · 1B 第9—12课">
              <div className="flex h-full flex-col">
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">关系与照护：表达更得体</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
                  进入家庭、作息、电话与就医场景，在信息表达之外，开始关注称谓、敬意和沟通礼貌。
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <LessonCard
                    number={9}
                    korean="가족이 몇 명이에요?"
                    chinese="家有几口人？"
                    focus="介绍家人与敬语基础"
                  />
                  <LessonCard
                    number={10}
                    korean="지금 몇 시예요?"
                    chinese="现在几点？"
                    focus="时间与日常作息"
                  />
                  <LessonCard
                    number={11}
                    korean="여보세요."
                    chinese="喂。"
                    focus="电话交际用语"
                  />
                  <LessonCard
                    number={12}
                    korean="감기에 걸렸어요."
                    chinese="感冒了。"
                    focus="医院就诊与健康"
                  />
                </div>
                <div className="mt-auto rounded-3xl bg-[var(--primary)] p-6 text-white">
                  <p className="text-xs font-bold tracking-[0.14em] text-[var(--border-subtle)]">阶段任务</p>
                  <p className="mt-2 text-lg font-bold">在需要礼貌与关照的场景中完成交流</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    能介绍家人和作息，完成简短电话沟通，并向医护人员说明常见不适。
                  </p>
                </div>
              </div>
            </Page>

            <Page number="07" section="MODULE 04 · 1B 第13—16课">
              <div className="flex h-full flex-col">
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">出行与未来：走得更远</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
                  从到达一个地方，到表达自己的兴趣和下一步安排，你将开始用韩语独立行动、规划未来。
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <LessonCard
                    number={13}
                    korean="시청역에서 갈아타세요."
                    chinese="请在市厅站换乘。"
                    focus="交通工具与换乘"
                  />
                  <LessonCard
                    number={14}
                    korean="이쪽으로 가세요."
                    chinese="请往这边走。"
                    focus="问路与指路"
                  />
                  <LessonCard
                    number={15}
                    korean="취미가 뭐예요?"
                    chinese="爱好是什么？"
                    focus="谈论兴趣爱好"
                  />
                  <LessonCard
                    number={16}
                    korean="방학에 여행을 갈 거예요."
                    chinese="放假要去旅行。"
                    focus="假期计划与未来时态"
                  />
                </div>
                <div className="mt-auto rounded-3xl bg-[var(--status-success-surface)] p-6 text-[var(--status-success)]">
                  <p className="text-xs font-bold tracking-[0.14em] text-[var(--status-success)]">1级全册里程碑</p>
                  <p className="mt-2 text-lg font-bold">完成扩展生活场景交际</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                    能处理基础出行问题、交流兴趣，并用将来表达安排一次假期或旅行计划。
                  </p>
                </div>
              </div>
            </Page>

            <Page number="08" section="03 · 每课内部结构（上）">
              <div className="flex h-full flex-col">
                <ListChecks className="text-[var(--status-success)]" size={28} />
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">
                  先理解，再模仿；先组织，再开口
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
                  每课围绕一个生活任务展开。请按栏目顺序学习，也可根据自己的薄弱点回查。
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <StructureCard
                    number="01"
                    title="课前导航"
                    description="用本课目标、使用场景和完成任务建立学习预期。"
                    task="先读任务，再判断自己已经会说哪些内容。"
                  />
                  <StructureCard
                    number="02"
                    title="核心词汇表"
                    description="收录完成本课交流所需的高频词，并标注词性、释义与搭配提示。"
                    task="听音跟读，遮住中文回忆词义，再放入短语。"
                  />
                  <StructureCard
                    number="03"
                    title="语法解说"
                    description="用清晰规则、形式变化和原创例句解释语法的意义与使用条件。"
                    task="先看例句找规律，再用自己的信息替换关键词。"
                  />
                  <StructureCard
                    number="04"
                    title="句型操练"
                    description="从替换、转换到问答，逐步把语法变成可快速调用的句型。"
                    task="先写正确，再脱离文字连续说三遍。"
                  />
                </div>
              </div>
            </Page>

            <Page number="09" section="03 · 每课内部结构（下）">
              <div className="flex h-full flex-col">
                <MessageCircle className="text-[var(--status-success)]" size={28} />
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">
                  把知识送进真实交流
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">
                  后半程强调输入、输出与复盘。本书仅适配课程主题与语法进度，不复刻原教材编排；所有对话、例句、阅读与练习均为独立原创。
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <StructureCard
                    number="05"
                    title="实战对话"
                    description="用全新生活情境呈现本课词汇、语法和礼貌表达的组合方式。"
                    task="听一遍抓场景，跟读两遍，再替换人物与信息。"
                  />
                  <StructureCard
                    number="06"
                    title="听说任务"
                    description="训练听取关键信息、快速回应、角色扮演与连续表达。"
                    task="先允许自己看提示，第二轮关闭提示完成任务。"
                  />
                  <StructureCard
                    number="07"
                    title="读写拓展"
                    description="通过原创短讯、便条、介绍和生活文本巩固信息提取与书写。"
                    task="圈出关键词，再仿照文本写与你有关的内容。"
                  />
                  <StructureCard
                    number="08"
                    title="自测与复盘"
                    description="用小测、易错提醒和“我会了”清单确认能否独立完成交流。"
                    task="错题按词汇、语法、理解或表达四类整理。"
                  />
                </div>
              </div>
            </Page>

            <Page number="10" section="一课三轮 · 每次20—30分钟">
              <div className="flex h-full flex-col">
                <Clock3 className="text-[var(--status-success)]" size={28} />
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">
                  推荐的高效学习节奏
                </h3>
                <div className="mt-7 space-y-4">
                  {[
                    ["第一轮 · 看懂", "词汇＋语法＋原创建模例句", "弄清“这句话在什么情况下说、怎样组成”。"],
                    ["第二轮 · 说熟", "跟读＋句型操练＋实战对话", "让口腔熟悉声音与节奏，把停顿逐渐缩短。"],
                    ["第三轮 · 用出", "听说任务＋读写拓展＋自测", "脱离范文，用自己的身份、经历与计划完成表达。"],
                  ].map(([title, focus, goal], index) => (
                    <article
                      key={title}
                      className="flex gap-5 rounded-2xl border border-[var(--status-success-surface)] bg-white p-5"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--status-success-surface)] text-lg font-bold text-[var(--status-success)]">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-[var(--foreground-secondary)]">{title}</h4>
                        <p className="mt-1 text-xs font-bold text-[var(--destructive)]">{focus}</p>
                        <p className="mt-2 text-xs leading-6 text-[var(--foreground-muted)]">{goal}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-[var(--primary)] p-5 text-white">
                    <Headphones size={21} className="text-[var(--border-subtle)]" />
                    <p className="mt-3 text-sm font-bold">输入标准</p>
                    <p className="mt-2 text-xs leading-5 text-white/65">能听出场景、人物关系与关键信息。</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--status-warning-surface)] p-5 text-[var(--destructive)]">
                    <Mic2 size={21} className="text-[var(--destructive)]" />
                    <p className="mt-3 text-sm font-bold">输出标准</p>
                    <p className="mt-2 text-xs leading-5 text-[var(--status-warning)]">能不用范文，以自己的信息完成任务。</p>
                  </div>
                </div>
                <p className="mt-auto text-center text-xs leading-5 text-[var(--foreground-muted)]">
                  建议每完成4课安排一次综合复习；遗忘不是退步，而是提醒你进行下一次提取练习。
                </p>
              </div>
            </Page>

            <Page number="11" section="04 · 给零基础自学者的三句话">
              <div className="flex h-full flex-col">
                <Lightbulb className="text-[var(--status-success)]" size={28} />
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">
                  愿你稳稳地学，也勇敢地说
                </h3>
                <div className="mt-8 space-y-5">
                  {[
                    [
                      "01",
                      "把声音放在第一位",
                      "单词不要只“看会”。每天用短时段反复听、跟读和录音对比，尤其留意收音、连音与句末语调。发音不必一开始就完美，但一定要从第一课起建立听说联动。",
                    ],
                    [
                      "02",
                      "用自己的信息造句",
                      "每学一个句型，至少替换成三句与你有关的话：你的名字、家人、日程、喜好或计划。能背出例句只是记忆，能换成自己的内容才是掌握。",
                    ],
                  ].map(([number, title, text]) => (
                    <article
                      key={number}
                      className="rounded-2xl border border-[var(--status-success-surface)] bg-[var(--card)] p-6"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-[var(--destructive)]">{number}</span>
                        <h4 className="text-lg font-bold text-[var(--foreground-secondary)]">{title}</h4>
                      </div>
                      <p className="mt-3 pl-10 text-sm leading-7 text-[var(--foreground-secondary)]">{text}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-auto rounded-2xl bg-[var(--status-success-surface)] px-5 py-4 text-sm font-bold leading-6 text-[var(--status-success)]">
                  学语言最重要的不是一次学得很多，而是让正确的声音、句型和表达一次次重新出现。
                </div>
              </div>
            </Page>

            <Page number="12" section="04 · 给零基础自学者的三句话">
              <div className="flex h-full flex-col">
                <h3 className="mt-3 text-3xl font-bold text-[var(--primary)]">
                  把每一次复习，变成下一次开口
                </h3>
                <article className="mt-8 rounded-3xl border border-[var(--status-success-surface)] bg-[var(--card)] p-7">
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold text-[var(--destructive)]">03</span>
                    <h4 className="text-xl font-bold text-[var(--foreground-secondary)]">小步复习，持续输出</h4>
                  </div>
                  <p className="mt-5 text-[15px] leading-8 text-[var(--foreground-secondary)]">
                    采用“当天—次日—一周后”的复习节奏。每次不求重学整课，只需回忆关键词、口述一个场景、重做一道错题。稳定的十分钟，胜过偶尔突击两小时。
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                    {[
                      ["当天", "跟读与仿说"],
                      ["次日", "遮住答案回忆"],
                      ["一周后", "完成场景表达"],
                    ].map(([time, task]) => (
                      <div key={time} className="rounded-2xl bg-white p-4">
                        <p className="text-sm font-bold text-[var(--status-success)]">{time}</p>
                        <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">{task}</p>
                      </div>
                    ))}
                  </div>
                </article>
                <div className="mt-7 border-t border-[var(--status-success-surface)] pt-6 text-center">
                  <NotebookPen className="mx-auto text-[var(--status-success)]" size={23} />
                  <p className="mt-3 text-lg font-bold text-[var(--primary)]">
                    지금부터 시작해요. 现在，就开始吧。
                  </p>
                  <p className="mt-2 text-xs tracking-[0.12em] text-[var(--foreground-muted)]">主编寄语</p>
                </div>
                <p className="mt-auto rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-[10px] leading-5 text-[var(--foreground-muted)]">
                  版权说明：书名中的教材名称仅用于说明学习进度的适配关系。本书为独立编写的学习笔记，不代表原教材著作权人或出版方授权、监制或联合出品；相关名称及权益归其权利人所有。
                </p>
              </div>
            </Page>
          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
