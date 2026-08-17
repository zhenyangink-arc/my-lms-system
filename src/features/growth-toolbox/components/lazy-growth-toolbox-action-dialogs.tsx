"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type {
  GrowthToolboxGrammarItem,
  GrowthToolboxItem,
  GrowthToolboxVocabularyItem,
} from "../api/types";

export type GrowthToolboxCourseOption = { id: string; title: string };

function DialogLoadingPlaceholder() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-64 w-full max-w-2xl animate-pulse rounded-xl bg-[var(--card)] shadow-xl" />
      <span className="sr-only">正在加载编辑器…</span>
    </div>
  );
}

const EditToolboxItemDialogImplementation = dynamic(
  () =>
    import("./growth-toolbox-action-dialogs").then(
      (module) => module.EditToolboxItemDialog,
    ),
  { loading: DialogLoadingPlaceholder },
);
const CreateVocabularyDialogImplementation = dynamic(
  () =>
    import("./growth-toolbox-action-dialogs").then(
      (module) => module.CreateVocabularyDialog,
    ),
  { loading: DialogLoadingPlaceholder },
);
const VocabularyCellActionImplementation = dynamic(
  () =>
    import("./growth-toolbox-action-dialogs").then(
      (module) => module.VocabularyCellAction,
    ),
  { loading: DialogLoadingPlaceholder },
);
const CreateGrammarDialogImplementation = dynamic(
  () =>
    import("./growth-toolbox-action-dialogs").then(
      (module) => module.CreateGrammarDialog,
    ),
  { loading: DialogLoadingPlaceholder },
);
const GrammarCellActionImplementation = dynamic(
  () =>
    import("./growth-toolbox-action-dialogs").then(
      (module) => module.GrammarCellAction,
    ),
  { loading: DialogLoadingPlaceholder },
);

export function EditToolboxItemDialog({
  studentAppId,
  item,
  courses,
}: {
  studentAppId: string;
  item: GrowthToolboxItem;
  courses: GrowthToolboxCourseOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-8 border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
      >
        编辑
      </button>
      {open && (
        <EditToolboxItemDialogImplementation
          studentAppId={studentAppId}
          item={item}
          courses={courses}
          autoOpen
          onClosed={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function CreateVocabularyDialog({ studentAppId }: { studentAppId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white"
      >
        新增词汇
      </button>
      {open && (
        <CreateVocabularyDialogImplementation
          studentAppId={studentAppId}
          autoOpen
          onClosed={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function VocabularyCellAction({
  studentAppId,
  item,
}: {
  studentAppId: string;
  item: GrowthToolboxVocabularyItem;
}) {
  const [action, setAction] = useState<"edit" | "delete" | null>(null);
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setAction("edit")}
        className="h-8 border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
      >
        编辑
      </button>
      <button
        type="button"
        onClick={() => setAction("delete")}
        className="h-8 border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
      >
        删除
      </button>
      {action && (
        <VocabularyCellActionImplementation
          studentAppId={studentAppId}
          item={item}
          autoOpen={action}
          onClosed={() => setAction(null)}
        />
      )}
    </div>
  );
}

export function CreateGrammarDialog({ studentAppId }: { studentAppId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white"
      >
        新增语法
      </button>
      {open && (
        <CreateGrammarDialogImplementation
          studentAppId={studentAppId}
          autoOpen
          onClosed={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function GrammarCellAction({
  studentAppId,
  item,
}: {
  studentAppId: string;
  item: GrowthToolboxGrammarItem;
}) {
  const [action, setAction] = useState<"edit" | "delete" | null>(null);
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setAction("edit")}
        className="h-8 border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
      >
        编辑
      </button>
      <button
        type="button"
        onClick={() => setAction("delete")}
        className="h-8 border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
      >
        删除
      </button>
      {action && (
        <GrammarCellActionImplementation
          studentAppId={studentAppId}
          item={item}
          autoOpen={action}
          onClosed={() => setAction(null)}
        />
      )}
    </div>
  );
}
