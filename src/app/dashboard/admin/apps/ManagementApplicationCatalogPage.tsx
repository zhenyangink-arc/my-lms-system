import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Calculator,
  GraduationCap,
  Languages,
  LayoutGrid,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { getAdminRoleLabel } from "@/app/dashboard/admin/admin-navigation";
import {
  requireManagementAppCatalogAccess,
  type ManagementAppCatalogItem,
} from "@/lib/management-apps";
import type { StudentAppSlug } from "@/lib/student-apps";
import { createClient } from "@/lib/supabase/server";

type CountResult = { count: number | null; error: unknown };

type AppMetrics = {
  courses: number;
  students: number;
  assignments: number;
  staff: number;
};

const appIconMap = {
  korean: Languages,
  english: BookOpenCheck,
  math: Calculator,
  university: GraduationCap,
  "study-abroad": Building2,
} satisfies Record<StudentAppSlug, typeof Languages>;

const appToneMap = {
  korean: "management-app-tone-emerald",
  english: "management-app-tone-sky",
  math: "management-app-tone-amber",
  university: "management-app-tone-violet",
  "study-abroad": "management-app-tone-rose",
} satisfies Record<StudentAppSlug, string>;

function countValue(result: CountResult) {
  return result.error ? 0 : Number(result.count ?? 0) || 0;
}

function availabilityLabel(item: ManagementAppCatalogItem) {
  if (!item.availability.enabled || item.availability.status === "hidden") {
    return "未开放";
  }
  if (item.availability.status === "coming_soon") return "建设中";
  return "运行中";
}

async function getAppMetrics(
  item: ManagementAppCatalogItem,
  access: Awaited<ReturnType<typeof requireManagementAppCatalogAccess>>,
  client: Awaited<ReturnType<typeof createClient>>,
): Promise<AppMetrics> {
  let studentQuery = client
    .from("student_app_enrollments")
    .select("student_id", { count: "exact", head: true })
    .eq("app_id", item.appId)
    .eq("status", "active");
  let assignmentQuery = client
    .from("learning_assignments")
    .select("id", { count: "exact", head: true })
    .eq("student_app_id", item.appId);
  let staffQuery = client
    .from("staff_app_assignments")
    .select("staff_id", { count: "exact", head: true })
    .eq("app_id", item.appId)
    .eq("status", "active");

  if (access.tenantId) {
    studentQuery = studentQuery.eq("tenant_id", access.tenantId);
    assignmentQuery = assignmentQuery.eq("tenant_id", access.tenantId);
    staffQuery = staffQuery.eq("tenant_id", access.tenantId);
  }

  const [courseResult, studentResult, assignmentResult, staffResult] =
    (await Promise.all([
      client
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("student_app_id", item.appId),
      studentQuery,
      assignmentQuery,
      staffQuery,
    ])) as CountResult[];

  return {
    courses: countValue(courseResult),
    students: countValue(studentResult),
    assignments: countValue(assignmentResult),
    staff: countValue(staffResult),
  };
}

export async function ManagementApplicationCatalogPage({
  space,
}: {
  space: string;
}) {
  const access = await requireManagementAppCatalogAccess(space);
  const client = await createClient();
  const metrics = await Promise.all(
    access.items.map((item) => getAppMetrics(item, access, client)),
  );
  const totalStudents = metrics.reduce((sum, item) => sum + item.students, 0);
  const totalAssignments = metrics.reduce(
    (sum, item) => sum + item.assignments,
    0,
  );
  const runningApps = access.items.filter(
    (item) => item.availability.enabled && item.availability.status === "active",
  ).length;

  return (
    <div className="management-page space-y-5">
      <header className="app-card border px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="management-kicker text-[11px] font-semibold uppercase">
              {access.scope === "platform" ? "Platform applications" : "Tenant applications"}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.035em]">
              应用中心
            </h1>
            <p className="app-muted-text mt-2 max-w-3xl text-sm leading-6">
              {access.scope === "platform"
                ? "维护标准应用和平台内容，查看各应用在机构中的运行范围。"
                : `在${access.tenantName ?? "当前机构"}内按应用处理学生、教学、考核和服务数据。`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md border px-2.5 py-1.5 app-muted-text">
              {getAdminRoleLabel(access.role)}
            </span>
            <span className="rounded-md border px-2.5 py-1.5 app-muted-text">
              {access.items.length} 个可访问应用
            </span>
          </div>
        </div>
      </header>

      <section className="grid overflow-hidden rounded-lg border bg-[var(--app-card-bg)] sm:grid-cols-3" aria-label="应用运营概况">
        {[
          { label: "运行中的应用", value: runningApps, suffix: "个", icon: ShieldCheck },
          { label: "已授权学生", value: totalStudents, suffix: "人次", icon: UsersRound },
          { label: "应用内任务", value: totalAssignments, suffix: "项", icon: LayoutGrid },
        ].map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className={`flex min-h-24 items-center gap-3 px-5 py-4 ${index > 0 ? "border-t sm:border-l sm:border-t-0" : ""}`}>
              <span className="management-app-summary-icon flex size-9 shrink-0 items-center justify-center rounded-md">
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div>
                <p className="app-muted-text text-xs">{metric.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {metric.value}<span className="app-muted-text ml-1 text-xs font-normal">{metric.suffix}</span>
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="management-app-grid-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="management-app-grid-title" className="text-sm font-semibold">应用工作区</h2>
            <p className="app-muted-text mt-1 text-xs">每个工作区都具有独立的数据和权限范围。</p>
          </div>
        </div>

        {access.items.length === 0 ? (
          <div className="app-card border p-8 text-center">
            <p className="text-sm font-medium">当前账号还没有应用权限</p>
            <p className="app-muted-text mt-2 text-xs leading-5">请联系机构负责人分配教学或运营应用。</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {access.items.map((item, index) => {
              const Icon = appIconMap[item.app.slug];
              const itemMetrics = metrics[index];
              const statusLabel = availabilityLabel(item);
              return (
                <Link
                  key={item.app.slug}
                  href={item.appPath}
                  className={`management-app-card app-card group flex min-h-64 flex-col border p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 ${appToneMap[item.app.slug]}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="management-app-icon flex size-10 items-center justify-center rounded-md border">
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="management-app-status inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium">
                      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                      {statusLabel}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold">{item.appTitle}</h3>
                  <p className="app-muted-text mt-1.5 min-h-10 text-xs leading-5">{item.app.description}</p>
                  <dl className="mt-5 grid grid-cols-4 gap-2 border-y py-3">
                    {[
                      ["课程", itemMetrics.courses],
                      ["学生", itemMetrics.students],
                      ["任务", itemMetrics.assignments],
                      ["员工", itemMetrics.staff],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="app-muted-text text-[10px]">{label}</dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <span className="mt-auto flex items-center justify-between pt-4 text-xs font-semibold">
                    <span>{item.app.kind === "service" ? "服务运营空间" : "教学运营空间"}</span>
                    <span className="inline-flex items-center gap-1 text-[var(--app-accent-strong)]">
                      打开工作台
                      <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
