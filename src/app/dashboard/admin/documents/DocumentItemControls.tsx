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
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-zinc-950 px-3 text-[10px] font-medium text-white disabled:opacity-60"
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
        className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <MessageSquarePlus size={12} />修改
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden rounded-lg border-black/10 bg-white p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b border-black/[0.08] px-5 py-4 text-left">
          <DialogTitle className="text-sm font-semibold">编辑管理员备注</DialogTitle>
          <DialogDescription className="text-[10px] leading-5">
            管理员备注会显示在学生这项资料卡片下方，用于反馈修改要求或说明情况。
          </DialogDescription>
        </DialogHeader>
        <form action={updateApplicationChecklistItemNoteAction.bind(null, studentId, documentId)}>
          <table className="w-full border-collapse text-left text-[11px]"><tbody><tr className="border-b border-black/[0.07]"><th className="w-[120px] border-r border-black/[0.07] bg-zinc-50/50 px-4 py-3 align-top text-[9px] font-medium uppercase tracking-[0.06em] text-zinc-500">资料项目</th><td className="px-4 py-3 font-medium text-zinc-900">{title}</td></tr><tr><th className="border-r border-black/[0.07] bg-zinc-50/50 px-4 py-3 align-top text-[9px] font-medium uppercase tracking-[0.06em] text-zinc-500">学生可见备注</th><td className="p-3"><textarea name="adminNote" maxLength={300} rows={5} defaultValue={adminNote ?? ""} placeholder="例如：证明内容不清晰，请重新准备。" className="w-full resize-y rounded-md border border-black/10 bg-white px-3 py-2.5 text-[11px] leading-5 outline-none focus:border-black/25" /></td></tr></tbody></table>
          <div className="flex justify-end border-t border-black/[0.08] px-5 py-3">
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
      className={`inline-flex items-center gap-1 text-[10px] font-medium disabled:opacity-50 ${locked ? "text-amber-700 hover:text-amber-900" : "text-zinc-500 hover:text-zinc-950"}`}
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
        className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 disabled:cursor-not-allowed disabled:text-rose-300"
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
