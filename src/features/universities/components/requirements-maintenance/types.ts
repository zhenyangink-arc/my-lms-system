import type {
  UniversityDocumentRequirement,
  UniversityVisaRequirement,
} from "../../api/types";

export type UniversityRequirementDisplayRow = UniversityDocumentRequirement & {
  universityName: string;
  universityNameKo: string;
  universityProvince: string;
};

export type UniversityVisaRequirementDisplayRow = UniversityVisaRequirement & {
  universityName: string;
  universityNameKo: string;
  universityProvince: string;
};

export type RequirementUniversityOption = {
  value: string;
  label: string;
};
