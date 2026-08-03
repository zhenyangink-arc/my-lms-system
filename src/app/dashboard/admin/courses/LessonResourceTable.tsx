import { RotateCcw, Trash2 } from "lucide-react";

import {
  createLessonResourceAction,
  moveLessonResourceToRecycleBinAction,
  permanentlyDeleteLessonResourceAction,
  restoreLessonResourceFromRecycleBinAction,
  setLessonResourcePublishedAction,
  updateLessonResourceAction,
} from "./catalog-actions";
import { LessonResourceSourceField } from "./LessonResourceSourceField";

export type LessonResourceRow = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  resource_url: string | null;
  resource_object_key: string | null;
  original_file_name: string | null;
  is_required: boolean;
  is_published: boolean;
  sort_order: number;
  is_deleted: boolean;
  deleted_at: string | null;
  delete_reason: string | null;
};

const inputClass = "app-input mt-1.5 w-full rounded-[7px] border px-3 py-2.5 text-[12px] outline-none";
const labelClass = "course-editor-field block text-[11px] font-medium";

function ActionButton({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      className={`rounded-[6px] border px-2.5 py-1.5 text-[10px] font-medium ${danger ? "text-red-600" : ""}`}
      style={{ borderColor: "var(--app-border)" }}
    >
      {children}
    </button>
  );
}

