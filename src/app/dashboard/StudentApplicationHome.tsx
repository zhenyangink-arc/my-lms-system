import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calculator,
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
      <section className="app-card relative overflow-hidden rounded-3xl border p-6 sm:p-8" data-card-level="1">
        <div className="relative z-10 max-w-2xl">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              color: "var(--app-accent-strong)",
              backgroundColor: "var(--app-accent-soft)",
            }}
          >
            <AppIcon size={23} aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-black tracking-[0.18em] app-muted-text">
            {app.kind === "service" ? "学生服务应用" : "独立学习应用"}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            {isStudyAbroad ? "把每一步申请准备放在同一个空间" : `${app.title}正在独立建设`}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 app-muted-text sm:text-base">
            {isStudyAbroad
              ? "目标学校、申请材料和签证准备已经从韩语学习中分离，现在都归属于留学服务应用。"
              : `${app.description} 当前入口和数据边界已经独立，课程内容完成后会在这里直接开放。`}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-16 h-52 w-52 rounded-full blur-3xl"
          style={{ backgroundColor: "var(--app-accent-soft)" }}
        />
      </section>

      {isStudyAbroad ? (
        <section className="grid gap-4 lg:grid-cols-3" aria-label="留学服务功能">
          {studyAbroadEntrances.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.suffix}
                href={getStudentAppPath(space, appSlug, item.suffix)}
                className="app-card group flex min-h-52 flex-col rounded-3xl border p-5 transition hover:-translate-y-1"
                data-card-level="1"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{
                    color: "var(--app-secondary)",
                    backgroundColor: "var(--app-secondary-soft)",
                  }}
                >
                  <Icon size={21} aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-lg font-black">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 app-muted-text">{item.description}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-black" style={{ color: "var(--app-accent-strong)" }}>
                  进入功能
                  <ArrowRight size={15} className="transition group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="app-card rounded-3xl border p-6" data-card-level="1">
          <div className="flex items-start gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}
            >
              <Sparkles size={20} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-black">应用空间已经分离</h3>
              <p className="mt-2 text-sm leading-6 app-muted-text">
                这里不会再复用韩语课程、韩语成绩或韩语学习记录。后续接入的内容将只属于{app.title}。
              </p>
              <Link
                href={getStudentPortalPath(space)}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-black"
                style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}
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

