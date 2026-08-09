import { getLibraryManagementData } from "../api/service";
import { LibraryResourcesTable } from "./library-resources-table";
import type { LibraryResourceDisplayRow } from "./library-resources-table/types";

export default async function LibraryListing() {
  const result = await getLibraryManagementData();
  const lessonById = new Map(
    result.courses
      .filter((course) => course.lesson_id)
      .map((course) => [course.lesson_id as string, course]),
  );
  const courseById = new Map(
    result.courses.map((course) => [course.course_id, course]),
  );
  const rows: LibraryResourceDisplayRow[] = result.resources.map((resource) => {
    const target = resource.lesson_id
      ? lessonById.get(resource.lesson_id)
      : resource.course_id
        ? courseById.get(resource.course_id)
        : undefined;
    const courseLabel = target?.category_label ?? "未识别课程";
    const lessonLabel = resource.lesson_id
      ? (target?.title ?? "未识别课节")
      : "课程公共资料";

    return {
      ...resource,
      courseLabel,
      lessonLabel,
      groupTitle: target?.group_title ?? "未归类课程",
      targetLabel: `${courseLabel}・${lessonLabel}`,
    };
  });
  const courseOptions = Array.from(
    new Map(
      result.courses.map((course) => [
        course.course_id,
        { value: course.course_id, label: course.category_label },
      ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  const publishedCount = rows.filter(
    (resource) => resource.status === "published",
  ).length;
  const draftCount = rows.filter(
    (resource) => resource.status === "draft",
  ).length;
  const archivedCount = rows.filter(
    (resource) => resource.status === "archived",
  ).length;
  const downloadCount = rows.reduce(
    (total, resource) => total + resource.download_count,
    0,
  );

  return (
    <div className="space-y-4">
      {result.hasError && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          资料、课程或课节数据暂时无法完整读取，请稍后刷新重试。
        </p>
      )}
      {!result.canCurate && (
        <p className="border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">
          当前账号为只读查看范围，仅展示已发布资料。
        </p>
      )}

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                <th>资料范围</th>
                <th>资料总数</th>
                <th>已发布</th>
                <th>草稿</th>
                <th>已归档</th>
                <th>累计下载</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{result.scope === "platform" ? "平台资料库" : "机构可见资料"}</th>
                <td>{rows.length}</td>
                <td>{publishedCount}</td>
                <td>{draftCount}</td>
                <td>{archivedCount}</td>
                <td>{downloadCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <LibraryResourcesTable data={rows} courseOptions={courseOptions} />
    </div>
  );
}
