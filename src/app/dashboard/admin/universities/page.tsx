import { requireUniversityManagementAccess } from "@/lib/university-management";
import {
  UniversityAdminManager,
  type AdminUniversity,
} from "./UniversityAdminManager";
import type { UniversityDocumentRequirement } from "./UniversityRequirementsDialog";
import type { UniversityVisaRequirement } from "./UniversityVisaRequirementsDialog";


const requirementStages = ["language", "bachelor_fresh", "bachelor_transfer", "master", "doctor"] as const;
const visaTypes = ["d4_language", "d2_bachelor", "d2_master", "d2_doctor"] as const;
const REQUIREMENT_PAGE_SIZE = 1000;

export default async function AdminUniversitiesPage() {
  const {
    supabase,
    canManageContent,
    canPermanentlyDelete,
    isInstitutionViewer,
  } = await requireUniversityManagementAccess();

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
        .select("id, university_id, visa_type, stage, title, description, sort_order, applicable_scopes")
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
  const visibleUniversityIds = new Set(universities.map((university) => university.id));
  const requirements = requirementStageResults
    .flatMap((result) => result.data)
    .filter((requirement) => canManageContent || visibleUniversityIds.has(requirement.university_id));
  const requirementsError = requirementStageResults.find((result) => result.error)?.error ?? null;
  const visaRequirements = visaRequirementResults
    .flatMap((result) => result.data)
    .filter((requirement) => canManageContent || visibleUniversityIds.has(requirement.university_id));
  const visaRequirementsError = visaRequirementResults.find((result) => result.error)?.error ?? null;
  return (
      <div className="mx-auto w-full max-w-[1640px] px-4 py-5 sm:px-6 lg:px-8">
        {universitiesResult.error || requirementsError || visaRequirementsError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
            大学数据读取失败：{universitiesResult.error?.message ?? requirementsError?.message ?? visaRequirementsError?.message}
          </div>
        ) : (
          <UniversityAdminManager
            canManageContent={canManageContent}
            canPermanentlyDelete={canPermanentlyDelete}
            isInstitutionViewer={isInstitutionViewer}
            universities={universities}
            requirements={requirements}
            visaRequirements={visaRequirements}
          />
        )}
      </div>
  );
}
