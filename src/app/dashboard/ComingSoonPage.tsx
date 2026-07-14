import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Layers3 } from "lucide-react";

import { DashboardPageHeader } from "./DashboardPageHeader";

type FeatureBlueprint = {
  title: string;
  description: string;
};

// 每个未来功能都有自己的内容结构，不再只展示一张“敬请期待”空卡片。
const featureBlueprints: Record<string, FeatureBlueprint[]> = {
  通知公告: [
    { title: "未读消息", description: "集中查看需要及时处理的新通知。" },
    { title: "课程通知", description: "按课程归档开课、调课与学习提醒。" },
    { title: "系统公告", description: "接收平台维护与重要服务信息。" },
  ],
  作业与考试: [
    { title: "本周任务", description: "按截止日期整理待完成的作业与测验。" },
    { title: "提交记录", description: "追踪已提交、批改中和需要修改的内容。" },
    { title: "教师反馈", description: "统一查看分数、评语与改进建议。" },
  ],
  会话练习: [
    { title: "情景主题", description: "覆盖校园、生活、面试等常用韩国场景。" },
    { title: "发音反馈", description: "记录语音表现与需要强化的发音。" },
    { title: "练习记录", description: "保存每次会话的主题、时长与成果。" },
  ],
  成绩管理: [
    { title: "成绩趋势", description: "按时间查看测验与考试成绩变化。" },
    { title: "能力分析", description: "汇总听、说、读、写四项表现。" },
    { title: "教师评语", description: "将老师反馈转化为下一步学习重点。" },
  ],
  学习记录: [
    { title: "学习日历", description: "按日期回顾课程与练习完成情况。" },
    { title: "学习时长", description: "统计每周投入与连续学习节奏。" },
    { title: "完成记录", description: "保留课程、章节和资料学习轨迹。" },
  ],
  资料库: [
    { title: "分类浏览", description: "按词汇、语法、阅读和留学资料分类。" },
    { title: "我的收藏", description: "快速找到经常复习的重要内容。" },
    { title: "使用记录", description: "查看最近打开与下载过的学习资料。" },
  ],
  帮助中心: [
    { title: "快速指引", description: "了解课程学习和留学工具的使用方式。" },
    { title: "常见问题", description: "集中解答账号、课程和资料相关问题。" },
    { title: "联系支持", description: "需要人工帮助时快速找到负责老师。" },
  ],
  设置: [
    { title: "通知偏好", description: "选择希望接收的学习和服务提醒。" },
    { title: "界面主题", description: "管理白天与夜间的界面显示偏好。" },
    { title: "学习偏好", description: "设置适合自己的课程节奏与目标。" },
  ],
};

const defaultBlueprints: FeatureBlueprint[] = [
  { title: "核心总览", description: "集中呈现当前最重要的信息。" },
  { title: "历史记录", description: "保留可回顾的操作和成长轨迹。" },
  { title: "智能提醒", description: "在关键时间提示下一步行动。" },
];

export function ComingSoonPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  const blueprints = featureBlueprints[title] ?? defaultBlueprints;

  return (
    <>
      <DashboardPageHeader
        title={title}
        description={description}
        action={
          <Link
            href="/dashboard"
            className="app-card inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black transition hover:-translate-y-0.5"
          >
            返回成长总览
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section
          className="app-card relative overflow-hidden rounded-[30px] border p-6 sm:p-8"
          style={{
            background:
              "linear-gradient(120deg, var(--app-hero-start), var(--app-card-bg) 55%, var(--app-hero-end))",
          }}
        >
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}
              >
                <Layers3 size={14} aria-hidden="true" />
                未来功能蓝图
              </span>
              <div
                className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}
              >
                {icon}
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
                {title}工作台
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 app-muted-text">{description}</p>
            </div>

            <div className="app-card rounded-3xl border p-5">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}
                >
                  <CheckCircle2 size={19} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-black">页面结构已准备</p>
                  <p className="mt-0.5 text-xs app-muted-text">等待业务数据接入</p>
                </div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                <div
                  className="h-full w-2/3 rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--app-secondary), var(--app-accent))" }}
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs app-muted-text">
                <Clock3 size={13} aria-hidden="true" />
                导航与功能分区已经保留
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h3 className="text-lg font-black">计划功能</h3>
            <p className="mt-1 text-xs app-muted-text">数据表与业务流程接入后，将按以下结构直接启用。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {blueprints.map((feature, index) => (
              <article key={feature.title} className="app-card rounded-3xl border p-5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black"
                    style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-black app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                    规划中
                  </span>
                </div>
                <h4 className="mt-5 text-base font-black">{feature.title}</h4>
                <p className="mt-2 text-sm leading-6 app-muted-text">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <Link
          href="/dashboard"
          className="app-card flex items-center justify-between gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5"
        >
          <span>
            <span className="block text-sm font-black">先回到成长总览继续今天的计划</span>
            <span className="mt-1 block text-xs app-muted-text">未来功能会一直保留在导航中</span>
          </span>
          <ArrowRight size={18} className="shrink-0" style={{ color: "var(--app-accent)" }} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
