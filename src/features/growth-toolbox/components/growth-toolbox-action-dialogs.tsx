"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2, Upload, Volume2 } from "lucide-react";

import {
  addGrammarLibraryAction,
  addToolboxVocabularyAction,
  removeGrammarLibraryAction,
  removeToolboxVocabularyAction,
  updateGrammarLibraryAction,
  updateToolboxItemAction,
  updateToolboxVocabularyAction,
  type GrammarLibraryItemInput,
  type ToolboxItemInput,
  type VocabularyWordInput,
} from "@/app/dashboard/admin/growth-toolbox/actions";
import {
  confirmGrammarAudioUploadAction,
  createGrammarAudioUploadUrlAction,
  getGrammarAudioSignedUrlAction,
} from "@/app/dashboard/admin/digital-textbook/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  GrowthToolboxGrammarItem,
  GrowthToolboxItem,
  GrowthToolboxVocabularyItem,
} from "../api/types";

export type GrowthToolboxCourseOption = { id: string; title: string };

const INPUT_CLASS =
  "app-input h-9 w-full rounded-md border px-3 text-xs outline-none";
const TEXTAREA_CLASS =
  "app-input w-full resize-y rounded-md border px-3 py-2 text-xs outline-none";
const LIBRARY_AUDIO_SLUG = "growth-toolbox";

const COLOR_OPTIONS = [
  {
    label: "绿色",
    accent: "var(--app-accent)",
    soft: "var(--app-accent-soft)",
  },
  {
    label: "暖棕色",
    accent: "var(--app-warm)",
    soft: "var(--app-warm-soft)",
  },
  {
    label: "辅助色",
    accent: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
  },
  {
    label: "成功色",
    accent: "var(--app-success)",
    soft: "var(--app-success-soft)",
  },
] as const;

const ICON_OPTIONS = [
  ["notebook-pen", "笔记本"],
  ["mic", "麦克风"],
  ["book-open", "打开的书"],
  ["ear", "听力"],
  ["wrench", "工具"],
  ["sparkles", "闪光"],
  ["headphones", "耳机"],
  ["message-square", "对话"],
  ["pen-tool", "书写"],
] as const;

export function EditToolboxItemDialog({
  item,
  courses,
}: {
  item: GrowthToolboxItem;
  courses: GrowthToolboxCourseOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<ToolboxItemInput>(() => toToolboxDraft(item));

  async function submit() {
    setPending(true);
    setMessage("");
    const result = await updateToolboxItemAction(item.id, draft);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message ?? "保存失败");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(toToolboxDraft(item));
          setMessage("");
          setOpen(true);
        }}
        className="h-8 border border-[var(--app-border)] px-2.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-[var(--app-soft-bg)]"
      >
        编辑
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left">
            <DialogTitle>编辑工具入口</DialogTitle>
            <DialogDescription className="text-xs">
              修改后会影响学生端入口的名称、链接、颜色、启停状态和显示顺序。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-5 sm:grid-cols-2">
            <FormField label="入口名称">
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className={INPUT_CLASS}
              />
            </FormField>
            <FormField label="学生端链接">
              <input
                value={draft.href}
                onChange={(event) => setDraft({ ...draft, href: event.target.value })}
                className={INPUT_CLASS}
              />
            </FormField>
            <FormField label="图标">
              <select
                value={draft.iconName}
                onChange={(event) => setDraft({ ...draft, iconName: event.target.value })}
                className={INPUT_CLASS}
              >
                {ICON_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="颜色">
              <select
                value={draft.accent}
                onChange={(event) => {
                  const selected = COLOR_OPTIONS.find(
                    (option) => option.accent === event.target.value,
                  );
                  if (selected) {
                    setDraft({ ...draft, accent: selected.accent, soft: selected.soft });
                  }
                }}
                className={INPUT_CLASS}
              >
                {COLOR_OPTIONS.map((option) => (
                  <option key={option.accent} value={option.accent}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="排序值">
              <input
                type="number"
                min={0}
                max={99}
                value={draft.sortOrder}
                onChange={(event) =>
                  setDraft({ ...draft, sortOrder: Number(event.target.value) })
                }
                className={INPUT_CLASS}
              />
            </FormField>
            <FormField label="关联课程">
              <select
                value={draft.relatedCourseId ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, relatedCourseId: event.target.value || null })
                }
                className={INPUT_CLASS}
              >
                <option value="">不关联课程</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </FormField>
            <FormField label="入口说明" className="sm:col-span-2">
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                className={TEXTAREA_CLASS}
              />
            </FormField>
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--app-text-soft)] sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.isEnabled}
                onChange={(event) =>
                  setDraft({ ...draft, isEnabled: event.target.checked })
                }
                className="size-4 accent-[var(--app-accent)]"
              />
              在学生端启用这个入口
            </label>
            <ActionFeedback message={message} className="sm:col-span-2" />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
              className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? "保存中…" : "保存修改"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toToolboxDraft(item: GrowthToolboxItem): ToolboxItemInput {
  return {
    title: item.title,
    description: item.description,
    href: item.href,
    iconName: item.iconName,
    accent: item.accent,
    soft: item.soft,
    sortOrder: item.sortOrder,
    isEnabled: item.isEnabled,
    relatedCourseId: item.relatedCourseId,
  };
}

