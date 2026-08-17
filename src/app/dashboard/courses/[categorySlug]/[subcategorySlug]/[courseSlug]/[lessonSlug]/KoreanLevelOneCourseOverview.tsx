"use client";

import Image from "next/image";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Compass,
  GraduationCap,
  Headphones,
  HeartPulse,
  Languages,
  Map,
  Maximize2,
  MessageCircle,
  Route,
  ShoppingBag,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import type { SmartLocale } from "@/lib/smart-digital-textbook";

type LocalCopy = { zh: string; ko: string };

type Props = {
  moduleCode: string;
  locale: SmartLocale;
};

function localize(locale: SmartLocale, value: LocalCopy) {
  return locale === "ko-KR" ? value.ko : value.zh;
}

const capabilities = [
  { icon: Users, title: { zh: "建立联系", ko: "관계 시작하기" }, text: { zh: "自然问候、介绍自己，并得体地介绍家人与身份。", ko: "자연스럽게 인사하고 자신과 가족, 신분을 소개합니다." } },
  { icon: MessageCircle, title: { zh: "表达日常", ko: "일상 표현하기" }, text: { zh: "说明在哪里做什么，讲述经历、日程和下一步计划。", ko: "장소와 행동, 경험, 일정과 다음 계획을 말합니다." } },
  { icon: ShoppingBag, title: { zh: "处理生活事务", ko: "생활 업무 처리하기" }, text: { zh: "完成购物、天气、约会和基础服饰交流。", ko: "쇼핑, 날씨, 약속과 옷 구매 대화를 완성합니다." } },
  { icon: HeartPulse, title: { zh: "照顾自己", ko: "자기 돌보기" }, text: { zh: "说明身体症状，理解简单医嘱、禁止与义务。", ko: "증상을 설명하고 간단한 진료 안내와 금지·의무를 이해합니다." } },
  { icon: Route, title: { zh: "顺利出行", ko: "독립적으로 이동하기" }, text: { zh: "说明路线、交通手段，并提出礼貌的乘车请求。", ko: "경로와 교통수단을 말하고 정중하게 이동을 요청합니다." } },
  { icon: Compass, title: { zh: "安排未来", ko: "미래 계획하기" }, text: { zh: "表达愿望与条件，发出邀请、承担任务并说明目的。", ko: "바람과 조건을 말하고 초대와 역할, 목적을 표현합니다." } },
] as const;

