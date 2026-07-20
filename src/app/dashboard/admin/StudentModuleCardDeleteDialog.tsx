"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, TriangleAlert } from "lucide-react";

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

export type ModuleCardDeleteState = {
  status: "idle" | "error";
  message: string;
};

export const initialModuleCardDeleteState: ModuleCardDeleteState = {
  status: "idle",
  message: "",
};

type DeleteAction = (
  previousState: ModuleCardDeleteState,
  formData: FormData
) => Promise<ModuleCardDeleteState>;

function ConfirmDeleteButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <AlertDialogAction
      type="submit"
      disabled={pending}
      className="gap-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
    >
      <Trash2 size={14} />
      {pending ? "正在删除…" : label}
    </AlertDialogAction>
  );
}

export function StudentModuleCardDeleteDialog({
  action,
  studentName,
  cardLabel,
  description,
}: {
  action: DeleteAction;
  studentName: string;
  cardLabel: string;
  description: string;
}) {
  const [state, formAction] = useActionState(action, initialModuleCardDeleteState);

  return (
    <AlertDialog>
      <AlertDialogTrigger
        type="button"
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
      >
        <Trash2 size={13} />删除{cardLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <TriangleAlert size={21} />
          </span>
          <AlertDialogTitle className="font-black text-red-700">
            删除 {studentName} 的{cardLabel}？
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            {description} 学生账号、目标大学、课程和其他业务数据不会被删除。此操作无法恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          {state.status === "error" && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
              {state.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">取消</AlertDialogCancel>
            <ConfirmDeleteButton label={`确认删除${cardLabel}`} />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