const EMPTY_WORD: VocabularyWordInput = {
  ko: "",
  zh: "",
  pos: "",
  collocation: "",
  transcription: "",
};

export function CreateVocabularyDialog() {
  const [open, setOpen] = useState(false);
  return (
    <VocabularyDialog
      title="新增词汇"
      trigger={
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white"
        >
          新增词汇
        </button>
      }
      open={open}
      onOpenChange={setOpen}
    />
  );
}

export function VocabularyCellAction({ item }: { item: GrowthToolboxVocabularyItem }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function remove() {
    setPending(true);
    setMessage("");
    const result = await removeToolboxVocabularyAction(item.id);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message ?? "删除失败");
      return;
    }
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="h-8 border border-[var(--app-border)] px-2.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-[var(--app-soft-bg)]"
      >
        编辑
      </button>
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="h-8 border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
      >
        删除
      </button>
      <VocabularyDialog
        title="编辑词汇"
        item={item}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除词汇“{item.ko || item.zh}”？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后会立即从学生端练习词库消失，此操作不能撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ActionFeedback message={message} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              disabled={pending}
              className="bg-rose-700 text-white hover:bg-rose-800"
            >
              {pending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VocabularyDialog({
  title,
  item,
  trigger,
  open,
  onOpenChange,
}: {
  title: string;
  item?: GrowthToolboxVocabularyItem;
  trigger?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<VocabularyWordInput>(() =>
    item ? toWordDraft(item) : EMPTY_WORD,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setPending(true);
    setMessage("");
    const result = item
      ? await updateToolboxVocabularyAction(item.id, draft)
      : await addToolboxVocabularyAction(draft);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message ?? "保存失败");
      return;
    }
    onOpenChange(false);
    if (!item) setDraft(EMPTY_WORD);
    router.refresh();
  }

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) setDraft(item ? toWordDraft(item) : EMPTY_WORD);
          setMessage("");
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-xs">
              词汇库与互动教材内容独立，保存后用于学生端单词练习。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-5 sm:grid-cols-2">
            {(
              [
                ["ko", "韩语"],
                ["zh", "中文释义"],
                ["pos", "词性"],
                ["transcription", "音标"],
              ] as const
            ).map(([key, label]) => (
              <FormField key={key} label={label}>
                <input
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                  className={INPUT_CLASS}
                />
              </FormField>
            ))}
            <FormField label="搭配与说明" className="sm:col-span-2">
              <textarea
                rows={3}
                value={draft.collocation}
                onChange={(event) =>
                  setDraft({ ...draft, collocation: event.target.value })
                }
                className={TEXTAREA_CLASS}
              />
            </FormField>
            <ActionFeedback message={message} className="sm:col-span-2" />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
              className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? "保存中…" : "保存"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toWordDraft(item: GrowthToolboxVocabularyItem): VocabularyWordInput {
  return {
    ko: item.ko,
    zh: item.zh,
    pos: item.pos,
    collocation: item.collocation,
    transcription: item.transcription,
  };
}

const EMPTY_GRAMMAR: GrammarLibraryItemInput = {
  title: "",
  meaning: "",
  cases: [],
  rows: [],
  examples: [],
  caution: "",
};

export function CreateGrammarDialog() {
  const [open, setOpen] = useState(false);
  return (
    <GrammarDialog
      title="新增语法"
      trigger={
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white"
        >
          新增语法
        </button>
      }
      open={open}
      onOpenChange={setOpen}
    />
  );
}

