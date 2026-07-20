"use client";

import { useFormStatus } from "react-dom";
import { Lock, MessageSquarePlus, Trash2, Unlock } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  deleteApplicationChecklistItemAction,
  toggleApplicationChecklistItemLockAction,
  updateApplicationChecklistItemNoteAction,
} from "./actions";

function SaveNoteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-60"
      style={{ backgroundColor: "var(--app-accent)" }}
    >
      {pending ? "保存中…" : "保存备注"}
    </button>
  );
}

function NoteEditDialog({
  studentId,
  documentId,
  title,
  adminNote,
  locked,
}: {
  studentId: string;
  documentId: string;
  title: string;
  adminNote: string | null;
  locked: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        disabled={locked}
        title={locked ? "已锁定，请先解锁再修改" : undefined}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
        style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}
      >
        <MessageSquarePlus size={12} />修改
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black">给「{title}」写管理员备注</DialogTitle>
          <DialogDescription className="leading-6">
            管理员备注会显示在学生这项资料卡片下方，用于反馈修改要求或说明情况。
          </DialogDescription>
        </DialogHeader>
        <form action={updateApplicationChecklistItemNoteAction.bind(null, studentId, documentId)} className="space-y-4">
          <label className="block text-xs font-black">
            管理员备注（学生可见）
            <textarea
              name="adminNote"
              maxLength={300}
              rows={5}
              defaultValue={adminNote ?? ""}
              placeholder="例如：护照复印件不清晰，请重新上传扫描件。"
              className="app-input mt-2 w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6 outline-none"
            />
          </label>
          <div className="flex justify-end">
            <SaveNoteButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LockToggleButton({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black disabled:opacity-60"
      style={
        locked
          ? { color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }
          : { color: "var(--app-muted)", backgroundColor: "var(--app-soft-bg)" }
      }
    >
      {locked ? <Unlock size={12} /> : <Lock size={12} />}
      {pending ? "处理中…" : locked ? "解锁" : "锁定"}
    </button>
  );
}

function DeleteConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <AlertDialogAction
      type="submit"
      disabled={pending}
      className="gap-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
    >
      <Trash2 size={14} />
      {pending ? "删除中…" : "确认删除"}
    </AlertDialogAction>
  );
}

export function DeleteChecklistItemButton({
  studentId,
  documentId,
  title,
  locked,
}: {
  studentId: string;
  documentId: string;
  title: string;
  locked: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        type="button"
        disabled={locked}
        title={locked ? "已锁定，请先解锁再删除" : undefined}
        className="inline-flex items-center gap-1 text-xs font-black text-red-600 disabled:cursor-not-allowed disabled:text-red-300"
      >
        <Trash2 size={11} />删除项目
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-black text-red-700">删除「{title}」？</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            这项资料会从学生的申请资料清单中移除，学生端也会同步消失。此操作无法恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">取消</AlertDialogCancel>
          <form action={deleteApplicationChecklistItemAction.bind(null, studentId, documentId)}>
            <DeleteConfirmButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DocumentItemControls({
  studentId,
  documentId,
  title,
  adminNote,
  locked,
}: {
  studentId: string;
  documentId: string;
  title: string;
  adminNote: string | null;
  locked: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <NoteEditDialog studentId={studentId} documentId={documentId} title={title} adminNote={adminNote} locked={locked} />
      <form action={toggleApplicationChecklistItemLockAction.bind(null, studentId, documentId, !locked)}>
        <LockToggleButton locked={locked} />
      </form>
    </div>
  );
}
