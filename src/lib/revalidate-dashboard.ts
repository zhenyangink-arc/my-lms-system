import { revalidatePath } from "next/cache";

/**
 * 管理工作区使用 `/[space]/dashboard/**`，学生应用使用
 * `/[space]/apps/[app]/**`。`/dashboard/**` 只作为共享实现使用的逻辑路径，
 * 不能被当成学生端可访问 URL。
 *
 * `/[space]` 是动态段，revalidatePath 支持用路由模式一次性覆盖所有租户，不需要在
 * 每个 action 里额外查当前租户 slug：
 * https://nextjs.org/docs/app/api-reference/functions/revalidatePath#revalidating-a-page-path
 */
export function revalidateDashboard(path: string, type?: "page" | "layout") {
  if (!path.startsWith("/dashboard")) {
    revalidatePath(path, type);
    return;
  }

  if (path === "/dashboard/courses" || path.startsWith("/dashboard/courses/")) {
    const courseSuffix = path.slice("/dashboard/courses".length);
    revalidatePath(`/[space]/apps/korean/courses${courseSuffix}`, type ?? "page");
    revalidatePath(`/[space]/apps/study-abroad/courses${courseSuffix}`, type ?? "page");
    return;
  }

  // 其余管理路径仍按租户管理工作区刷新。
  revalidatePath(path, type);
  revalidatePath(`/[space]${path}`, type ?? "page");
}
