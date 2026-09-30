import type { StudentAppSlug } from "@/lib/student-apps";

import {
  MANAGEMENT_SECTION_KEYS,
  type ManagementSectionKey,
  type SubjectManifest,
  type SubjectSlug,
} from "./contracts.ts";
import { englishManifest } from "./english/index.ts";
import { koreanManifest } from "./korean/index.ts";
import { mathManifest } from "./math/index.ts";

/**
 * 平台读取学科能力的唯一入口。只引用各学科的 index，不深链学科内部文件。
 * 留学服务、大学课程不是学科模块，查询结果为 null，由平台原有逻辑处理。
 */
const SUBJECT_MANIFESTS: Readonly<Record<SubjectSlug, SubjectManifest>> = {
  korean: koreanManifest,
  english: englishManifest,
  math: mathManifest,
};

export const SUBJECT_SLUGS = Object.keys(SUBJECT_MANIFESTS) as SubjectSlug[];

export function isSubjectSlug(slug: string): slug is SubjectSlug {
  return Object.prototype.hasOwnProperty.call(SUBJECT_MANIFESTS, slug);
}

export function getSubjectManifest(
  slug: StudentAppSlug | string,
): SubjectManifest | null {
  return isSubjectSlug(slug) ? SUBJECT_MANIFESTS[slug] : null;
}

export function isManagementSectionKey(
  value: string,
): value is ManagementSectionKey {
  return (MANAGEMENT_SECTION_KEYS as readonly string[]).includes(value);
}

/**
 * 只有学科清单明确启用时才为 true；没有学科清单的应用一律为 false。
 * 用于依赖学科能力的分区，避免对非学科应用放开。
 */
export function isSubjectSectionEnabled(
  slug: string,
  section: ManagementSectionKey,
) {
  return getSubjectManifest(slug)?.management.sections.includes(section) ?? false;
}