const stages = [
  {
    image: "/images/korean-level-one-overview/stage-01.png",
    range: "01—04",
    title: { zh: "基础破冰", ko: "기초 관계 만들기" },
    line: { zh: "认识人、事、动作与空间", ko: "사람, 사물, 행동과 공간 이해하기" },
    milestone: { zh: "完成“初次见面＋认识环境”的基础交流。", ko: "첫 만남과 주변 환경을 소개하는 기초 대화를 완성합니다." },
    lessons: [
      ["01", "안녕하세요?", "问候与自我介绍"],
      ["02", "이거는 뭐예요?", "辨认与请求物品"],
      ["03", "한국어를 공부해요.", "描述日常动作"],
      ["04", "어디에 있어요?", "地点、存在与方位"],
    ],
  },
  {
    image: "/images/korean-level-one-overview/stage-02.png",
    range: "05—08",
    title: { zh: "生活运转", ko: "생활 속 한국어" },
    line: { zh: "让语言进入真实的一天", ko: "언어를 실제 하루 속으로 가져오기" },
    milestone: { zh: "讲经历、完成购物、交流天气并提出约会建议。", ko: "경험, 쇼핑, 날씨와 약속 제안을 표현합니다." },
    lessons: [
      ["05", "주말에 친구를 만났어요.", "过去经历"],
      ["06", "얼마예요?", "价格、数量与交易"],
      ["07", "날씨가 어때요?", "天气与季节"],
      ["08", "영화 볼까요?", "建议与约会"],
    ],
  },
  {
    image: "/images/korean-level-one-overview/stage-03.png",
    range: "09—12",
    title: { zh: "关系、时间与照护", ko: "관계·시간·돌봄" },
    line: { zh: "让表达更准确，也更得体", ko: "더 정확하고 예의 있게 표현하기" },
    milestone: { zh: "介绍家人、安排时间、健康咨询并完成电话交流。", ko: "가족 소개, 일정, 건강 상담과 전화 대화를 완성합니다." },
    lessons: [
      ["09", "이분은 누구세요?", "家庭与敬语"],
      ["10", "지금 몇 시예요?", "时间与计划"],
      ["11", "감기에 걸렸어요.", "症状与医嘱"],
      ["12", "여보세요.", "电话与原因说明"],
    ],
  },
  {
    image: "/images/korean-level-one-overview/stage-04.png",
    range: "13—16",
    title: { zh: "独立行动与未来", ko: "독립 행동과 미래" },
    line: { zh: "从到达一个地方，走向组织生活", ko: "이동에서 생활 계획까지 확장하기" },
    milestone: { zh: "完成不少于 10—12 句的邀请、计划与分工交流。", ko: "10~12문장 이상의 초대, 계획과 역할 대화를 완성합니다." },
    lessons: [
      ["13", "서울역으로 가 주세요.", "交通与路线"],
      ["14", "이 옷을 입어 보세요.", "服饰与试穿"],
      ["15", "여행을 가고 싶어요.", "旅行与愿望"],
      ["16", "우리 집에 올 수 있어요?", "邀请与协作"],
    ],
  },
] as const;

const lessonSteps = [
  ["01", "课前导航", "场景、目标与最终任务", "能说明本课要解决的沟通问题"],
  ["02", "核心词汇", "高频词、读音与搭配", "听到能辨认，看中文能说出韩语"],
  ["03", "语法讲解", "意义、形态与使用条件", "能解释何时使用并完成基本变形"],
  ["04", "句型操练", "替换、转换、排序与问答", "不看规则也能调用核心句型"],
  ["05", "实战对话", "组合词汇、语法与礼貌表达", "能脱离原文完成同类角色任务"],
  ["06", "听说任务", "听取关键信息并连续表达", "能听出重点并及时口头回应"],
  ["07", "读写拓展", "便条、介绍与生活文本", "能写出信息完整的短文"],
  ["08", "自测与复盘", "检测表达并按错因回查", "完成课末任务并通过章节测试"],
] as const;

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-4xl">
      <h2 className="text-3xl font-bold tracking-[-.04em] text-[var(--foreground)] sm:text-[40px]">{title}</h2>
      <p className="mt-4 text-[16px] leading-8 text-[var(--foreground-secondary)] sm:text-[17px]">{description}</p>
    </div>
  );
}

