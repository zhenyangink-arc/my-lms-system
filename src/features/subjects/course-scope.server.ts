import "server-only";

import { loadUniversityVisibleSubcategoryIds } from "./university/course-scope.server";

// 学科自己的“课程可见范围”解析器（注册机制）：共享的课程读取代码（首页继续学习、门户任务）只调用
// loadVisibleSubcategoryIds，不写学科判断。没有注册解析器的应用不受限（返回 null），行为与原来一致。
// 返回的是该应用一级分类下学生可见的二级分类 id；读取失败会抛错（不静默放行、不静默隐藏）。
type CourseScopeResolver = () => Promise<ReadonlySet<string> | null>;

const resolvers: Partial<Record<string, CourseScopeResolver>> = {
  university: loadUniversityVisibleSubcategoryIds,
};

export async function loadVisibleSubcategoryIds(appSlug: string): Promise<ReadonlySet<string> | null> {
  const resolve = resolvers[appSlug];
  return resolve ? await resolve() : null;
}
