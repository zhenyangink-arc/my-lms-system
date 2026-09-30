import type { StudentAppSlug } from "@/lib/student-apps";

import {
  MANAGEMENT_SECTION_KEYS,
  type ManagementSectionKey,
  type StudentHomeBlockKey,
  type StudentNavKey,
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

/**
 * 学生导航是否包含该栏目。没有学科清单的应用返回 null，由调用方沿用原有逻辑。
 * 用于决定是否生成指向该栏目的任务或链接，避免出现指向不存在页面的入口。
 */
export function isStudentNavItemEnabled(
  slug: string,
  item: StudentNavKey,
): boolean | null {
  const manifest = getSubjectManifest(slug);
  if (!manifest) return null;
  return manifest.student.navigation.some((group) => group.items.includes(item));
}

/** 学科首页是否启用该平台区块；没有学科清单的应用一律为 false。 */
export function isStudentHomeBlockEnabled(
  slug: string,
  block: StudentHomeBlockKey,
): boolean {
  return getSubjectManifest(slug)?.student.homeBlocks.includes(block) ?? false;
}
