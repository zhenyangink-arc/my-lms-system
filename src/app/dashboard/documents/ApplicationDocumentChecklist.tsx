"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FolderOpen,
  Lock,
  MessageSquarePlus,
  MessageSquareText,
  MinusCircle,
  Save,
  UploadCloud,
} from "lucide-react";

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

import { ApplicationDocumentForm } from "./ApplicationDocumentForm";
import { saveApplicationDocumentDraftAction, submitApplicationDocumentsAction } from "./actions";
import { initialDocumentActionState } from "./document-action-state";
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_LABELS, STATUS_TONES } from "./constants";

type Status = "preparing" | "completed" | "not_needed";
type DueMeta = { label: string; color: string; soft: string } | null;

type ChecklistDocument = {
  id: string;
  title: string;
  status: Status;
  notes: string | null;
  admin_note: string | null;
  dueMeta: DueMeta;
  admin_locked_at: string | null;
};

type CategoryGroup = {
  category: string;
  items: ChecklistDocument[];
};

function SaveButton({
  disabled,
  pending,
  onClick,
}: {
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
      style={{ backgroundColor: "var(--app-secondary)" }}
    >
      <Save size={14} />
      {pending ? "保存中…" : "保存"}
    </button>
  );
}

function SubmitConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <AlertDialogAction
      type="submit"
      disabled={pending}
      className="gap-2 text-white disabled:opacity-60"
      style={{ backgroundColor: "var(--app-success)" }}
    >
      <UploadCloud size={14} />
      {pending ? "提交中…" : "确认上传"}
    </AlertDialogAction>
  );
}

export function ApplicationDocumentChecklist({
  targetId,
  locked,
  categoryGroups,
}: {
  targetId: string;
  locked: boolean;
  categoryGroups: CategoryGroup[];
}) {
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const [isSaving, startSaveTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const effectiveGroups = useMemo(
    () =>
      categoryGroups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({ ...item, status: overrides[item.id] ?? item.status })),
      })),
    [categoryGroups, overrides]
  );

  const hasUnsavedChanges = Object.keys(overrides).length > 0;
  const allResolved = effectiveGroups.every((group) =>
    group.items.every((item) => item.admin_locked_at !== null || item.status === "completed" || item.status === "not_needed")
  );

  function handleStatusChange(document: ChecklistDocument, status: Status) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (status === document.status) {
        delete next[document.id];
      } else {
        next[document.id] = status;
      }
      return next;
    });
  }

  function handleSave() {
    const changes = Object.entries(overrides).map(([documentId, status]) => ({ documentId, status }));
    startSaveTransition(async () => {
      const result = await saveApplicationDocumentDraftAction(changes);
      if (result.status === "error") {
        setSaveError(result.message);
        return;
      }
      setSaveError(null);
      setOverrides({});
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition hover:-translate-y-0.5"
          style={{ color: "var(--app-accent)", borderColor: "var(--app-accent)" }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "收起全部分类" : "展开全部分类"}
        </button>
      </div>

      {!expanded && (
        <p className="app-muted-text text-xs">已收起全部分类，点击「展开全部分类」查看具体资料项目。</p>
      )}

      {expanded && effectiveGroups.map(({ category, items }) => {
        const CategoryIcon = CATEGORY_ICONS[category] ?? FolderOpen;
        const doneCount = items.filter((item) => item.status !== "preparing").length;
        return (
          <div key={category}>
            <div className="mb-3 flex items-center justify-between gap-3 border-b pb-2.5" style={{ borderColor: "var(--app-border-soft)" }}>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
                  <CategoryIcon size={14} />
                </span>
                <h3 className="text-sm font-black">{CATEGORY_LABELS[category] ?? category}</h3>
              </div>
              <span className="app-muted-text text-xs font-bold">{doneCount}/{items.length} 已处理</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((document) => {
                const tone = STATUS_TONES[document.status] ?? STATUS_TONES.preparing;
                const StatusIcon =
                  document.status === "completed" ? CheckCircle2 : document.status === "not_needed" ? MinusCircle : Clock3;
                const itemLocked = document.admin_locked_at !== null;
                const isDirty = document.id in overrides;
                return (
                  <article
                    key={document.id}
                    className="app-soft-card rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--app-shadow)]"
                    style={document.status === "not_needed" ? { opacity: 0.7 } : undefined}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: tone.color, backgroundColor: tone.soft }}>
                        <StatusIcon size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black">{document.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>
                            {STATUS_LABELS[document.status] ?? document.status}
                          </span>
                          {isDirty && (
                            <span className="rounded-full px-2.5 py-0.5 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>
                              未保存
                            </span>
                          )}
                          {itemLocked && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}>
                              <Lock size={10} />
                              管理员已锁定
                            </span>
                          )}
                          {document.dueMeta && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black" style={{ color: document.dueMeta.color, backgroundColor: document.dueMeta.soft }}>
                              <CalendarClock size={11} />
                              {document.dueMeta.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {document.notes && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-5" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>
                        <MessageSquareText className="mt-0.5 shrink-0" size={14} />
                        <p className="whitespace-pre-wrap">
                          <b>资料备注：</b>
                          {document.notes}
                        </p>
                      </div>
                    )}

                    {document.admin_note && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-5" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}>
                        <MessageSquarePlus className="mt-0.5 shrink-0" size={14} />
                        <p className="whitespace-pre-wrap">
                          <b>管理员备注：</b>
                          {document.admin_note}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--app-border-soft)" }}>
                      <ApplicationDocumentForm
                        currentStatus={document.status}
                        disabled={locked || itemLocked || isSaving}
                        onChange={(status) => handleStatusChange(document, status)}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex flex-col items-center gap-3 rounded-2xl border p-4 sm:flex-row sm:justify-between" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-soft-bg)" }}>
        <div className="app-muted-text flex flex-col gap-1 text-xs font-bold">
          <p className="flex items-center gap-1.5">
            {locked && <Lock size={13} style={{ color: "var(--app-warm)" }} />}
            {locked
              ? "申请资料已上传提交，页面已锁定，仅供查看。如需修改，请联系管理员协助解锁。"
              : hasUnsavedChanges
                ? "有未保存的修改，请先点击「保存」。"
                : allResolved
                  ? "所有材料状态都已选择并保存，点击「上传」正式提交并锁定该申请表。"
                  : "还有材料未标记为「已完成」或「无」，全部处理并保存后可以上传提交。"}
          </p>
          {saveError && <p className="font-bold text-rose-600">{saveError}</p>}
          {submitError && <p className="font-bold text-rose-600">{submitError}</p>}
        </div>
        {!locked && (
          <div className="flex shrink-0 items-center gap-2">
            <SaveButton disabled={!hasUnsavedChanges} pending={isSaving} onClick={handleSave} />
            <AlertDialog>
              <AlertDialogTrigger
                type="button"
                disabled={hasUnsavedChanges || !allResolved}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                style={{ backgroundColor: "var(--app-success)" }}
              >
                <UploadCloud size={14} />
                上传
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-black">确认上传申请资料？</AlertDialogTitle>
                  <AlertDialogDescription className="leading-6">
                    提交后这份申请表会立即锁定，无法自行修改；如果之后需要调整，请联系管理员协助解锁。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel type="button">取消</AlertDialogCancel>
                  <form
                    action={async (formData: FormData) => {
                      const result = await submitApplicationDocumentsAction(targetId, initialDocumentActionState, formData);
                      if (result && result.status === "error") {
                        setSubmitError(result.message);
                      }
                    }}
                  >
                    <SubmitConfirmButton />
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}