export function GrammarCellAction({ item }: { item: GrowthToolboxGrammarItem }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function remove() {
    setPending(true);
    setMessage("");
    const result = await removeGrammarLibraryAction(item.id);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message ?? "删除失败");
      return;
    }
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="h-8 border border-[var(--app-border)] px-2.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-[var(--app-soft-bg)]"
      >
        编辑
      </button>
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="h-8 border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
      >
        删除
      </button>
      <GrammarDialog
        title="编辑语法"
        item={item}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除语法“{item.title}”？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后会从语法库永久移除，此操作不能撤销。已上传的 R2 音频不会由现有 Action 自动删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ActionFeedback message={message} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              disabled={pending}
              className="bg-rose-700 text-white hover:bg-rose-800"
            >
              {pending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GrammarDialog({
  title,
  item,
  trigger,
  open,
  onOpenChange,
}: {
  title: string;
  item?: GrowthToolboxGrammarItem;
  trigger?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<GrammarLibraryItemInput>(() =>
    item ? toGrammarDraft(item) : EMPTY_GRAMMAR,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setPending(true);
    setMessage("");
    const result = item
      ? await updateGrammarLibraryAction(item.id, draft)
      : await addGrammarLibraryAction(draft);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message ?? "保存失败");
      return;
    }
    onOpenChange(false);
    if (!item) setDraft(EMPTY_GRAMMAR);
    router.refresh();
  }

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) setDraft(item ? toGrammarDraft(item) : EMPTY_GRAMMAR);
          setMessage("");
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-xs">
              音频继续上传到既有 R2 路径，数据库只保存对象标识。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="语法名称">
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  className={INPUT_CLASS}
                />
              </FormField>
              <FormField label="中文含义">
                <input
                  value={draft.meaning}
                  onChange={(event) => setDraft({ ...draft, meaning: event.target.value })}
                  className={INPUT_CLASS}
                />
              </FormField>
            </div>

            <GrammarRowsSection
              title="收音情况"
              addLabel="添加收音情况"
              onAdd={() => setDraft({ ...draft, cases: [...draft.cases, { batchim: "", conjugation: "" }] })}
            >
              {draft.cases.map((entry, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={entry.batchim}
                    placeholder="尾字收音"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        cases: draft.cases.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, batchim: event.target.value } : row,
                        ),
                      })
                    }
                    className={INPUT_CLASS}
                  />
                  <input
                    value={entry.conjugation}
                    placeholder="情况说明"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        cases: draft.cases.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, conjugation: event.target.value } : row,
                        ),
                      })
                    }
                    className={INPUT_CLASS}
                  />
                  <RemoveRowButton onClick={() => setDraft({ ...draft, cases: draft.cases.filter((_, rowIndex) => rowIndex !== index) })} />
                </div>
              ))}
            </GrammarRowsSection>

            <GrammarRowsSection
              title="形态组合"
              addLabel="添加形态组合"
              onAdd={() => setDraft({ ...draft, rows: [...draft.rows, { form: "", combination: "", audio: "" }] })}
            >
              {draft.rows.map((entry, index) => (
                <div key={index} className="grid gap-2 lg:grid-cols-[1fr_1fr_1.4fr_auto]">
                  <input
                    value={entry.form}
                    placeholder="形态"
                    onChange={(event) => setDraft({ ...draft, rows: draft.rows.map((row, rowIndex) => rowIndex === index ? { ...row, form: event.target.value } : row) })}
                    className={INPUT_CLASS}
                  />
                  <input
                    value={entry.combination}
                    placeholder="组合结果"
                    onChange={(event) => setDraft({ ...draft, rows: draft.rows.map((row, rowIndex) => rowIndex === index ? { ...row, combination: event.target.value } : row) })}
                    className={INPUT_CLASS}
                  />
                  <GrammarAudioField
                    value={entry.audio}
                    onChange={(audio) => setDraft({ ...draft, rows: draft.rows.map((row, rowIndex) => rowIndex === index ? { ...row, audio } : row) })}
                  />
                  <RemoveRowButton onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, rowIndex) => rowIndex !== index) })} />
                </div>
              ))}
            </GrammarRowsSection>

            <GrammarRowsSection
              title="例句"
              addLabel="添加例句"
              onAdd={() => setDraft({ ...draft, examples: [...draft.examples, { ko: "", zh: "", audio: "" }] })}
            >
              {draft.examples.map((entry, index) => (
                <div key={index} className="grid gap-2 lg:grid-cols-[1fr_1fr_1.4fr_auto]">
                  <input
                    value={entry.ko}
                    placeholder="韩语例句"
                    onChange={(event) => setDraft({ ...draft, examples: draft.examples.map((row, rowIndex) => rowIndex === index ? { ...row, ko: event.target.value } : row) })}
                    className={INPUT_CLASS}
                  />
                  <input
                    value={entry.zh}
                    placeholder="中文释义"
                    onChange={(event) => setDraft({ ...draft, examples: draft.examples.map((row, rowIndex) => rowIndex === index ? { ...row, zh: event.target.value } : row) })}
                    className={INPUT_CLASS}
                  />
                  <GrammarAudioField
                    value={entry.audio}
                    onChange={(audio) => setDraft({ ...draft, examples: draft.examples.map((row, rowIndex) => rowIndex === index ? { ...row, audio } : row) })}
                  />
                  <RemoveRowButton onClick={() => setDraft({ ...draft, examples: draft.examples.filter((_, rowIndex) => rowIndex !== index) })} />
                </div>
              ))}
            </GrammarRowsSection>

            <FormField label="注意事项">
              <textarea
                rows={3}
                value={draft.caution}
                onChange={(event) => setDraft({ ...draft, caution: event.target.value })}
                className={TEXTAREA_CLASS}
              />
            </FormField>
            <ActionFeedback message={message} />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
              className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? "保存中…" : "保存"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toGrammarDraft(item: GrowthToolboxGrammarItem): GrammarLibraryItemInput {
  return {
    title: item.title,
    meaning: item.meaning,
    cases: item.cases.map((entry) => ({ ...entry })),
    rows: item.rows.map((entry) => ({ ...entry })),
    examples: item.examples.map((entry) => ({ ...entry })),
    caution: item.caution,
  };
}

