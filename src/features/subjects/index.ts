export type {
  ManagementSectionKey,
  StudentHomeBlockKey,
  StudentNavGroup,
  StudentNavKey,
  SubjectManifest,
  SubjectSlug,
} from "./contracts.ts";
export {
  MANAGEMENT_SECTION_KEYS,
  STUDENT_HOME_BLOCK_KEYS,
  STUDENT_NAV_KEYS,
} from "./contracts.ts";
export {
  SUBJECT_SLUGS,
  getSubjectManifest,
  isManagementSectionKey,
  isStudentHomeBlockEnabled,
  isStudentNavItemEnabled,
  isSubjectSectionEnabled,
  isSubjectSlug,
} from "./registry.ts";
