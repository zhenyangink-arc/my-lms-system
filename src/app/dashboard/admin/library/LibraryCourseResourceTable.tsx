"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Link2,
  Presentation,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import {
  LIBRARY_CATEGORY_LABELS,
  LIBRARY_RESOURCE_TYPE_LABELS,
  LIBRARY_STATUS_LABELS,
  formatFileSize,
  type LibraryCategory,
  type LibraryResourceType,
  type LibraryStatus,
} from "@/app/dashboard/library/config";
import { LibraryResourceEditDialog } from "./LibraryResourceEditDialog";
import {
  LibraryResourceForm,
  type LibraryCourseOption,
} from "./LibraryResourceForm";
import { LibraryStatusActions } from "./LibraryStatusActions";

export type LibraryCourseRow = LibraryCourseOption & {
  sort_order: number;
  is_published: boolean;
  category_label: string;
  group_title: string;
  group_order: number;
  category_order: number;
};

export type LibraryResourceRow = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  title: string;
  description: string;
  category: LibraryCategory;
  resource_type: LibraryResourceType;
  original_file_name: string | null;
  file_size: number | null;
  status: LibraryStatus;
  is_featured: boolean;
  sort_order: number;
  download_count: number;
  updated_at: string;
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const resourceIcons = {
  document: FileText,
  image: FileImage,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: FolderArchive,
  link: Link2,
};

type CourseStageGroup = {
  key: string;
  label: string;
  courses: LibraryCourseRow[];
};

type CourseDirectoryGroup = {
  title: string;
  stages: CourseStageGroup[];
};

function stageKey(groupTitle: string, categoryLabel: string) {
  return `${groupTitle}::${categoryLabel}`;
}

function buildCourseDirectory(courses: LibraryCourseRow[]) {
  const groups = new Map<string, Map<string, LibraryCourseRow[]>>();
  for (const course of courses) {
    const stages = groups.get(course.group_title) ?? new Map();
    stages.set(course.category_label, [
      ...(stages.get(course.category_label) ?? []),
      course,
    ]);
    groups.set(course.group_title, stages);
  }

  return Array.from(groups.entries()).map<CourseDirectoryGroup>(
    ([title, stages]) => ({
      title,
      stages: Array.from(stages.entries()).map(([label, stageCourses]) => ({
        key: stageKey(title, label),
        label,
        courses: stageCourses,
      })),
    }),
  );
}

function statusColors(status: LibraryStatus) {
  if (status === "published") {
    return {
      color: "var(--app-success)",
      backgroundColor: "var(--app-success-soft)",
    };
  }
  if (status === "archived") {
    return {
      color: "var(--app-warm)",
      backgroundColor: "var(--app-warm-soft)",
    };
  }
  return {
    color: "var(--app-muted)",
    backgroundColor: "var(--app-soft-bg)",
  };
}

