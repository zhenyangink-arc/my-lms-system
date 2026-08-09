import "server-only";

import { requireUniversityManagementAccess } from "@/lib/university-management";
import {
  UNIVERSITY_ADMISSION_STAGES,
  UNIVERSITY_VISA_TYPES,
  type ManagedUniversity,
  type UniversityAdmissionStage,
  type UniversityDocumentRequirement,
  type UniversityManagementResult,
  type UniversityVisaRequirement,
  type UniversityVisaType,
} from "./types";

export const UNIVERSITY_REQUIREMENT_PAGE_SIZE = 1000;

type UniversityManagementClient = Awaited<
  ReturnType<typeof requireUniversityManagementAccess>
>["supabase"];

type QueryError = { message: string };

export type UniversityRequirementPageResult<T> = {
  data: T[];
  error: QueryError | null;
};

export async function loadUniversityDocumentRequirementsForStage(
  supabase: UniversityManagementClient,
  admissionStage: UniversityAdmissionStage,
): Promise<UniversityRequirementPageResult<UniversityDocumentRequirement>> {
  const rows: UniversityDocumentRequirement[] = [];
  let offset = 0;

  while (true) {
    const result = await supabase
      .from("university_application_document_requirements")
      .select(
        "id, university_id, admission_stage, category, title, description, sort_order",
      )
      .eq("is_active", true)
      .eq("admission_stage", admissionStage)
      .order("university_id", { ascending: true })
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + UNIVERSITY_REQUIREMENT_PAGE_SIZE - 1);

    if (result.error) return { data: rows, error: result.error };

    const page = (result.data ?? []) as UniversityDocumentRequirement[];
    rows.push(...page);
    if (page.length < UNIVERSITY_REQUIREMENT_PAGE_SIZE) {
      return { data: rows, error: null };
    }
    offset += UNIVERSITY_REQUIREMENT_PAGE_SIZE;
  }
}

export async function loadUniversityVisaRequirementsForType(
  supabase: UniversityManagementClient,
  visaType: UniversityVisaType,
): Promise<UniversityRequirementPageResult<UniversityVisaRequirement>> {
  const rows: UniversityVisaRequirement[] = [];
  let offset = 0;

  while (true) {
    const result = await supabase
      .from("university_visa_application_requirements")
      .select(
        "id, university_id, visa_type, stage, title, description, sort_order, applicable_scopes",
      )
      .eq("is_active", true)
      .eq("visa_type", visaType)
      .order("university_id", { ascending: true })
      .order("stage", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + UNIVERSITY_REQUIREMENT_PAGE_SIZE - 1);

    if (result.error) return { data: rows, error: result.error };

    const page = (result.data ?? []) as UniversityVisaRequirement[];
    rows.push(...page);
    if (page.length < UNIVERSITY_REQUIREMENT_PAGE_SIZE) {
      return { data: rows, error: null };
    }
    offset += UNIVERSITY_REQUIREMENT_PAGE_SIZE;
  }
}

export async function getUniversityManagementData(): Promise<UniversityManagementResult> {
  const {
    supabase,
    canManageContent,
    canPermanentlyDelete,
    isInstitutionViewer,
  } = await requireUniversityManagementAccess();

  const [
    universitiesResult,
    requirementStageResults,
    visaRequirementResults,
  ] = await Promise.all([
    supabase
      .from("korean_universities")
      .select(
        "id, name_zh, name_ko, logo_url, ownership, province, city, admission_stages, discipline_groups, tuition_min_krw, tuition_max_krw, tuition_min_cny, tuition_max_cny, tuition_reference_year, qs_rank_display, qs_rank_sort, qs_ranking_year, joongang_rank_display, joongang_rank_sort, joongang_ranking_year, summary, detailed_introduction, highlights, application_deadlines, is_featured, is_published, sort_order, updated_at",
      )
      .order("sort_order", { ascending: true }),
    Promise.all(
      UNIVERSITY_ADMISSION_STAGES.map((stage) =>
        loadUniversityDocumentRequirementsForStage(supabase, stage),
      ),
    ),
    Promise.all(
      UNIVERSITY_VISA_TYPES.map((visaType) =>
        loadUniversityVisaRequirementsForType(supabase, visaType),
      ),
    ),
  ]);

  const universities = (universitiesResult.data ?? []) as ManagedUniversity[];
  const visibleUniversityIds = new Set(
    universities.map((university) => university.id),
  );
  const requirements = requirementStageResults
    .flatMap((result) => result.data)
    .filter(
      (requirement) =>
        canManageContent || visibleUniversityIds.has(requirement.university_id),
    );
  const visaRequirements = visaRequirementResults
    .flatMap((result) => result.data)
    .filter(
      (requirement) =>
        canManageContent || visibleUniversityIds.has(requirement.university_id),
    );
  const requirementsError =
    requirementStageResults.find((result) => result.error)?.error?.message ??
    null;
  const visaRequirementsError =
    visaRequirementResults.find((result) => result.error)?.error?.message ??
    null;
  const universitiesError = universitiesResult.error?.message ?? null;

  return {
    canManageContent,
    canPermanentlyDelete,
    isInstitutionViewer,
    universities,
    requirements,
    visaRequirements,
    universitiesError,
    requirementsError,
    visaRequirementsError,
    hasError: Boolean(
      universitiesError || requirementsError || visaRequirementsError,
    ),
  };
}
