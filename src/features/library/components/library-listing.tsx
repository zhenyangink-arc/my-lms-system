import {
  ManagementMetricStrip,
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
import { getLibraryManagementData } from "../api/service";
import { UploadLibraryResourceDialog } from "./library-action-dialogs";
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
    <ManagementPage
      title="资料库管理"
      description={
        result.scope === "platform"
          ? "维护平台标准资料，按课程和课节归档，并跟踪发布状态与下载情况。"
          : "查看机构可用资料，并按当前权限维护课程与课节资源。"
      }
      action={
        result.canCurate ? (
          <UploadLibraryResourceDialog courses={result.courses} />
        ) : undefined
      }
    >
      {result.hasError && (
        <ManagementNotice tone="warning">
          资料、课程或课节数据暂时无法完整读取，请稍后刷新重试。
        </ManagementNotice>
      )}
      {!result.canCurate && (
        <ManagementNotice>
          当前账号为只读查看范围，仅展示已发布资料。
        </ManagementNotice>
      )}

      <ManagementMetricStrip
        label="资料库概况"
        items={[
          {
            label: "资料范围",
            value: result.scope === "platform" ? "平台标准" : "机构可见",
          },
          { label: "资料总数", value: rows.length },
          { label: "已发布", value: publishedCount },
          { label: "草稿", value: draftCount },
          { label: "已归档", value: archivedCount },
          { label: "累计下载", value: downloadCount.toLocaleString("zh-CN") },
        ]}
      />

      <LibraryResourcesTable
        data={rows}
        courseOptions={courseOptions}
        courseTargets={result.courses}
        canCurate={result.canCurate}
      />
    </ManagementPage>
  );
}
