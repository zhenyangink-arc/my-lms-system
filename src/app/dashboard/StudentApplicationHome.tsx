import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calculator,
  Clock3,
  FileText,
  GraduationCap,
  Languages,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  getStudentAppDefinition,
  getStudentAppPath,
  getStudentPortalPath,
  type StudentAppSlug,
} from "@/lib/student-apps";

const appIconMap = {
  korean: Languages,
  english: BookOpen,
  math: Calculator,
  university: GraduationCap,
  "study-abroad": GraduationCap,
} satisfies Record<StudentAppSlug, typeof Languages>;

const studyAbroadEntrances = [
  {
    title: "目标大学",
    description: "管理意向学校、专业方向与申请阶段。",
    suffix: "/universities",
    icon: Building2,
  },
  {
    title: "申请材料",
    description: "按目标学校准备、核对并跟踪申请文件。",
    suffix: "/documents",
    icon: FileText,
  },
  {
    title: "签证准备",
    description: "查看签证材料、办理阶段和待完成事项。",
    suffix: "/visa",
    icon: ShieldCheck,
  },
] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";

export function StudentApplicationHome({
  space,
  appSlug,
}: {
  space: string;
  appSlug: Exclude<StudentAppSlug, "korean">;
}) {
  const app = getStudentAppDefinition(appSlug);
  const AppIcon = appIconMap[appSlug];
  const isStudyAbroad = appSlug === "study-abroad";

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {isStudyAbroad ? (
        <>
          <section
            className="app-card rounded-3xl border p-6 sm:p-8"
            data-card-level="1"
            aria-labelledby="study-abroad-next-step"
          >
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex items-start gap-4">
                <span
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}
                >
                  <AppIcon size={23} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold tracking-[0.18em] app-muted-text">下一步</p>
                  <h2 id="study-abroad-next-step" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    先确认你的目标大学
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 app-muted-text sm:text-base">
                    目标学校和申请阶段确定后，材料清单与签证任务会按服务进度在对应页面显示。
                  </p>
                </div>
              </div>
              <Link
                href={getStudentAppPath(space, appSlug, "/universities")}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold ${focusRing}`}
                style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
              >
                管理目标大学
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="app-soft-card rounded-2xl border p-4 sm:p-5" aria-labelledby="study-abroad-due-tasks">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 shrink-0" size={19} style={{ color: "var(--status-warning)" }} aria-hidden="true" />
              <div>
                <h2 id="study-abroad-due-tasks" className="text-base font-bold">需要处理的事项</h2>
                <p className="mt-1 text-sm leading-6 app-muted-text">
                  当前首页不汇总截止日期。请在“申请材料”查看材料截止状态，在“签证准备”查看待审核或需补充任务。
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="study-abroad-services">
            <h2 id="study-abroad-services" className="text-lg font-bold">当前服务</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {studyAbroadEntrances.slice(1).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.suffix}
                    href={getStudentAppPath(space, appSlug, item.suffix)}
                    className={`app-card group flex min-h-44 flex-col rounded-3xl border p-5 transition hover:-translate-y-0.5 ${focusRing}`}
                    data-card-level="1"
                  >
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}
                    >
                      <Icon size={21} aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 app-muted-text">{item.description}</p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold" style={{ color: "var(--primary-hover)" }}>
                      查看服务
                      <ArrowRight size={15} className="transition group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="app-card rounded-3xl border p-5" aria-labelledby="study-abroad-resources">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}
                >
                  <BookOpen size={19} aria-hidden="true" />
                </span>
                <div>
                  <h2 id="study-abroad-resources" className="text-base font-bold">学习资源</h2>
                  <p className="mt-1 text-sm leading-6 app-muted-text">选校、材料、签证与面试准备课程是服务流程之外的辅助资源。</p>
                </div>
              </div>
              <Link
                href={getStudentAppPath(space, appSlug, "/courses")}
                className={`app-soft-card inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold ${focusRing}`}
              >
                查看留学课程
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </>
      ) : (
        <section className="app-card rounded-3xl border p-6 sm:p-8" data-card-level="1">
          <div className="flex items-start gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}
            >
              <Sparkles size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{app.title}建设中</h2>
              <Link
                href={getStudentPortalPath(space)}
                className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${focusRing}`}
                style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}
              >
                返回应用门户
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
