import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  GraduationCap,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { SchoolCrest } from "@/components/school/SchoolCrest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { requireAdmin } from "@/lib/admin";

import { DashboardPageHeader } from "../../../../DashboardPageHeader";
import {
  createSchoolProgramAction,
  deleteSchoolProgramAction,
  updateSchoolAction,
  updateSchoolProgramAction,
} from "../../actions";
import {
  educationStageLabels,
  getSchoolCategoryBySlug,
  ownershipLabels,
} from "../../school-config";

type SchoolRow = {
  id: string;
  category: string;
  name_zh: string;
  name_local: string | null;
  logo_url: string | null;
  ownership: string;
  province: string | null;
  city: string | null;
  summary: string | null;
  detailed_introduction: string | null;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
};

type ProgramRow = {
  id: string;
  name_zh: string;
  name_local: string | null;
  education_stage: string;
  discipline_group: string;
  introduction: string | null;
  duration_text: string | null;
  tuition_note: string | null;
  admission_requirement: string | null;
  is_published: boolean;
  sort_order: number;
};

const stageOptions = [
  ["language", "语学堂"],
  ["bachelor_fresh", "本科新入"],
  ["bachelor_transfer", "本科插班"],
  ["master", "硕士"],
  ["doctor", "博士"],
  ["high_school", "高中"],
  ["vocational", "中专"],
  ["technical", "技工"],
  ["other", "其他"],
];

