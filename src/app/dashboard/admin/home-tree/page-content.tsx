import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import type { CourseTreePayload } from "@/app/dashboard/CourseListDialog";
import { HomeTreeBulkActions } from "./HomeTreeBulkActions";
import { HomeTreeTable, type HomeTreeNode } from "./HomeTreeTable";
import { HomeTreeViewTabs } from "./HomeTreeViewTabs";

type CategoryRow = {
  id: string;
  parent_id: string | null;
  title: string;
  sort_order: number | null;
};

type CourseRow = {
  id: string;
  category_id: string | null;
  title: string;
};

type ViewRow = {
  slug: string;
  title: string;
  is_enabled: boolean;
};

type ViewItemRow = {
  entity_type: "category" | "course";
  entity_id: string;
};

export default async function HomeTreePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const requestedView = (params.view ?? "").trim();

  const [{ data: categories }, { data: courses }, { data: views }] =
    await Promise.all([
      supabase
        .from("course_categories")
        .select("id, parent_id, title, sort_order")
        .eq("content_scope", "platform")
        .order("sort_order", { ascending: true }),
      supabase
        .from("courses")
        .select("id, category_id, title")
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("course_tree_views")
        .select("slug, title, is_enabled")
        .order("sort_order", { ascending: true }),
    ]);

  const viewList = (views ?? []) as ViewRow[];
  const activeView = viewList.some((v) => v.slug === requestedView)
    ? requestedView
    : (viewList[0]?.slug ?? "home");

  // 当前视图下展示的分类/课程集合（"type:id" → true）
  const viewItemSet = new Set<string>();
  if (activeView) {
    const { data: viewItems } = await supabase
      .from("course_tree_view_items")
      .select("entity_type, entity_id")
      .eq("view_slug", activeView);
    for (const item of (viewItems ?? []) as ViewItemRow[]) {
      viewItemSet.add(`${item.entity_type}:${item.entity_id}`);
    }
  }

  // 课时 + 章节（章节表 RLS 只对题库管理员开放，用 admin 客户端查询）
  const admin = createAdminClient();
  const [{ data: lessonsData }, { data: chaptersData }] = await Promise.all([
    admin
      .from("lessons")
      .select("id, course_id, title, sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("chapter_tests")
      .select("slug, lesson_id, chapter_number, title")
      .order("chapter_number", { ascending: true }),
  ]);

  const parents = (categories ?? []).filter(
    (cat) => !cat.parent_id
  ) as CategoryRow[];
  const subcategories = (categories ?? []).filter(
    (cat) => cat.parent_id
  ) as CategoryRow[];
  const courseRows = (courses ?? []) as CourseRow[];

  const shown = (table: "category" | "course", id: string) =>
    viewItemSet.has(`${table}:${id}`);

  // 当前视图的课程树预览 payload（只包含已开启的分类/课程分支，与学生端一致）
  function groupsToTreePayload(groups: HomeTreeNode[]): CourseTreePayload {
    const nodes: CourseTreePayload["nodes"] = [];
    const edges: CourseTreePayload["edges"] = [];
    let counter = 0;
    const nextId = () => `tree-preview-node-${counter++}`;
    function visit(list: HomeTreeNode[], parentId?: string) {
      for (const node of list) {
        // 分类/课程未开启 → 整棵子树不显示；课时/章节跟随课程
        if (
          (node.kind === "分类" || node.kind === "课程") &&
          !node.show
        ) {
          continue;
        }
        const id = nextId();
        nodes.push({
          id,
          label: node.label,
          kind:
            node.kind === "分类"
              ? "category"
              : node.kind === "课程"
                ? "course"
                : node.kind === "课时"
                  ? "lesson"
                  : "chapter",
        });
        if (parentId) {
          edges.push({ id: nextId(), source: parentId, target: id });
        }
        visit(node.children, id);
      }
    }
    visit(groups);
    return { nodes, edges };
  }

  // 嵌套树：父分类 → 子分类 → 课程 → 课时 → 章节（每一层都可折叠）
  const groups: HomeTreeNode[] = parents.map((parent) => ({
    id: parent.id,
    table: "course_categories",
    label: parent.title,
    kind: "分类",
    show: shown("category", parent.id),
    children: subcategories
      .filter((sub) => sub.parent_id === parent.id)
      .map((sub) => ({
        id: sub.id,
        table: "course_categories",
        label: sub.title,
        kind: "分类",
        show: shown("category", sub.id),
        children: courseRows
          .filter((course) => course.category_id === sub.id)
          .map((course) => ({
            id: course.id,
            table: "courses",
            label: course.title,
            kind: "课程",
            show: shown("course", course.id),
            children: (lessonsData ?? [])
              .filter((lesson) => String(lesson.course_id) === course.id)
              .map((lesson) => ({
                id: String(lesson.id),
                table: null,
                label: String(lesson.title),
                kind: "课时",
                show: false,
                children: (chaptersData ?? [])
                  .filter(
                    (chapter) =>
                      String(chapter.lesson_id) === String(lesson.id)
                  )
                  .map((chapter) => ({
                    id: `chapter-${chapter.slug}`,
                    table: null,
                    label: `第 ${chapter.chapter_number ?? ""} 章：${chapter.title}`,
                    kind: "章节",
                    show: false,
                    children: [],
                  })),
              })),
          })),
      })),
  }));

  const treePreviewPayload = groupsToTreePayload(groups);

  return (
    <div className="w-full px-4 py-8">
      {/* 头部：极简标题 + 说明 + 批量操作 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">课程树管理</h2>
        </div>
        <HomeTreeBulkActions viewSlug={activeView} />
      </div>

      {/* 视图切换：点击弹对话框预览该视图的课程树 */}
      {viewList.length > 0 && (
        <div className="mt-5">
          <HomeTreeViewTabs
            views={viewList}
            active={activeView}
            tree={treePreviewPayload}
          />
        </div>
      )}

      {/* Linear / Vercel 风格表格：三列表头可排序 */}
      <div className="mt-4">
        {groups.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[13px] font-medium">还没有平台课程分类</p>
            <p className="app-muted-text mt-1 text-xs">
              先在“内容系统 / 平台课程”里创建分类和课程
            </p>
          </div>
        ) : (
          <HomeTreeTable groups={groups} viewSlug={activeView} />
        )}
      </div>
    </div>
  );
}