export function LibraryCourseResourceTable({
  canCurate,
  courses,
  resources,
}: {
  canCurate: boolean;
  courses: LibraryCourseRow[];
  resources: LibraryResourceRow[];
}) {
  const [query, setQuery] = useState("");
  const [uploadCourse, setUploadCourse] = useState<LibraryCourseRow | null>(
    null,
  );
  const [manageCourse, setManageCourse] = useState<LibraryCourseRow | null>(
    null,
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedStages, setExpandedStages] = useState<Set<string>>(
    () => new Set(),
  );
  const courseOptions = useMemo<LibraryCourseOption[]>(
    () =>
      courses.map(({ id, course_id, lesson_id, title, slug }) => ({
        id,
        course_id,
        lesson_id,
        title,
        slug,
      })),
    [courses],
  );
  const resourcesByCourse = useMemo(() => {
    const grouped = new Map<string, LibraryResourceRow[]>();
    for (const resource of resources) {
      const targetId = resource.lesson_id ?? resource.course_id;
      if (!targetId) continue;
      grouped.set(targetId, [
        ...(grouped.get(targetId) ?? []),
        resource,
      ]);
    }
    return grouped;
  }, [resources]);
  const visibleCourses = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return courses;
    return courses.filter((course) =>
      `${course.title} ${course.slug} ${course.category_label} ${course.group_title}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [courses, query]);
  const fullDirectory = useMemo(() => buildCourseDirectory(courses), [courses]);
  const visibleDirectory = useMemo(
    () => buildCourseDirectory(visibleCourses),
    [visibleCourses],
  );
  const allGroupTitles = useMemo(
    () => fullDirectory.map((group) => group.title),
    [fullDirectory],
  );
  const allStageKeys = useMemo(
    () => fullDirectory.flatMap((group) => group.stages.map((stage) => stage.key)),
    [fullDirectory],
  );
  const isSearching = query.trim().length > 0;
  const isEverythingExpanded =
    allGroupTitles.length > 0 &&
    allGroupTitles.every((title) => expandedGroups.has(title)) &&
    allStageKeys.every((key) => expandedStages.has(key));

  function toggleGroup(groupTitle: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupTitle)) next.delete(groupTitle);
      else next.add(groupTitle);
      return next;
    });
  }

  function toggleStage(key: string) {
    setExpandedStages((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (isEverythingExpanded) {
      setExpandedGroups(new Set());
      setExpandedStages(new Set());
      return;
    }
    setExpandedGroups(new Set(allGroupTitles));
    setExpandedStages(new Set(allStageKeys));
  }

  return (
    <>
      <section className="app-card overflow-hidden rounded-2xl border">
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div>
            <h2 className="text-sm font-black">全部课程</h2>
            <p className="app-muted-text mt-1 text-[10px]">
              在课程行直接上传；已有资料通过“管理资料”集中查看。
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              onClick={toggleAll}
              className="app-soft-card inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black"
            >
              <ChevronsUpDown size={12} />
              {isEverythingExpanded ? "全部收起" : "全部展开"}
            </button>
            <label className="app-input flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border px-3 py-2 sm:w-[300px]">
              <Search size={13} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索课程或目录"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr
                className="app-muted-text border-b bg-[var(--app-soft-bg)] text-[10px]"
                style={{ borderColor: "var(--app-border)" }}
              >
                <th className="w-[39%] px-5 py-2.5 font-black">课程</th>
                <th className="w-[18%] px-3 py-2.5 font-black">资料</th>
                <th className="w-[19%] px-3 py-2.5 font-black">最近更新</th>
                <th className="w-[24%] px-5 py-2.5 text-right font-black">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleDirectory.map((group) => (
                <CourseGroupRows
                  key={group.title}
                  canCurate={canCurate}
                  group={group}
                  groupExpanded={isSearching || expandedGroups.has(group.title)}
                  isSearching={isSearching}
                  expandedStages={expandedStages}
                  resourcesByCourse={resourcesByCourse}
                  onToggleGroup={() => toggleGroup(group.title)}
                  onToggleStage={toggleStage}
                  onManage={setManageCourse}
                  onUpload={setUploadCourse}
                />
              ))}

              {visibleCourses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center">
                    <Archive className="mx-auto opacity-30" size={28} />
                    <p className="mt-3 text-xs font-black">没有匹配的课程</p>
                    <p className="app-muted-text mt-1 text-[10px]">
                      更换课程名称或目录关键词后重试。
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {manageCourse && (
        <CourseResourceDialog
          canCurate={canCurate}
          course={manageCourse}
          courses={courseOptions}
          resources={resourcesByCourse.get(manageCourse.id) ?? []}
          onClose={() => setManageCourse(null)}
          onUpload={() => {
            setManageCourse(null);
            setUploadCourse(manageCourse);
          }}
        />
      )}

      {uploadCourse && (
        <UploadResourceDialog
          course={uploadCourse}
          courses={courseOptions}
          onClose={() => setUploadCourse(null)}
        />
      )}
    </>
  );
}

function CourseGroupRows({
  canCurate,
  group,
  groupExpanded,
  isSearching,
  expandedStages,
  resourcesByCourse,
  onToggleGroup,
  onToggleStage,
  onManage,
  onUpload,
}: {
  canCurate: boolean;
  group: CourseDirectoryGroup;
  groupExpanded: boolean;
  isSearching: boolean;
  expandedStages: Set<string>;
  resourcesByCourse: Map<string, LibraryResourceRow[]>;
  onToggleGroup: () => void;
  onToggleStage: (key: string) => void;
  onManage: (course: LibraryCourseRow) => void;
  onUpload: (course: LibraryCourseRow) => void;
}) {
  const courseCount = group.stages.reduce(
    (total, stage) => total + stage.courses.length,
    0,
  );

  return (
    <Fragment key={group.title}>
      <tr
        className="border-b"
        style={{
          color: "var(--app-secondary)",
          borderColor: "var(--app-border)",
          backgroundColor: "var(--app-secondary-soft)",
        }}
      >
        <th colSpan={4} className="p-0">
          <button
            type="button"
            onClick={onToggleGroup}
            className="flex w-full items-center gap-2 px-5 py-3 text-left text-[11px] font-black"
            aria-expanded={groupExpanded}
          >
            {groupExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            <span>{group.title}</span>
            <span className="rounded-full bg-white/65 px-2 py-0.5 text-[9px] opacity-80">
              {group.stages.length} 个阶段 · {courseCount} 门课程
            </span>
          </button>
        </th>
      </tr>
      {groupExpanded &&
        group.stages.map((stage) => {
          const stageExpanded = isSearching || expandedStages.has(stage.key);
          return (
            <Fragment key={stage.key}>
              <tr
                className="border-b"
                style={{
                  color: "var(--app-foreground)",
                  borderColor: "var(--app-border-soft)",
                  backgroundColor: "var(--app-accent-soft)",
                }}
              >
                <th colSpan={4} className="p-0">
                  <button
                    type="button"
                    onClick={() => onToggleStage(stage.key)}
                    className="flex w-full items-center gap-2 py-2.5 pl-10 pr-5 text-left text-[10px] font-black"
                    aria-expanded={stageExpanded}
                  >
                    {stageExpanded ? (
                      <ChevronDown size={13} />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                    <span>{stage.label}</span>
                    <span className="app-muted-text rounded-full bg-white/70 px-2 py-0.5 text-[9px]">
                      {stage.courses.length} 门课程
                    </span>
                  </button>
                </th>
              </tr>
              {stageExpanded &&
                stage.courses.map((course) => (
                  <CourseTableRow
                    key={course.id}
                    canCurate={canCurate}
                    course={course}
                    resources={resourcesByCourse.get(course.id) ?? []}
                    onManage={() => onManage(course)}
                    onUpload={() => onUpload(course)}
                  />
                ))}
            </Fragment>
          );
        })}
    </Fragment>
  );
}

function CourseTableRow({
  canCurate,
  course,
  resources,
  onManage,
  onUpload,
}: {
  canCurate: boolean;
  course: LibraryCourseRow;
  resources: LibraryResourceRow[];
  onManage: () => void;
  onUpload: () => void;
}) {
  const publishedCount = resources.filter(
    (resource) => resource.status === "published",
  ).length;
  const newestResource = [...resources].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() -
      new Date(left.updated_at).getTime(),
  )[0];

  return (
    <tr
      className="border-b text-[11px] last:border-b-0"
      style={{ borderColor: "var(--app-border-soft)" }}
    >
      <td className="py-3 pl-14 pr-5">
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-1 shrink-0 rounded-full"
            style={{
              backgroundColor: course.is_published
                ? "var(--app-success)"
                : "var(--app-warm)",
            }}
          />
          <div className="min-w-0">
            <p className="truncate font-black">{course.title}</p>
            <p className="app-muted-text mt-1 text-[9px]">
              {course.category_label} · {course.is_published ? "已发布" : "草稿"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-[10px]">
        <span className="font-mono font-black">{resources.length}</span>
        <span className="app-muted-text ml-1">项</span>
        <span className="app-muted-text ml-2">已发布 {publishedCount}</span>
      </td>
      <td className="app-muted-text px-3 py-3 text-[10px]">
        {newestResource
          ? dateFormatter.format(new Date(newestResource.updated_at))
          : "暂无资料"}
      </td>
      <td className="px-5 py-3">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onManage}
            className="app-soft-card rounded-lg border px-3 py-2 text-[10px] font-black"
          >
            {canCurate ? "管理资料" : "查看资料"}
          </button>
          {canCurate && (
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black text-white"
              style={{ backgroundColor: "var(--app-accent)" }}
            >
              <Upload size={11} />
              上传资料
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function CourseResourceDialog({
  canCurate,
  course,
  courses,
  resources,
  onClose,
  onUpload,
}: {
  canCurate: boolean;
  course: LibraryCourseRow;
  courses: LibraryCourseOption[];
  resources: LibraryResourceRow[];
  onClose: () => void;
  onUpload: () => void;
}) {
  return (
    <ModalShell
      title={`${course.title} · ${canCurate ? "资料管理" : "资料查看"}`}
      description={`${course.group_title} / ${course.category_label} · ${resources.length} 项资料`}
      onClose={onClose}
      action={
        canCurate ? (
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black text-white"
            style={{ backgroundColor: "var(--app-accent)" }}
          >
            <Upload size={11} />
            上传资料
          </button>
        ) : null
      }
    >
      <ResourceSubtable
        canCurate={canCurate}
        course={course}
        courses={courses}
        resources={resources}
      />
    </ModalShell>
  );
}

function UploadResourceDialog({
  course,
  courses,
  onClose,
}: {
  course: LibraryCourseRow;
  courses: LibraryCourseOption[];
  onClose: () => void;
}) {
  return (
    <ModalShell
      title={`${course.title} · 上传资料`}
      description={`${course.group_title} / ${course.category_label}，课程已自动锁定。`}
      onClose={onClose}
    >
      <LibraryResourceForm courses={courses} lockedCourse={course} />
    </ModalShell>
  );
}

function ModalShell({
  action,
  children,
  description,
  onClose,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="app-card max-h-[92vh] w-full max-w-[1120px] overflow-y-auto rounded-2xl border p-5 shadow-2xl">
        <div
          className="mb-4 flex items-center justify-between gap-4 border-b pb-4"
          style={{ borderColor: "var(--app-border-soft)" }}
        >
          <div className="min-w-0">
            <h3 className="truncate text-base font-black">{title}</h3>
            <p className="app-muted-text mt-1 text-[10px]">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <button
              type="button"
              onClick={onClose}
              className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border"
              aria-label="关闭窗口"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        {children}
      </section>
    </div>
  );
}

function ResourceSubtable({
  canCurate,
  course,
  courses,
  resources,
}: {
  canCurate: boolean;
  course: LibraryCourseOption;
  courses: LibraryCourseOption[];
  resources: LibraryResourceRow[];
}) {
  if (resources.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-[var(--app-soft-bg)] px-4 py-12 text-center">
        <p className="text-xs font-black">本课程还没有资料</p>
        <p className="app-muted-text mt-1 text-[10px]">
          {canCurate
            ? "点击窗口右上角的“上传资料”即可添加。"
            : "平台上传并发布后，资料会显示在这里。"}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[1040px] border-collapse text-left">
        <thead>
          <tr
            className="app-muted-text border-b bg-[var(--app-soft-bg)] text-[9px]"
            style={{ borderColor: "var(--app-border-soft)" }}
          >
            <th className="w-[31%] px-4 py-2.5 font-black">资料</th>
            <th className="w-[13%] px-3 py-2.5 font-black">分类 / 类型</th>
            <th className="w-[18%] px-3 py-2.5 font-black">文件信息</th>
            <th className="w-[9%] px-3 py-2.5 font-black">状态</th>
            <th className="w-[8%] px-3 py-2.5 text-center font-black">获取</th>
            <th className="w-[21%] px-4 py-2.5 text-right font-black">操作</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const ResourceIcon = resourceIcons[resource.resource_type];
            return (
              <tr
                key={resource.id}
                className="border-b align-top text-[10px] last:border-b-0"
                style={{ borderColor: "var(--app-border-soft)" }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        color: "var(--app-accent)",
                        backgroundColor: "var(--app-accent-soft)",
                      }}
                    >
                      <ResourceIcon size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate font-black">
                        {resource.title}
                        {resource.is_featured && (
                          <Sparkles
                            className="shrink-0"
                            size={10}
                            style={{ color: "var(--app-warm)" }}
                          />
                        )}
                      </p>
                      <p className="app-muted-text mt-1 line-clamp-2 text-[9px] leading-4">
                        {resource.description || "暂无资料说明"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 leading-5">
                  <p className="font-black">
                    {LIBRARY_CATEGORY_LABELS[resource.category]}
                  </p>
                  <p className="app-muted-text">
                    {LIBRARY_RESOURCE_TYPE_LABELS[resource.resource_type]}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p className="max-w-[190px] truncate font-bold">
                    {resource.original_file_name || "外部链接"}
                  </p>
                  <p className="app-muted-text mt-1 text-[9px]">
                    {formatFileSize(resource.file_size)}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <span
                    className="inline-flex rounded-full px-2 py-1 text-[9px] font-black"
                    style={statusColors(resource.status)}
                  >
                    {LIBRARY_STATUS_LABELS[resource.status]}
                  </span>
                </td>
                <td className="px-3 py-3 text-center font-mono font-black">
                  {resource.download_count}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <a
                      href={`/api/library/${resource.id}/download?mode=view`}
                      target="_blank"
                      rel="noreferrer"
                      className="app-soft-card inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 font-black"
                    >
                      <Eye size={10} />
                      查看
                    </a>
                    <a
                      href={`/api/library/${resource.id}/download`}
                      className="app-soft-card inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 font-black"
                    >
                      <Download size={10} />
                      下载
                    </a>
                    {canCurate && (
                      <LibraryResourceEditDialog
                        course={course}
                        courses={courses}
                        resource={resource}
                      />
                    )}
                  </div>
                  {canCurate && (
                    <div className="mt-2 flex justify-end">
                      <LibraryStatusActions
                        id={resource.id}
                        status={resource.status}
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