function GrammarRowsSection({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 border border-[var(--app-border)] p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-[var(--app-text)]">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1 border border-[var(--app-border)] px-2.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-[var(--app-soft-bg)]"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {addLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

function RemoveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="删除这一行"
      className="flex size-9 items-center justify-center border border-rose-200 text-rose-700 hover:bg-rose-50"
    >
      <Trash2 className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function GrammarAudioField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setMessage("正在上传…");
    try {
      const created = await createGrammarAudioUploadUrlAction({
        textbookSlug: LIBRARY_AUDIO_SLUG,
        chapterNumber: 1,
        fileName: file.name,
        contentType: file.type || "audio/mpeg",
        fileSize: file.size,
      });
      if (!created.ok || !created.uploadUrl || !created.objectKey) {
        throw new Error(created.message ?? "生成上传地址失败");
      }
      const response = await fetch(created.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "audio/mpeg" },
        body: file,
      });
      if (!response.ok) throw new Error("R2 上传失败，请稍后重试");
      const confirmed = await confirmGrammarAudioUploadAction({
        objectKey: created.objectKey,
        fileSize: file.size,
      });
      if (!confirmed.ok || !confirmed.signedUrl) {
        throw new Error(confirmed.message ?? "音频校验失败");
      }
      onChange(created.objectKey);
      setMessage("已上传，保存语法后生效");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function preview() {
    setPending(true);
    const result = await getGrammarAudioSignedUrlAction(value);
    setPending(false);
    if (result.ok && result.signedUrl) {
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } else {
      setMessage(result.message ?? "获取播放地址失败");
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex h-9 items-center gap-1 border border-[var(--app-border)] px-2">
        {value ? (
          <>
            <Volume2 className="size-3.5 shrink-0 text-[var(--app-accent)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[10px]" title={value}>
              {value.split("/").pop()}
            </span>
            <button type="button" onClick={() => void preview()} disabled={pending} className="text-[10px] font-semibold text-[var(--app-accent)] disabled:opacity-50">试听</button>
            <button type="button" onClick={() => onChange("")} disabled={pending} className="text-[10px] font-semibold text-rose-700 disabled:opacity-50">移除</button>
          </>
        ) : (
          <label htmlFor={inputId} className="flex flex-1 cursor-pointer items-center justify-center gap-1 text-[10px] font-semibold text-[var(--app-text-soft)]">
            {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
            {pending ? "上传中…" : "上传音频"}
          </label>
        )}
      </div>
      <input id={inputId} type="file" accept="audio/*" disabled={pending} className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
      {message && <p className="mt-1 text-[10px] text-[var(--app-muted)]">{message}</p>}
    </div>
  );
}

function FormField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--app-muted)]">{label}</span>
      {children}
    </label>
  );
}

function ActionFeedback({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p className={`border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ${className ?? ""}`} role="status">
      {message}
    </p>
  );
}