function CourseMap({ locale }: { locale: SmartLocale }) {
  return (
    <div className="space-y-10">
      <section className="relative min-h-[440px] overflow-hidden rounded-[28px] sm:min-h-[500px]">
        <Image
          src="/images/korean-level-one-overview/course-hero.png"
          alt={locale === "ko-KR" ? "카페에서 한국어로 대화하는 학습자들" : "学习者在咖啡馆使用韩语交流"}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 75vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/58 to-slate-950/10" />
        <div className="relative flex min-h-[440px] flex-col justify-end p-6 text-white sm:min-h-[500px] sm:p-10 xl:p-12">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-bold leading-tight tracking-[-.05em] sm:text-5xl xl:text-6xl">
              {locale === "ko-KR" ? "첫 인사에서 독립적인 생활 대화까지" : "从第一句问候，到独立生活沟通"}
            </h2>
            <p className="mt-5 max-w-2xl text-[16px] leading-8 text-white/82 sm:text-lg">
              {locale === "ko-KR"
                ? "16개 단원을 통해 교실, 도시와 실제 생활을 연결하고 듣고 조직해 직접 말할 수 있는 기초 소통 능력을 만듭니다."
                : "用 16 课把课堂、城市与真实生活连成一条可以开口实践的路线，建立能听懂、能组织、能说出口的基础沟通能力。"}
            </p>
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
            {[["16", locale === "ko-KR" ? "정규 단원" : "正式课程"], ["554", locale === "ko-KR" ? "전자책 쪽" : "电子书页"], ["2", locale === "ko-KR" ? "두 권" : "两册内容"]].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 backdrop-blur-md">
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
                <p className="mt-1 text-[11px] font-semibold text-white/70">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          title={locale === "ko-KR" ? "16개 단원 후 할 수 있는 것" : "完成 16 课后，你将能够"}
          description={locale === "ko-KR" ? "복잡하게 말하는 것이 목표가 아니라 익숙한 장면에서 먼저 대화를 시작하고 핵심 정보를 듣고 자신의 정보로 응답하는 것이 목표입니다." : "目标不是说得复杂，而是在熟悉场景里主动开始交流，听出人物、时间、地点、数量和行动，并用自己的真实信息回应。"}
        />
        <div className="mt-7 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {capabilities.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.title.zh} className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]"><Icon size={20} aria-hidden="true" /></span>
                  <div>
                    <p className="text-[10px] font-bold tracking-[.16em] text-[var(--foreground-muted)]">{String(index + 1).padStart(2, "0")}</p>
                    <h3 className="mt-1 text-lg font-bold text-[var(--foreground)]">{localize(locale, item.title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{localize(locale, item.text)}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeading
          title={locale === "ko-KR" ? "네 단계, 하나의 성장 경로" : "四个阶段，一条连续的成长路线"}
          description={locale === "ko-KR" ? "16개 주제는 서로 떨어진 목록이 아니라 사람을 만나고 일상을 운영하며 독립적으로 행동하는 능력의 계단입니다." : "16 课不是彼此分离的主题，而是一条从认识彼此、让生活运转，到独立行动和安排未来的能力阶梯。"}
        />
        <div className="mt-7 grid gap-5 2xl:grid-cols-2">
          {stages.map((stage) => (
            <article key={stage.range} className="overflow-hidden rounded-[26px] border border-[var(--border-subtle)] bg-[var(--card)]">
              <div className="relative aspect-[16/7] min-h-[210px]">
                <Image src={stage.image} alt={localize(locale, stage.title)} fill sizes="(max-width: 1536px) 100vw, 50vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                  <p className="text-xs font-bold text-white/75">{locale === "ko-KR" ? `${stage.range}과` : `第 ${stage.range} 课`}</p>
                  <h3 className="mt-2 text-2xl font-bold">{localize(locale, stage.title)}</h3>
                  <p className="mt-1 text-sm font-semibold text-white/80">{localize(locale, stage.line)}</p>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <div className="grid gap-2 sm:grid-cols-2">
                  {stage.lessons.map(([number, korean, chinese]) => (
                    <div key={number} className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[var(--primary)]">{number}</span>
                        <span className="min-w-0 truncate text-sm font-bold text-[var(--foreground)]">{korean}</span>
                      </div>
                      <p className="mt-1 pl-7 text-xs text-[var(--foreground-secondary)]">{chinese}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-3 border-t border-[var(--border-subtle)] pt-4 text-sm leading-6 text-[var(--foreground-secondary)]">
                  <Target size={17} className="mt-1 shrink-0 text-[var(--status-success)]" aria-hidden="true" />
                  <span>{localize(locale, stage.milestone)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function LearningMethod({ locale }: { locale: SmartLocale }) {
  return (
    <div className="space-y-10">
      <SectionHeading
        title={locale === "ko-KR" ? "한 단원을 능력으로 바꾸는 여덟 단계" : "每一课，用八步把知识变成能力"}
        description={locale === "ko-KR" ? "여덟 단계는 단순한 목차가 아니라 장면 이해에서 실제 표현과 점검까지 이어지는 고정 학습 경로입니다." : "八步不是版式目录，而是一条从理解场景、学习材料，到真实输出和验收复盘的固定学习路径。"}
      />
      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {lessonSteps.map(([number, title, learn, standard]) => (
          <article key={number} className="flex min-h-[230px] flex-col rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold tabular-nums text-[var(--primary)]">{number}</span>
              <CheckCircle2 size={18} className="text-[var(--border)]" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-[var(--foreground)]">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{learn}</p>
            <div className="mt-auto border-t border-[var(--border-subtle)] pt-4">
              <p className="text-[10px] font-bold tracking-[.14em] text-[var(--foreground-muted)]">完成标准</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">{standard}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[26px] bg-[var(--primary)] p-6 text-[var(--primary-foreground)] sm:p-8">
          <h3 className="text-2xl font-bold">{locale === "ko-KR" ? "한 단원은 세 번에 익혀요" : "一课三轮，每轮 20—30 分钟"}</h3>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "看懂", "词汇、语法和建模例句"],
              ["02", "说熟", "跟读、句型操练和实战对话"],
              ["03", "用出", "听说、读写与真实场景输出"],
            ].map(([number, title, text]) => (
              <div key={number} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-[10px] font-bold text-white/60">{locale === "ko-KR" ? `${Number(number)}회` : `第 ${Number(number)} 轮`}</p>
                <p className="mt-3 text-lg font-bold">{title}</p>
                <p className="mt-2 text-xs leading-5 text-white/75">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 sm:p-8">
          <div className="flex items-center gap-3"><Clock3 size={20} className="text-[var(--status-success)]" /><h3 className="text-xl font-bold">一课三次复习</h3></div>
          <div className="mt-5 space-y-3">
            {[["当天", "跟读核心词句，完成第一次仿说", "10—15 分钟"], ["次日", "遮住答案回忆语法并重做错题", "10 分钟"], ["一周后", "不看范文完成场景口语或短写作", "10—20 分钟"]].map(([time, text, duration]) => (
              <div key={time} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-2xl bg-[var(--card)] px-4 py-4">
                <span className="text-sm font-bold text-[var(--primary)]">{time}</span><span className="text-xs leading-5 text-[var(--foreground-secondary)]">{text}</span><span className="text-[10px] font-bold text-[var(--foreground-muted)]">{duration}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ToolTour({ locale }: { locale: SmartLocale }) {
  const tools = [
    { icon: Map, title: "学习路径", text: "左侧查看当前知识位置，底部切换本章步骤。" },
    { icon: MessageCircle, title: "学习助手", text: "解释当前内容、提供提示、例句和对话陪练。" },
    { icon: Languages, title: "中／한", text: "切换中文辅助、双语过渡与韩语沉浸模式。" },
    { icon: Maximize2, title: "全屏学习", text: "隐藏浏览器干扰，在完整教材画布中集中学习。" },
  ];
  return (
    <div className="space-y-10">
      <SectionHeading
        title={locale === "ko-KR" ? "한 번 익히면 16개 단원에서 계속 사용해요" : "熟悉一次，贯穿 16 课的智能教材工具"}
        description={locale === "ko-KR" ? "모든 단원은 같은 조작 방식과 진도 기록 규칙을 사용합니다." : "所有章节共用同一套操作方式、语言辅助和学习记录，熟悉这一页后就能专注于后续内容。"}
      />
      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return <article key={tool.title} className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]"><Icon size={22} aria-hidden="true" /></span><h3 className="mt-5 text-lg font-bold">{tool.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{tool.text}</p></article>;
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <div className="rounded-[26px] border border-[var(--border-subtle)] p-6 sm:p-8">
          <div className="flex items-center gap-3"><GraduationCap size={22} className="text-[var(--primary)]" /><h3 className="text-xl font-bold">学习验收</h3></div>
          <p className="mt-3 text-sm leading-6 text-[var(--foreground-secondary)]">页面看完不等于真正掌握。课程通过四个层级检查理解与输出。</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[["电子书自测", "每课第八步"], ["章节测试", "12 分钟 · 60 分及格"], ["章节题库", "每课 40 题"], ["四技能作业", "听说读写 · 35 分钟"]].map(([title, text]) => <div key={title} className="rounded-2xl bg-[var(--surface-soft)] p-4"><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-[var(--foreground-secondary)]">{text}</p></div>)}
          </div>
        </div>
        <div className="rounded-[26px] bg-[var(--foreground)] p-6 text-[var(--background)] sm:p-8">
          <div className="flex items-center gap-3"><Sparkles size={21} className="text-[var(--status-warning)]" /><h3 className="text-xl font-bold">真正学完一课的五项标准</h3></div>
          <div className="mt-6 space-y-3">
            {["听懂场景中的人物、时间、地点、数量或行动信息", "不看规则完成核心语法变形", "把例句替换成至少三句自己的信息", "脱离范文完成口语或写作任务", "按词汇、语法、理解和表达分类订正错题"].map((item) => <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6"><Check size={17} className="mt-1 shrink-0 text-[var(--status-success)]" />{item}</div>)}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReadyToStart({ locale }: { locale: SmartLocale }) {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] bg-[var(--foreground)] text-[var(--background)]">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 lg:block"><Image src="/images/korean-level-one-overview/stage-04.png" alt="" fill sizes="50vw" className="object-cover opacity-55" /><div className="absolute inset-0 bg-gradient-to-r from-[var(--foreground)] via-[var(--foreground)]/65 to-transparent" /></div>
        <div className="relative max-w-3xl p-7 sm:p-10 xl:p-12">
          <h2 className="text-4xl font-bold leading-tight tracking-[-.05em] sm:text-5xl">{locale === "ko-KR" ? "지금부터 시작해요" : "现在，从第一课开始"}</h2>
          <p className="mt-5 text-[16px] leading-8 text-white/75">{locale === "ko-KR" ? "완벽하게 준비될 때까지 기다리지 말고 배운 방법을 첫 만남의 실제 대화에 사용해 보세요." : "不需要等到完全准备好。把总览里认识的方法，立即用于第 01 课“你好？”的真实交流。"}</p>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[[BookOpen, "每章约一小时", "可以一次完成，也可依靠自动保存分段继续。"], [Headphones, "听说读写都要输出", "不以翻页进度代替真实的语言能力。"], [CheckCircle2, "按顺序学习与测试", "通过当前章节后，再进入下一段连续学习。"]].map(([Icon, title, text]) => {
          const ItemIcon = Icon as typeof BookOpen;
          return <article key={String(title)} className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6"><ItemIcon size={21} className="text-[var(--primary)]" /><h3 className="mt-4 text-lg font-bold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{String(text)}</p></article>;
        })}
      </section>
      <div className="rounded-[24px] border border-[var(--status-success)] bg-[var(--status-success-surface)] p-6 sm:p-8">
        <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--card)] text-[var(--status-success)]"><CheckCircle2 size={22} /></span><div><h3 className="text-xl font-bold text-[var(--foreground)]">开课准备确认</h3><p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">完成下方最后一道确认题后，系统会记录课程总览进度。随后即可使用底部按钮进入第 01 课。</p></div></div>
      </div>
    </div>
  );
}

export function KoreanLevelOneCourseOverview({ moduleCode, locale }: Props) {
  if (moduleCode === "orientation") return <CourseMap locale={locale} />;
  if (moduleCode === "patterns") return <LearningMethod locale={locale} />;
  if (moduleCode === "listen_speak") return <ToolTour locale={locale} />;
  return <ReadyToStart locale={locale} />;
}