const disciplineOptions = [
  ["humanities_social", "人文社会"],
  ["science", "理科"],
  ["natural_sciences", "自然科学"],
  ["medicine", "医学"],
  ["arts", "艺术"],
  ["engineering", "工科"],
  ["other", "其他"],
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";
const fieldClass = `app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm ${focusRing}`;

function ProgramFields({ program }: { program?: ProgramRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold">
        专业中文名称
        <input
          name="nameZh"
          required
          defaultValue={program?.name_zh}
          className={fieldClass}
        />
      </label>
      <label className="text-xs font-semibold">
        本地名称
        <input
          name="nameLocal"
          defaultValue={program?.name_local ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="text-xs font-semibold">
        教育阶段
        <select
          name="educationStage"
          defaultValue={program?.education_stage ?? "other"}
          className={fieldClass}
        >
          {stageOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold">
        学科类别
        <select
          name="disciplineGroup"
          defaultValue={program?.discipline_group ?? "other"}
          className={fieldClass}
        >
          {disciplineOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold">
        学制
        <input
          name="durationText"
          defaultValue={program?.duration_text ?? ""}
          placeholder="例如：四年"
          className={fieldClass}
        />
      </label>
      <label className="text-xs font-semibold">
        学费说明
        <input
          name="tuitionNote"
          defaultValue={program?.tuition_note ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="text-xs font-semibold sm:col-span-2">
        专业介绍
        <textarea
          name="introduction"
          rows={4}
          defaultValue={program?.introduction ?? ""}
          className={`${fieldClass} leading-6`}
        />
      </label>
      <label className="text-xs font-semibold sm:col-span-2">
        申请要求
        <textarea
          name="admissionRequirement"
          rows={3}
          defaultValue={program?.admission_requirement ?? ""}
          className={`${fieldClass} leading-6`}
        />
      </label>
      <label className="text-xs font-semibold">
        排序
        <input
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={program?.sort_order ?? 1000}
          className={fieldClass}
        />
      </label>
      <label className="flex items-end gap-2 pb-3 text-xs font-semibold">
        <input
          name="isPublished"
          type="checkbox"
          defaultChecked={program?.is_published ?? true}
          className={focusRing}
        />
        对学生展示
      </label>
    </div>
  );
}

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ category: string; schoolId: string }>;
}) {
  const { category: categorySlug, schoolId } = await params;
  const category = getSchoolCategoryBySlug(categorySlug);
  if (!category) notFound();

  const { supabase } = await requireAdmin();
  const [schoolResult, programResult] = await Promise.all([
    supabase
      .from("schools")
      .select(
        "id, category, name_zh, name_local, logo_url, ownership, province, city, summary, detailed_introduction, is_published, is_featured, sort_order",
      )
      .eq("id", schoolId)
      .eq("category", category.value)
      .maybeSingle(),
    supabase
      .from("school_programs")
      .select(
        "id, name_zh, name_local, education_stage, discipline_group, introduction, duration_text, tuition_note, admission_requirement, is_published, sort_order",
      )
      .eq("school_id", schoolId)
      .order("sort_order", { ascending: true }),
  ]);

  if (schoolResult.error) {
    throw new Error("学校资料读取失败");
  }
  if (!schoolResult.data) notFound();

  const school = schoolResult.data as SchoolRow;
  const programs = (programResult.data ?? []) as ProgramRow[];

  return (
    <>
      <DashboardPageHeader
        title={school.name_zh}
        description={`${category.label} · ${ownershipLabels[school.ownership] ?? school.ownership} · ${school.city ?? "地区待完善"}`}
      />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        <Link
          href={`/dashboard/admin/schools/${categorySlug}`}
          className={`inline-flex items-center gap-2 rounded-md text-xs font-semibold app-muted-text ${focusRing}`}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回{category.label}列表
        </Link>

        <section
          className="app-card rounded-3xl border p-5"
          aria-labelledby="school-context-heading"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <SchoolCrest
              logoUrl={school.logo_url}
              name={school.name_zh}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <h2 id="school-context-heading" className="text-lg font-semibold">
                学校概况
              </h2>
              <p className="app-muted-text mt-2 text-sm">
                {school.name_local || "本地名称待完善"} ·{" "}
                {school.province || "地区待完善"} {school.city || ""}
              </p>
            </div>
            <nav className="grid gap-2 sm:grid-cols-2" aria-label="详情页章节">
              <a
                href="#school-introduction"
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${focusRing}`}
                style={{ backgroundColor: "var(--primary)" }}
              >
                <BookOpenText size={16} aria-hidden="true" />
                学校详细介绍
              </a>
              <a
                href="#school-programs"
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${focusRing}`}
                style={{ backgroundColor: "var(--support)" }}
              >
                <GraduationCap size={16} aria-hidden="true" />
                学校专业介绍
              </a>
            </nav>
          </div>
        </section>

        <form
          id="school-introduction"
          action={updateSchoolAction.bind(null, categorySlug, schoolId)}
          className="app-card scroll-mt-24 rounded-3xl border p-4 sm:p-5"
        >
          <input type="hidden" name="category" value={category.value} />
          <div className="mb-5">
            <h2 className="text-xl font-semibold">学校详细介绍</h2>
            <p className="app-muted-text mt-1 text-xs">
              基础资料、校徽与介绍保存后同步展示到学校库。
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              学校中文名称
              <input
                name="nameZh"
                required
                defaultValue={school.name_zh}
                className={fieldClass}
              />
            </label>
            <label className="text-xs font-semibold">
              本地名称
              <input
                name="nameLocal"
                defaultValue={school.name_local ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="text-xs font-semibold">
              学校性质
              <select
                name="ownership"
                defaultValue={school.ownership}
                className={fieldClass}
              >
                {Object.entries(ownershipLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              校徽图片地址
              <input
                name="logoUrl"
                type="url"
                defaultValue={school.logo_url ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="text-xs font-semibold">
              省／道／直辖市
              <input
                name="province"
                defaultValue={school.province ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="text-xs font-semibold">
              城市
              <input
                name="city"
                defaultValue={school.city ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="text-xs font-semibold sm:col-span-2">
              学校摘要
              <textarea
                name="summary"
                rows={3}
                defaultValue={school.summary ?? ""}
                className={`${fieldClass} leading-6`}
              />
            </label>
            <label className="text-xs font-semibold sm:col-span-2">
              详细介绍
              <textarea
                name="detailedIntroduction"
                rows={10}
                defaultValue={school.detailed_introduction ?? ""}
                className={`${fieldClass} leading-6`}
              />
            </label>
            <label className="text-xs font-semibold">
              排序
              <input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={school.sort_order}
                className={fieldClass}
              />
            </label>
            <fieldset className="flex items-end gap-5 pb-3 text-xs font-semibold">
              <legend className="sr-only">展示设置</legend>
              <label className="flex items-center gap-2">
                <input
                  name="isPublished"
                  type="checkbox"
                  defaultChecked={school.is_published}
                  className={focusRing}
                />
                对学生展示
              </label>
              <label className="flex items-center gap-2">
                <input
                  name="isFeatured"
                  type="checkbox"
                  defaultChecked={school.is_featured}
                  className={focusRing}
                />
                重点推荐
              </label>
            </fieldset>
          </div>
          <button
            type="submit"
            className={`mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white ${focusRing}`}
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Save size={15} aria-hidden="true" />
            保存学校资料
          </button>
        </form>

        <section
          id="school-programs"
          className="app-card scroll-mt-24 rounded-3xl border p-4 sm:p-5"
          aria-labelledby="school-programs-heading"
        >
          <DashboardTitleWithHint
            headingLevel={2}
            titleClassName="text-xl font-semibold"
            title={<span id="school-programs-heading">学校专业介绍</span>}
            description={<>共 {programs.length} 个专业</>}
          />

          {programResult.error && (
            <div
              role="alert"
              className="mt-5 rounded-2xl border p-4 text-sm font-semibold"
              style={{
                color: "var(--status-danger)",
                backgroundColor: "var(--status-danger-surface)",
                borderColor: "var(--status-danger)",
              }}
            >
              专业资料暂时无法读取，请刷新页面重试。
            </div>
          )}

          <details className="app-soft-card mt-5 rounded-2xl border p-4">
            <summary
              className={`flex cursor-pointer items-center gap-2 rounded-md text-sm font-semibold ${focusRing}`}
            >
              <Plus size={15} aria-hidden="true" />
              新增专业
            </summary>
            <form
              action={createSchoolProgramAction.bind(
                null,
                categorySlug,
                schoolId,
              )}
              className="mt-5 space-y-4"
            >
              <ProgramFields />
              <button
                type="submit"
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${focusRing}`}
                style={{ backgroundColor: "var(--support)" }}
              >
                保存新专业
              </button>
            </form>
          </details>

          {!programResult.error && (
            <div className="mt-5 space-y-4">
              {programs.map((program) => (
                <details
                  key={program.id}
                  className="app-soft-card rounded-2xl border p-4"
                >
                  <summary className={`cursor-pointer rounded-md ${focusRing}`}>
                    <span className="inline-flex w-[calc(100%-1.5rem)] items-center justify-between gap-3">
                      <span>
                        <span className="font-semibold">{program.name_zh}</span>
                        <span className="app-muted-text ml-2 text-xs">
                          {educationStageLabels[program.education_stage] ??
                            program.education_stage}
                        </span>
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: program.is_published
                            ? "var(--status-success)"
                            : "var(--foreground-muted)",
                        }}
                      >
                        {program.is_published ? "展示中" : "已隐藏"}
                      </span>
                    </span>
                  </summary>
                  <form
                    action={updateSchoolProgramAction.bind(
                      null,
                      categorySlug,
                      schoolId,
                      program.id,
                    )}
                    className="mt-5 space-y-4"
                  >
                    <ProgramFields program={program} />
                    <button
                      type="submit"
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${focusRing}`}
                      style={{ backgroundColor: "var(--primary)" }}
                    >
                      保存专业
                    </button>
                  </form>

                  <AlertDialog>
                    <AlertDialogTrigger
                      type="button"
                      className={`mt-3 inline-flex items-center gap-1 rounded-md text-xs font-semibold ${focusRing}`}
                      style={{ color: "var(--status-danger)" }}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      删除此专业
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          删除“{program.name_zh}”？
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          删除后无法恢复。请确认该专业不再需要展示或维护。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel type="button">取消</AlertDialogCancel>
                        <form
                          action={deleteSchoolProgramAction.bind(
                            null,
                            categorySlug,
                            schoolId,
                            program.id,
                          )}
                        >
                          <AlertDialogAction
                            type="submit"
                            variant="destructive"
                          >
                            确认删除
                          </AlertDialogAction>
                        </form>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </details>
              ))}
              {programs.length === 0 && (
                <p className="app-muted-text py-10 text-center text-sm">
                  暂未录入专业，点击“新增专业”开始完善。
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
