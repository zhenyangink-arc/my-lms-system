import { revalidatePath } from "next/cache";

/**
 * 真实路由是 `/[space]/dashboard/**`，`/dashboard/**` 只是共享实现 + legacy 重定向
 * （见 AGENTS.md）。过去所有 action 只 revalidatePath("/dashboard/x")，命中的是
 * legacy 路由本身，多租户下学生实际访问的 `/[tenantSlug]/dashboard/x` 页面缓存并不会
 * 刷新，一直靠各页面的 force-dynamic 兜底掩盖。
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

  // path 自己也可能带一段动态段（如 korean/[testSlug]），原样透传 type；
  // 拼上 /[space] 的那份必须有 type，未显式指定时按 "page" 处理。
  revalidatePath(path, type);
  revalidatePath(`/[space]${path}`, type ?? "page");
}