export function LessonResourceTable({
  lessonId,
  resources,
  errorMessage,
  canPermanentlyDelete,
}: {
  lessonId: string;
  resources: LessonResourceRow[];
  errorMessage?: string;
  canPermanentlyDelete: boolean;
}) {
  const activeResources = resources.filter((item) => !item.is_deleted);
  const deletedResources = resources.filter((item) => item.is_deleted);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h3 className="text-[12px] font-semibold">课时资料</h3>
          <p className="app-muted-text mt-1 text-[10px]">发布后的资料会出现在学生端当前课时中。</p>
        </div>
        <span className="app-muted-text font-mono text-[10px]">{activeResources.length} ACTIVE / {deletedResources.length} TRASH</span>
      </div>

      {errorMessage && <p className="border-y px-3 py-3 text-[11px] text-red-600">读取资料失败：{errorMessage}</p>}

      <div className="border-y" style={{ borderColor: "var(--app-border)" }}>
        <div className="app-muted-text hidden grid-cols-[minmax(0,1.5fr)_100px_minmax(0,1fr)_80px_70px_120px] gap-3 border-b px-3 py-2 text-[9px] font-medium md:grid" style={{ borderColor: "var(--app-border-soft)" }}>
          <span>资料名称</span><span>类型</span><span>来源</span><span>状态</span><span>排序</span><span className="text-right">操作</span>
        </div>
        {activeResources.map((resource) => (
          <details key={resource.id} className="group border-b last:border-b-0" style={{ borderColor: "var(--app-border-soft)" }}>
            <summary className="grid cursor-pointer list-none gap-2 px-3 py-3 text-[11px] md:grid-cols-[minmax(0,1.5fr)_100px_minmax(0,1fr)_80px_70px_120px] md:items-center md:gap-3">
              <span className="min-w-0 truncate font-medium">{resource.title}{resource.is_required && <small className="ml-2 text-[9px]" style={{ color: "var(--app-warm)" }}>必学</small>}</span>
              <span className="app-muted-text">{resource.resource_type}</span>
              <span className="app-muted-text min-w-0 truncate">{resource.original_file_name ?? resource.resource_url ?? "—"}</span>
              <span className="app-muted-text">{resource.is_published ? "已发布" : "已隐藏"}</span>
              <span className="app-muted-text font-mono">{resource.sort_order}</span>
              <span className="text-right font-medium" style={{ color: "var(--app-accent-strong)" }}>展开编辑</span>
            </summary>
            <div className="border-t px-3 py-4" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-soft-bg)" }}>
              <form action={updateLessonResourceAction.bind(null, resource.id)} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>资料名称<input name="resource_title" required defaultValue={resource.title} className={inputClass} /></label>
                  <label className={labelClass}>排序<input name="resource_sort_order" type="number" min={0} defaultValue={resource.sort_order} className={inputClass} /></label>
                  <label className={`${labelClass} sm:col-span-2`}>说明<textarea name="resource_description" rows={2} defaultValue={resource.description ?? ""} className={`${inputClass} resize-y`} /></label>
                  <LessonResourceSourceField lessonId={lessonId} resource={resource} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="mr-auto flex items-center gap-2 text-[11px] font-medium"><input name="resource_is_required" type="checkbox" defaultChecked={resource.is_required} />必学资料</label>
                  <ActionButton>保存资料</ActionButton>
                </div>
              </form>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--app-border-soft)" }}>
                <form action={setLessonResourcePublishedAction.bind(null, resource.id, !resource.is_published)}><ActionButton>{resource.is_published ? "隐藏资料" : "重新发布"}</ActionButton></form>
                {!resource.is_published && (
                  <form action={moveLessonResourceToRecycleBinAction.bind(null, resource.id)} className="flex min-w-0 flex-1 gap-2">
                    <input name="delete_reason" required placeholder="填写移入回收站的原因" className="app-input min-w-0 flex-1 rounded-[6px] border px-2.5 py-1.5 text-[10px] outline-none" />
                    <ActionButton danger><span className="flex items-center gap-1"><Trash2 size={11} />移入回收站</span></ActionButton>
                  </form>
                )}
              </div>
            </div>
          </details>
        ))}
        {activeResources.length === 0 && <p className="app-muted-text px-5 py-8 text-center text-[11px]">当前课时还没有资料。</p>}
      </div>

      <details className="border-b" style={{ borderColor: "var(--app-border)" }}>
        <summary className="cursor-pointer list-none py-3 text-[11px] font-semibold">＋ 新增课时资料</summary>
        <form action={createLessonResourceAction} className="space-y-3 border-t py-4" style={{ borderColor: "var(--app-border-soft)" }}>
          <input type="hidden" name="lesson_id" value={lessonId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>资料名称<input name="resource_title" required className={inputClass} /></label>
            <label className={labelClass}>排序<input name="resource_sort_order" type="number" min={0} defaultValue={resources.length * 10 + 10} className={inputClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}>说明<textarea name="resource_description" rows={2} className={`${inputClass} resize-y`} /></label>
            <LessonResourceSourceField lessonId={lessonId} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="mr-auto flex items-center gap-2 text-[11px] font-medium"><input name="resource_is_required" type="checkbox" />设为必学资料</label>
            <ActionButton>创建资料</ActionButton>
          </div>
        </form>
      </details>

      {deletedResources.length > 0 && (
        <details className="border-b" style={{ borderColor: "var(--app-border)" }}>
          <summary className="cursor-pointer list-none py-3 text-[11px] font-semibold">资料回收站（{deletedResources.length}）</summary>
          <div className="divide-y border-t" style={{ borderColor: "var(--app-border-soft)" }}>
            {deletedResources.map((resource) => (
              <div key={resource.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="text-[11px] font-medium">{resource.title}</p><p className="app-muted-text mt-1 text-[9px]">{resource.delete_reason || "未填写原因"}</p></div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={restoreLessonResourceFromRecycleBinAction.bind(null, resource.id)}><ActionButton><span className="flex items-center gap-1"><RotateCcw size={11} />恢复为隐藏</span></ActionButton></form>
                  {canPermanentlyDelete && (
                    <form action={permanentlyDeleteLessonResourceAction} className="flex items-center gap-2">
                      <input type="hidden" name="resource_id" value={resource.id} />
                      <input name="delete_confirm" required placeholder="输入 delete" className="app-input w-24 rounded-[6px] border px-2 py-1.5 text-[10px] outline-none" />
                      <ActionButton danger>彻底删除</ActionButton>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
