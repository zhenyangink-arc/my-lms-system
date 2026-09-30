export type {
  ManagementSectionKey,
  StudentNavGroup,
  StudentNavKey,
  SubjectManifest,
  SubjectSlug,
} from "./contracts.ts";
export { MANAGEMENT_SECTION_KEYS, STUDENT_NAV_KEYS } from "./contracts.ts";
export {
  SUBJECT_SLUGS,
  getSubjectManifest,
  isManagementSectionKey,
  isSubjectSectionEnabled,
  isSubjectSlug,
} from "./registry.ts";
