export const UNIVERSITY_ADMISSION_STAGES = [
  "language",
  "bachelor_fresh",
  "bachelor_transfer",
  "master",
  "doctor",
] as const;

export const UNIVERSITY_VISA_TYPES = [
  "d4_language",
  "d2_bachelor",
  "d2_master",
  "d2_doctor",
] as const;

export type UniversityAdmissionStage =
  (typeof UNIVERSITY_ADMISSION_STAGES)[number];
export type UniversityVisaType = (typeof UNIVERSITY_VISA_TYPES)[number];
export type UniversityOwnership = "national" | "public" | "private";
export type UniversityDisciplineGroup =
  | "humanities_social"
  | "science"
  | "natural_sciences"
  | "medicine";
export type UniversityDocumentCategory =
  | "identity"
  | "academic"
  | "application"
  | "financial"
  | "language";
export type UniversityVisaStage =
  | "admission"
  | "identity"
  | "finance"
  | "application"
  | "appointment"
  | "submission"
  | "result"
  | "entry";

export type ManagedUniversity = {
  id: string;
  name_zh: string;
  name_ko: string;
  logo_url: string | null;
  ownership: UniversityOwnership;
  province: string;
  city: string;
  admission_stages: UniversityAdmissionStage[];
  discipline_groups: UniversityDisciplineGroup[];
  tuition_min_krw: number;
  tuition_max_krw: number;
  tuition_min_cny: number;
  tuition_max_cny: number;
  tuition_reference_year: number;
  qs_rank_display: string | null;
  qs_rank_sort: number | null;
  qs_ranking_year: number | null;
  joongang_rank_display: string | null;
  joongang_rank_sort: number | null;
  joongang_ranking_year: number | null;
  summary: string;
  detailed_introduction: string | null;
  highlights: string[];
  application_deadlines: Partial<
    Record<UniversityAdmissionStage, string>
  >;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
};

export type UniversityDocumentRequirement = {
  id: string;
  university_id: string;
  admission_stage: UniversityAdmissionStage;
  category: UniversityDocumentCategory;
  title: string;
  description: string | null;
  sort_order: number;
};

export type UniversityVisaRequirement = {
  id: string;
  university_id: string;
  visa_type: UniversityVisaType;
  stage: UniversityVisaStage;
  title: string;
  description: string | null;
  sort_order: number;
  applicable_scopes: UniversityAdmissionStage[];
};

export type UniversityManagementResult = {
  canManageContent: boolean;
  canPermanentlyDelete: boolean;
  isInstitutionViewer: boolean;
  universities: ManagedUniversity[];
  requirements: UniversityDocumentRequirement[];
  visaRequirements: UniversityVisaRequirement[];
  universitiesError: string | null;
  requirementsError: string | null;
  visaRequirementsError: string | null;
  hasError: boolean;
};
