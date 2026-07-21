import { Database, Eye, GraduationCap, ShieldCheck } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { requireAdmin } from "@/lib/admin";
import {
  UniversityAdminManager,
  type AdminUniversity,
} from "./UniversityAdminManager";
import type { UniversityDocumentRequirement } from "./UniversityRequirementsDialog";
import type { UniversityVisaRequirement } from "./UniversityVisaRequirementsDialog";


export const runtime = "edge";
const requirementStages = ["language", "bachelor_fresh", "bachelor_transfer", "master", "doctor"] as const;
const visaTypes = ["d4_language", "d2_bachelor", "d2_master", "d2_doctor"] as const;
const REQUIREMENT_PAGE_SIZE = 1000;

export default async function AdminUniversitiesPage() {
  const { supabase } = await requireAdmin();

  async function loadRequirementsForStage(admissionStage: (typeof requirementStages)[number]) {
    const rows: UniversityDocumentRequirement[] = [];
    let offset = 0;

    while (true) {
      const result = await supabase
        .from("university_application_document_requirements")
        .select("id, university_id, admission_stage, category, title, description, sort_order")
        .eq("is_active", true)
        .eq("admission_stage", admissionStage)
        .order("university_id", { ascending: true })
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + REQUIREMENT_PAGE_SIZE - 1);

      if (result.error) return { data: rows, error: result.error };

      const page = (result.data ?? []) as UniversityDocumentRequirement[];
      rows.push(...page);
      if (page.length < REQUIREMENT_PAGE_SIZE) return { data: rows, error: null };
      offset += REQUIREMENT_PAGE_SIZE;
    }
  }

  async function loadVisaRequirementsForType(visaType: (typeof visaTypes)[number]) {
    const rows: UniversityVisaRequirement[] = [];
    let offset = 0;

    while (true) {
      const result = await supabase
        .from("university_visa_application_requirements")
        .select("id, university_id, visa_type, stage, title, description, sort_order")
        .eq("is_active", true)
        .eq("visa_type", visaType)
        .order("university_id", { ascending: true })
        .order("stage", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + REQUIREMENT_PAGE_SIZE - 1);

      if (result.error) return { data: rows, error: result.error };

      const page = (result.data ?? []) as UniversityVisaRequirement[];
      rows.push(...page);
      if (page.length < REQUIREMENT_PAGE_SIZE) return { data: rows, error: null };
      offset += REQUIREMENT_PAGE_SIZE;
    }
  }

  const [universitiesResult, requirementStageResults, visaRequirementResults] = await Promise.all([
    supabase
      .from("korean_universities")
      .select("id, name_zh, name_ko, logo_url, ownership, province, city, admission_stages, discipline_groups, tuition_min_krw, tuition_max_krw, tuition_min_cny, tuition_max_cny, tuition_reference_year, qs_rank_display, qs_rank_sort, qs_ranking_year, joongang_rank_display, joongang_rank_sort, joongang_ranking_year, summary, detailed_introduction, highlights, application_deadlines, is_featured, is_published, sort_order, updated_at")
      .order("sort_order", { ascending: true }),
    Promise.all(requirementStages.map(loadRequirementsForStage)),
    Promise.all(visaTypes.map(loadVisaRequirementsForType)),
  ]);

  const universities = (universitiesResult.data ?? []) as AdminUniversity[];
  const requirements = requirementStageResults.flatMap((result) => result.data);
  const requirementsError = requirementStageResults.find((result) => result.error)?.error ?? null;
  const visaRequirements = visaRequirementResults.flatMap((result) => result.data);
  const visaRequirementsError = visaRequirementResults.find((result) => result.error)?.error ?? null;
  const publishedCount = universities.filter((university) => university.is_published).length;
  const featuredCount = universities.filter((university) => university.is_featured).length;

  return (
    <>
      <DashboardPageHeader title="韩国大学管理" description="维护韩国大学介绍、申请资料和签证申请资料；修改会同步到学生端。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "学校库总数", value: universities.length, icon: Database, color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
            { label: "学生可见", value: publishedCount, icon: Eye, color: "var(--app-success)", soft: "var(--app-success-soft)" },
            { label: "重点推荐", value: featuredCount, icon: GraduationCap, color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
          ].map(({ label, value, icon: Icon, color, soft }) => <div key={label} className="app-card flex items-center gap-4 rounded-2xl border p-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color, backgroundColor: soft }}><Icon size={19} /></span><div><p className="text-2xl font-black">{value}</p><p className="text-xs font-bold app-muted-text">{label}</p></div></div>)}
        </section>

        <div className="flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5" style={{ color: "var(--app-secondary)", borderColor: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><ShieldCheck className="mt-0.5 shrink-0" size={17} /><p><b>人工复核优先：</b>学校库种子数据只用于建立初始结构。招生政策、学费和排名变化后，请在这里更新，学生端不会提供学校官网跳转。</p></div>

        {universitiesResult.error || requirementsError || visaRequirementsError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
            大学数据读取失败：{universitiesResult.error?.message ?? requirementsError?.message ?? visaRequirementsError?.message}
          </div>
        ) : (
          <UniversityAdminManager universities={universities} requirements={requirements} visaRequirements={visaRequirements} />
        )}
      </div>
    </>
  );
}
