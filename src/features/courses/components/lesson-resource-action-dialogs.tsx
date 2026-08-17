"use client";

import { PencilLine, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  createLessonResourceAction,
  moveLessonResourceToRecycleBinAction,
  permanentlyDeleteLessonResourceAction,
  restoreLessonResourceFromRecycleBinAction,
  setLessonResourcePublishedAction,
  updateLessonResourceAction,
} from "@/app/dashboard/admin/courses/catalog-actions";
import { LessonResourceSourceField } from "@/app/dashboard/admin/courses/LessonResourceSourceField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CourseLessonResource } from "../api/types";

const INPUT_CLASS =
  "app-input mt-1.5 w-full rounded-md border px-3 py-2.5 text-xs outline-none";
const LABEL_CLASS = "block text-[11px] font-medium text-[var(--foreground-secondary)]";

function SubmitButton({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="submit"
      className={danger
        ? "inline-flex h-9 items-center bg-rose-700 px-4 text-xs font-semibold text-white hover:bg-rose-800"
        : "inline-flex h-9 items-center bg-[var(--primary)] px-4 text-xs font-semibold text-white hover:opacity-90"}
    >
      {children}
    </button>
  );
}

function ResourceFields({
  lessonId,
  resource,
  defaultSortOrder,
}: {
  lessonId: string;
  resource?: CourseLessonResource;
  defaultSortOrder?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={LABEL_CLASS}>
        资料名称
        <input name="resource_title" required defaultValue={resource?.title ?? ""} className={INPUT_CLASS} />
      </label>
      <label className={LABEL_CLASS}>
        排序
        <input name="resource_sort_order" type="number" min={0} defaultValue={resource?.sort_order ?? defaultSortOrder ?? 10} className={INPUT_CLASS} />
      </label>
      <label className={`${LABEL_CLASS} sm:col-span-2`}>
        说明
        <textarea name="resource_description" rows={3} defaultValue={resource?.description ?? ""} className={`${INPUT_CLASS} resize-y`} />
      </label>
      <LessonResourceSourceField lessonId={lessonId} resource={resource} />
      <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--foreground-secondary)] sm:col-span-2">
        <input name="resource_is_required" type="checkbox" defaultChecked={resource?.is_required ?? false} />
        设为必学资料
      </label>
    </div>
  );
}

export function CreateLessonResourceDialog({
  lessonId,
  defaultSortOrder,
}: {
  lessonId: string;
  defaultSortOrder: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 bg-[var(--primary)] px-4 text-xs font-semibold text-white hover:opacity-90"><Plus size={13} />新建课时资料</button>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left"><DialogTitle>新建课时资料</DialogTitle><DialogDescription>文件上传与对象键确认继续使用现有 R2 上传链路。</DialogDescription></DialogHeader>
        <form action={createLessonResourceAction} className="space-y-5 p-5">
          <input type="hidden" name="lesson_id" value={lessonId} />
          <ResourceFields lessonId={lessonId} defaultSortOrder={defaultSortOrder} />
          <SubmitButton>创建资料</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditResourceDialog({ resource }: { resource: CourseLessonResource }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 border border-[var(--border)] px-3 text-[11px] font-semibold hover:bg-[var(--surface-soft)]"><PencilLine size={12} />编辑</button>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left"><DialogTitle>编辑“{resource.title}”</DialogTitle><DialogDescription>替换文件时仍先更新数据库，再尝试清理旧 R2 对象；清理失败不会回滚数据库更新。</DialogDescription></DialogHeader>
        <form action={updateLessonResourceAction.bind(null, resource.id)} className="space-y-5 p-5">
          <ResourceFields lessonId={resource.lesson_id} resource={resource} />
          <SubmitButton>保存资料</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecycleDialog({ resource }: { resource: CourseLessonResource }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 border border-rose-200 px-3 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"><Trash2 size={12} />移入回收站</button>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left"><DialogTitle>将资料移入回收站</DialogTitle><DialogDescription>只有已经隐藏的资料才能进入回收站，请填写操作原因。</DialogDescription></DialogHeader>
        <form action={moveLessonResourceToRecycleBinAction.bind(null, resource.id)} className="space-y-4 p-5">
          <label className={LABEL_CLASS}>回收原因<textarea name="delete_reason" required rows={4} placeholder="填写移入回收站的原因" className={`${INPUT_CLASS} resize-y`} /></label>
          <SubmitButton danger>确认移入回收站</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PermanentDeleteDialog({ resource }: { resource: CourseLessonResource }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 border border-rose-300 px-3 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"><Trash2 size={12} />永久删除</button>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left"><DialogTitle>永久删除“{resource.title}”</DialogTitle><DialogDescription>此入口仅平台负责人可见。提交后服务端仍会二次确认资料位于回收站，并在删除数据库记录后尝试清理 R2 对象。</DialogDescription></DialogHeader>
        <form action={permanentlyDeleteLessonResourceAction} className="space-y-4 p-5">
          <input type="hidden" name="resource_id" value={resource.id} />
          <label className={LABEL_CLASS}>输入精确确认词 delete<input name="delete_confirm" required autoComplete="off" placeholder="delete" className={INPUT_CLASS} /></label>
          <p className="text-xs leading-5 text-rose-700">数据库记录删除成功后，即使 R2 对象清理失败也不会恢复记录。</p>
          <SubmitButton danger>确认永久删除</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LessonResourceRowActions({
  resource,
  canManage,
  canPermanentlyDelete,
}: {
  resource: CourseLessonResource;
  canManage: boolean;
  canPermanentlyDelete: boolean;
}) {
  if (!canManage) return null;
  if (resource.is_deleted) {
    return (
      <div className="flex min-w-max justify-end gap-1.5">
        <form action={restoreLessonResourceFromRecycleBinAction.bind(null, resource.id)}><button type="submit" className="inline-flex h-8 items-center gap-1.5 border border-[var(--border)] px-3 text-[11px] font-semibold hover:bg-[var(--surface-soft)]"><RotateCcw size={12} />恢复为隐藏</button></form>
        {canPermanentlyDelete && <PermanentDeleteDialog resource={resource} />}
      </div>
    );
  }
  return (
    <div className="flex min-w-max justify-end gap-1.5">
      <EditResourceDialog resource={resource} />
      <form action={setLessonResourcePublishedAction.bind(null, resource.id, !resource.is_published)}><button type="submit" className="inline-flex h-8 items-center border border-[var(--border)] px-3 text-[11px] font-semibold hover:bg-[var(--surface-soft)]">{resource.is_published ? "隐藏" : "重新发布"}</button></form>
      {!resource.is_published && <RecycleDialog resource={resource} />}
    </div>
  );
}
