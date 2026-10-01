import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { createClient } from "@/lib/supabase/server";

import type { SubjectSectionExtrasProps } from "../../admin-slot-contract.ts";
import { CATEGORY_ACCESS_MODE_LABELS, CATEGORY_ACCESS_MODES, type CategoryAccessMode } from "../major-access.ts";
import { setCategoryAccessAction } from "./actions";

type CategoryRow = { id: string; title: string; sort_order: number };

/** 课程结构分区底部：平台负责人设置大学课程二级分类的可见模式（专业 / 公共课组 / 通识）与关联专业。 */
export async function CategoryAccessPanel({ access }: SubjectSectionExtrasProps) {
  if (access.scope !== "platform" || !access.capabilities.manageContent) return null;

  const supabase = await createClient();
  const [categoriesResult, modesResult, linksResult] = await Promise.all([
    supabase
      .from("course_categories")
      .select("id,title,sort_order")
      .eq("student_app_id", access.appId)
      .not("parent_id", "is", null)
      .order("sort_order"),
    supabase.from("university_category_access").select("category_id,mode"),
    supabase.from("university_category_major_links").select("category_id,major_category_id"),
  ]);
  if (categoriesResult.error || modesResult.error || linksResult.error) {
    return <section className="border bg-[var(--card)] p-4 text-xs" role="alert">专业可见范围暂时无法读取，请稍后刷新页面。</section>;
  }

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const modeById = new Map<string, CategoryAccessMode>();
  for (const row of modesResult.data ?? []) modeById.set(row.category_id as string, row.mode as CategoryAccessMode);
  const modeOf = (id: string): CategoryAccessMode => modeById.get(id) ?? "major";
  const majors = categories.filter((category) => modeOf(category.id) === "major");
  const linksByCategory = new Map<string, Set<string>>();
  for (const row of linksResult.data ?? []) {
    const set = linksByCategory.get(row.category_id as string) ?? new Set<string>();
    set.add(row.major_category_id as string);
    linksByCategory.set(row.category_id as string, set);
  }
  const space = access.tenantSlug ?? "platform";

  return (
    <section className="space-y-3" aria-labelledby="university-access-title">
      <CardTitleWithHint
        headingLevel={2}
        title={<span id="university-access-title">专业可见范围</span>}
        titleClassName="text-sm font-semibold"
        description="大学课程下的每个二级分类可以是“专业”（只有选了该专业的学生可见）、“公共课组”（选了任一关联专业的学生可见，如理工公共课）或“通识”（所有学生可见）。没有设置的分类按“专业”处理。已有学生选择的专业，或已被公共课组关联的专业，不能改成其他模式。"
      />
      {categories.length === 0 ? (
        <div className="app-muted-text border bg-[var(--card)] p-4 text-xs">大学课程下还没有二级分类。</div>
      ) : (
        <ul className="space-y-2">
          {categories.map((category) => {
            const mode = modeOf(category.id);
            const linked = linksByCategory.get(category.id) ?? new Set<string>();
            return (
              <li key={category.id} className="border bg-[var(--card)] p-3 text-xs">
                <form action={setCategoryAccessAction} className="group space-y-2">
                  <input type="hidden" name="space" value={space} />
                  <input type="hidden" name="category_id" value={category.id} />
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-32 font-semibold">{category.title}</span>
                    <select aria-label={`${category.title}的可见模式`} name="mode" defaultValue={mode} className="app-input h-8 border px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                      {CATEGORY_ACCESS_MODES.map((value) => <option key={value} value={value}>{CATEGORY_ACCESS_MODE_LABELS[value]}</option>)}
                    </select>
                    <button aria-label={`保存${category.title}的可见范围`} className="h-8 border border-[var(--border)] px-3 font-semibold hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">保存</button>
                  </div>
                  {/* 只有“公共课组”模式使用关联专业：其他模式下淡化且不响应指针（服务端也会忽略），不需要客户端脚本 */}
                  <fieldset className="pointer-events-none flex flex-wrap items-center gap-3 opacity-45 group-has-[option[value=shared]:checked]:pointer-events-auto group-has-[option[value=shared]:checked]:opacity-100">
                    <legend className="app-muted-text mb-1">关联专业（仅公共课组使用）</legend>
                    {majors.filter((major) => major.id !== category.id).map((major) => (
                      <label key={major.id} className="inline-flex items-center gap-1">
                        <input type="checkbox" name="major_ids" value={major.id} defaultChecked={linked.has(major.id)} />
                        {major.title}
                      </label>
                    ))}
                    {majors.filter((major) => major.id !== category.id).length === 0 ? <span className="app-muted-text">没有可关联的专业</span> : null}
                  </fieldset>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
