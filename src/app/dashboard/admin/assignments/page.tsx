import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  FlaskConical,
  FileText,
  GraduationCap,
  Info,
  ShieldCheck,
} from "lucide-react";

import { requireAssessmentPaperWorkspace } from "@/lib/assessment-papers";

export default async function AssignmentManagementPage() {
  const { supabase, canManagePapers } =
    await requireAssessmentPaperWorkspace();

  const [paperResult, assignmentResult, chapterTestResult, chapterQuestionResult] = await Promise.all([
    supabase
      .from("assessment_papers")
      .select("paper_type,status"),
    canManagePapers
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("learning_assignments")
          .select("assignment_type,status")
          .in("assignment_type", ["homework", "exam"]),
    canManagePapers
      ? supabase
          .from("course_tests")
          .select("id,status")
          .eq("status", "published")
      : Promise.resolve({ data: [], error: null }),
    canManagePapers
      ? supabase
          .from("course_test_questions")
          .select("test_id,is_chapter_test_item,status")
          .eq("status", "published")
          .eq("is_chapter_test_item", true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const papers = paperResult.data ?? [];
  const assignments = assignmentResult.data ?? [];
  const chapterTests = chapterTestResult.data ?? [];
  const chapterQuestions = chapterQuestionResult.data ?? [];
  const cardData = [
    {
      type: "homework" as const,
      title: "作业管理",
      description: canManagePapers
        ? "创建、复制和发布不限数量的标准作业卷。"
        : "预览平台标准作业卷，选择整卷并安排学生和截止时间。",
      href: "/dashboard/admin/assignments/homework",
      icon: BookOpenCheck,
      color: "var(--app-accent)",
      soft: "var(--app-accent-soft)",
    },
    {
      type: "exam" as const,
      title: "考试管理",
      description: canManagePapers
        ? "创建、复制和发布不限数量的标准考试卷。"
        : "预览平台标准考试卷，选择整卷并安排考试时间。",
      href: "/dashboard/admin/assignments/exam",
      icon: GraduationCap,
      color: "var(--app-secondary)",
      soft: "var(--app-secondary-soft)",
    },
    ...(canManagePapers
      ? [
          {
            type: "chapter_test" as const,
            title: "章节测试管理",
            description:
              "管理课程章节测试、当前测试题目、规则和学生端预览。",
            href: "/dashboard/admin/assignments/chapter-tests",
            icon: FlaskConical,
            color: "var(--app-success)",
            soft: "var(--app-success-soft)",
          },
        ]
      : []),
  ];

  return (
    <div className="pb-12">
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 pt-6 sm:px-6 lg:px-8">
        <section
          className="app-card rounded-3xl border p-5 sm:p-7"
          style={{
            background:
              "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-accent-soft))",
          }}
        >
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
            style={{
              color: "var(--app-accent)",
              backgroundColor: "var(--app-accent-soft)",
            }}
          >
            {canManagePapers ? (
              <ShieldCheck size={15} />
            ) : (
              <ClipboardCheck size={15} />
            )}
            {canManagePapers ? "平台标准试卷中心" : "机构发布中心"}
          </span>
          <div className="group relative mt-4 flex w-fit items-center gap-1.5">
            <h1 className="text-3xl font-black tracking-tight">作业与考试管理</h1>
            <Info className="app-muted-text shrink-0 cursor-help" size={16} />
            <div className="invisible absolute left-0 top-full z-20 w-80 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <div role="tooltip" className="app-card rounded-2xl border p-3 text-xs leading-5 app-muted-text shadow-lg">
                {canManagePapers
                  ? "平台统一管理章节测试、标准作业卷和标准考试卷。"
                  : "进入对应模块后选择整套标准试卷。机构可以预览题目，但不能添加、删除、替换、排序或修改题目。"}
              </div>
            </div>
          </div>
        </section>

        {(paperResult.error ||
          assignmentResult.error ||
          chapterTestResult.error ||
          chapterQuestionResult.error) && (
          <section
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
              borderColor: "var(--app-warm)",
            }}
          >
            作业考试数据暂时无法完整读取，请确认最新数据库迁移已经执行。
          </section>
        )}

        <section
          className={`grid gap-5 md:grid-cols-2 ${
            canManagePapers ? "xl:grid-cols-3" : ""
          }`}
        >
          {cardData.map((item) => {
            const Icon = item.icon;
            const isChapterTest = item.type === "chapter_test";
            const availablePapers = papers.filter(
              (paper) =>
                paper.paper_type === item.type &&
                paper.status === "published"
            ).length;
            const allPapers = papers.filter(
              (paper) => paper.paper_type === item.type
            ).length;
            const releaseCount = assignments.filter(
              (assignment) => assignment.assignment_type === item.type
            ).length;
            const activeCount = assignments.filter(
              (assignment) =>
                assignment.assignment_type === item.type &&
                assignment.status === "published"
            ).length;

            return (
              <Link
                key={item.type}
                href={item.href}
                className="app-card group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      color: item.color,
                      backgroundColor: item.soft,
                    }}
                  >
                    <Icon size={22} />
                  </span>
                  <ArrowRight
                    className="transition group-hover:translate-x-1"
                    size={18}
                    style={{ color: item.color }}
                  />
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                  <h2 className="text-xl font-black">{item.title}</h2>
                  <span className="group/info relative shrink-0">
                    <Info className="app-muted-text cursor-help" size={14} />
                    <div className="invisible absolute left-0 top-full z-20 w-64 pt-2 opacity-0 transition group-hover/info:visible group-hover/info:opacity-100">
                      <div role="tooltip" className="app-card rounded-2xl border p-3 text-left text-xs leading-5 app-muted-text shadow-lg">
                        {item.description}
                      </div>
                    </div>
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="app-soft-card rounded-2xl border p-3">
                    <p className="text-2xl font-black">
                      {isChapterTest
                        ? chapterTests.length
                        : canManagePapers
                          ? allPapers
                          : availablePapers}
                    </p>
                    <p className="app-muted-text mt-1 text-[11px] font-black">
                      {isChapterTest
                        ? "课程章节测试"
                        : canManagePapers
                          ? "全部标准试卷"
                          : "平台可用试卷"}
                    </p>
                  </div>
                  <div className="app-soft-card rounded-2xl border p-3">
                    <p className="text-2xl font-black">
                      {isChapterTest
                        ? chapterQuestions.length
                        : canManagePapers
                          ? availablePapers
                          : activeCount}
                    </p>
                    <p className="app-muted-text mt-1 text-[11px] font-black">
                      {isChapterTest
                        ? "当前测试题目"
                        : canManagePapers
                          ? "机构可选择"
                          : "本机构进行中"}
                    </p>
                  </div>
                </div>
                {!canManagePapers && !isChapterTest && (
                  <p className="app-muted-text mt-4 text-xs">
                    本机构累计发布 {releaseCount} 次
                  </p>
                )}
              </Link>
            );
          })}
        </section>

        <section className="app-soft-card flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5 app-muted-text">
          <FileText className="mt-0.5 shrink-0" size={16} />
          <p>
            机构管理端只显示作业和考试；章节测试管理入口只向平台负责人及其指定管理员显示。学生端继续分别显示章节测试、作业和考试。
          </p>
        </section>
      </div>
    </div>
  );
}
