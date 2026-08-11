"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2, Upload, Volume2 } from "lucide-react";

import {
  addGrammarItemAction,
  addVocabularyWordAction,
  confirmGrammarAudioUploadAction,
  createGrammarAudioUploadUrlAction,
  getGrammarAudioSignedUrlAction,
  removeGrammarItemAction,
  removeVocabularyWordAction,
  updateGrammarItemAction,
  updateVocabularyWordAction,
} from "@/app/dashboard/admin/digital-textbook/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DigitalTextbookGrammarItem,
  DigitalTextbookVocabularyWord,
} from "../api/types";
import type { DigitalTextbookDisplayRow } from "./digital-textbook-table/columns";

type EditorPanel = "vocabulary" | "grammar";

const EMPTY_WORD: DigitalTextbookVocabularyWord = {
  ko: "",
  zh: "",
  pos: "",
  collocation: "",
  transcription: "",
};

const EMPTY_GRAMMAR: DigitalTextbookGrammarItem = {
  title: "",
  meaning: "",
  cases: [],
  rows: [],
  examples: [],
  caution: "",
};

const INPUT_CLASS =
  "app-input h-9 w-full rounded-md border px-3 text-xs outline-none";

export function DigitalTextbookContentDialog({
  open,
  onOpenChange,
  panel,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: EditorPanel;
  row: DigitalTextbookDisplayRow;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(1280px,calc(100vw-32px))] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left">
          <DialogTitle className="text-base">
            {panel === "vocabulary" ? "编辑章节词汇" : "编辑章节语法"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {row.courseTitle}　›　{row.lessonTitle}　›　{row.textbookTitle}　›　第 {row.chapterNumber} 章
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-5">
          {panel === "vocabulary" ? (
            <VocabularyEditor row={row} />
          ) : (
            <GrammarEditor row={row} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VocabularyEditor({ row }: { row: DigitalTextbookDisplayRow }) {
  const router = useRouter();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<DigitalTextbookVocabularyWord>(EMPTY_WORD);
  const [addingNodeId, setAddingNodeId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function add(nodeId: string) {
    setPending(true);
    setMessage(null);
    const result = await addVocabularyWordAction(nodeId, draft);
    if (result.ok) {
      setDraft(EMPTY_WORD);
      setAddingNodeId(null);
      router.refresh();
    } else setMessage(result.message ?? "添加失败");
    setPending(false);
  }

  async function update(nodeId: string, index: number) {
    setPending(true);
    setMessage(null);
    const result = await updateVocabularyWordAction(nodeId, index, draft);
    if (result.ok) {
      setEditingKey(null);
      setDraft(EMPTY_WORD);
      router.refresh();
    } else setMessage(result.message ?? "保存失败");
    setPending(false);
  }

  async function remove(nodeId: string, index: number) {
    if (!window.confirm("确认删除这个词汇吗？")) return;
    setPending(true);
    setMessage(null);
    const result = await removeVocabularyWordAction(nodeId, index);
    if (result.ok) router.refresh();
    else setMessage(result.message ?? "删除失败");
    setPending(false);
  }

  if (row.vocabularyNodes.length === 0) {
    return (
      <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        本章没有可编辑的词汇节点。现有 Action 不支持创建词汇模块或节点，因此本次不提供新增入口。
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {message && <ResultMessage message={message} />}
      {row.vocabularyNodes.map((node, nodeIndex) => (
        <section key={node.id} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[var(--app-text)]">
              词汇节点 {nodeIndex + 1} · {node.vocabulary.length} 个词汇
            </p>
            <button
              type="button"
              onClick={() => {
                setAddingNodeId(node.id);
                setEditingKey(null);
                setDraft(EMPTY_WORD);
              }}
              className="inline-flex h-8 items-center gap-1.5 border border-[var(--app-border)] px-3 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-[var(--app-soft-bg)]"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              添加词汇
            </button>
          </div>
          <div className="overflow-x-auto border border-[var(--app-border)]">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]">
                <tr>
                  <th className="px-3 py-2">序号</th>
                  <th className="px-3 py-2">韩语</th>
                  <th className="px-3 py-2">中文</th>
                  <th className="px-3 py-2">词性</th>
                  <th className="px-3 py-2">搭配</th>
                  <th className="px-3 py-2">音标</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {node.vocabulary.map((word, index) => {
                  const key = `${node.id}:${index}`;
                  if (editingKey === key) {
                    return (
                      <tr key={key} className="border-t border-[var(--app-border)]">
                        <td colSpan={7} className="p-3">
                          <WordForm
                            value={draft}
                            onChange={setDraft}
                            pending={pending}
                            submitLabel="保存修改"
                            onSubmit={() => update(node.id, index)}
                            onCancel={() => setEditingKey(null)}
                          />
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={key} className="border-t border-[var(--app-border)]">
                      <td className="px-3 py-2.5 tabular-nums text-[var(--app-muted)]">{index + 1}</td>
                      <td className="px-3 py-2.5 font-semibold">{word.ko}</td>
                      <td className="px-3 py-2.5">{word.zh}</td>
                      <td className="px-3 py-2.5">{word.pos}</td>
                      <td className="px-3 py-2.5">{word.collocation}</td>
                      <td className="px-3 py-2.5">{word.transcription}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingKey(key);
                            setAddingNodeId(null);
                            setDraft({ ...word });
                          }}
                          className="p-1.5 text-[var(--app-muted)] hover:text-[var(--app-accent)]"
                          aria-label="编辑词汇"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(node.id, index)}
                          disabled={pending}
                          className="p-1.5 text-[var(--app-muted)] hover:text-rose-700 disabled:opacity-50"
                          aria-label="删除词汇"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {node.vocabulary.length === 0 && addingNodeId !== node.id && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[var(--app-muted)]">
                      这个节点还没有词汇
                    </td>
                  </tr>
                )}
                {addingNodeId === node.id && (
                  <tr className="border-t border-[var(--app-border)]">
                    <td colSpan={7} className="p-3">
                      <WordForm
                        value={draft}
                        onChange={setDraft}
                        pending={pending}
                        submitLabel="添加词汇"
                        onSubmit={() => add(node.id)}
                        onCancel={() => setAddingNodeId(null)}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function WordForm({
  value,
  onChange,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  value: DigitalTextbookVocabularyWord;
  onChange: (value: DigitalTextbookVocabularyWord) => void;
  pending: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        {(
          [
            ["ko", "韩语"],
            ["zh", "中文释义"],
            ["pos", "词性"],
            ["collocation", "搭配"],
            ["transcription", "音标"],
          ] as const
        ).map(([key, placeholder]) => (
          <input
            key={key}
            value={value[key]}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
            placeholder={placeholder}
            className={INPUT_CLASS}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <ActionButton pending={pending} label={submitLabel} onClick={onSubmit} />
        <button type="button" onClick={onCancel} className="h-9 border border-[var(--app-border)] px-3 text-xs font-semibold">
          取消
        </button>
      </div>
    </div>
  );
}

function GrammarEditor({ row }: { row: DigitalTextbookDisplayRow }) {
  const router = useRouter();
  const items = row.grammarNodes.flatMap((node) => node.items);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function remove(index: number) {
    if (!window.confirm("确认删除这个语法点吗？已有 R2 音频不会被自动删除。")) return;
    setPending(true);
    setMessage(null);
    const result = await removeGrammarItemAction(row.chapterId, index);
    if (result.ok) router.refresh();
    else setMessage(result.message ?? "删除失败");
    setPending(false);
  }

  return (
    <div className="space-y-4">
      {message && <ResultMessage message={message} />}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold">共 {items.length} 个语法点</p>
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingIndex(null);
          }}
          className="inline-flex h-8 items-center gap-1.5 border border-[var(--app-border)] px-3 text-xs font-semibold hover:bg-[var(--app-soft-bg)]"
        >
          <Plus className="size-3.5" />
          添加语法点
        </button>
      </div>

      {adding && (
        <GrammarForm
          row={row}
          initial={EMPTY_GRAMMAR}
          pending={pending}
          setPending={setPending}
          onMessage={setMessage}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {items.length === 0 && !adding && (
        <p className="border border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
          本章还没有语法内容。新增时会沿用现有 Action 自动准备语法模块和节点。
        </p>
      )}

      <div className="space-y-3">
        {items.map((item, index) =>
          editingIndex === index ? (
            <GrammarForm
              key={index}
              row={row}
              index={index}
              initial={item}
              pending={pending}
              setPending={setPending}
              onMessage={setMessage}
              onSaved={() => {
                setEditingIndex(null);
                router.refresh();
              }}
              onCancel={() => setEditingIndex(null)}
            />
          ) : (
            <article key={index} className="border border-[var(--app-border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--app-text)]">{item.title}</h3>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">{item.meaning || "暂无中文含义"}</p>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setEditingIndex(index)} className="p-2 text-[var(--app-muted)] hover:text-[var(--app-accent)]" aria-label="编辑语法">
                    <Pencil className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(index)} disabled={pending} className="p-2 text-[var(--app-muted)] hover:text-rose-700 disabled:opacity-50" aria-label="删除语法">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
                <SummaryField label="收音情况" value={`${item.cases.length} 行`} />
                <SummaryField label="形态组合" value={`${item.rows.length} 行`} />
                <SummaryField label="例句展示" value={`${item.examples.length} 句`} />
              </div>
              {item.caution && <p className="mt-3 text-xs text-amber-700">注意：{item.caution}</p>}
            </article>
          ),
        )}
      </div>
    </div>
  );
}

function GrammarForm({
  row,
  index,
  initial,
  pending,
  setPending,
  onMessage,
  onSaved,
  onCancel,
}: {
  row: DigitalTextbookDisplayRow;
  index?: number;
  initial: DigitalTextbookGrammarItem;
  pending: boolean;
  setPending: (pending: boolean) => void;
  onMessage: (message: string | null) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<DigitalTextbookGrammarItem>(() => ({
    ...initial,
    cases: initial.cases.map((item) => ({ ...item })),
    rows: initial.rows.map((item) => ({ ...item })),
    examples: initial.examples.map((item) => ({ ...item })),
  }));

  async function submit() {
    setPending(true);
    onMessage(null);
    const result =
      index === undefined
        ? await addGrammarItemAction(row.chapterId, draft)
        : await updateGrammarItemAction(row.chapterId, index, draft);
    if (result.ok) onSaved();
    else onMessage(result.message ?? "保存失败");
    setPending(false);
  }

  return (
    <div className="space-y-4 border border-[var(--app-border)] bg-[var(--app-soft-bg)] p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <LabeledInput label="语法名称" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
        <LabeledInput label="中文含义" value={draft.meaning} onChange={(meaning) => setDraft({ ...draft, meaning })} />
      </div>

      <EditableRows
        title="收音情况"
        emptyLabel="添加收音情况"
        rows={draft.cases}
        createRow={() => ({ batchim: "", conjugation: "" })}
        onRowsChange={(cases) => setDraft({ ...draft, cases })}
        renderRow={(caseRow, onChange) => (
          <div className="grid flex-1 gap-2 md:grid-cols-2">
            <input className={INPUT_CLASS} value={caseRow.batchim} onChange={(event) => onChange({ ...caseRow, batchim: event.target.value })} placeholder="尾字收音" />
            <input className={INPUT_CLASS} value={caseRow.conjugation} onChange={(event) => onChange({ ...caseRow, conjugation: event.target.value })} placeholder="情况说明" />
          </div>
        )}
      />

      <EditableRows
        title="形态组合"
        emptyLabel="添加形态组合"
        rows={draft.rows}
        createRow={() => ({ form: "", combination: "", audio: "" })}
        onRowsChange={(rows) => setDraft({ ...draft, rows })}
        renderRow={(formRow, onChange) => (
          <div className="grid flex-1 gap-2 lg:grid-cols-[1fr_1fr_1.4fr]">
            <input className={INPUT_CLASS} value={formRow.form} onChange={(event) => onChange({ ...formRow, form: event.target.value })} placeholder="形态" />
            <input className={INPUT_CLASS} value={formRow.combination} onChange={(event) => onChange({ ...formRow, combination: event.target.value })} placeholder="组合结果" />
            <GrammarAudioField row={row} value={formRow.audio} onChange={(audio) => onChange({ ...formRow, audio })} />
          </div>
        )}
      />

      <EditableRows
        title="例句展示"
        emptyLabel="添加例句"
        rows={draft.examples}
        createRow={() => ({ ko: "", zh: "", audio: "" })}
        onRowsChange={(examples) => setDraft({ ...draft, examples })}
        renderRow={(example, onChange) => (
          <div className="grid flex-1 gap-2 lg:grid-cols-[1fr_1fr_1.4fr]">
            <input className={INPUT_CLASS} value={example.ko} onChange={(event) => onChange({ ...example, ko: event.target.value })} placeholder="韩语例句" />
            <input className={INPUT_CLASS} value={example.zh} onChange={(event) => onChange({ ...example, zh: event.target.value })} placeholder="中文释义" />
            <GrammarAudioField row={row} value={example.audio} onChange={(audio) => onChange({ ...example, audio })} />
          </div>
        )}
      />

      <LabeledInput label="注意事项" value={draft.caution} onChange={(caution) => setDraft({ ...draft, caution })} />
      <div className="flex gap-2">
        <ActionButton pending={pending} label={index === undefined ? "添加语法" : "保存修改"} onClick={submit} />
        <button type="button" onClick={onCancel} className="h-9 border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 text-xs font-semibold">
          取消
        </button>
      </div>
    </div>
  );
}

function EditableRows<T>({
  title,
  emptyLabel,
  rows,
  createRow,
  onRowsChange,
  renderRow,
}: {
  title: string;
  emptyLabel: string;
  rows: T[];
  createRow: () => T;
  onRowsChange: (rows: T[]) => void;
  renderRow: (row: T, onChange: (row: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[var(--app-text-soft)]">{title}</p>
      {rows.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          {renderRow(item, (next) =>
            onRowsChange(
              rows.map((row, rowIndex) =>
                rowIndex === index ? next : row,
              ),
            ),
          )}
          <button type="button" onClick={() => onRowsChange(rows.filter((_, rowIndex) => rowIndex !== index))} className="p-2 text-[var(--app-muted)] hover:text-rose-700" aria-label={`删除${title}行`}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onRowsChange([...rows, createRow()])} className="inline-flex h-8 items-center gap-1.5 border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 text-xs font-semibold">
        <Plus className="size-3.5" />
        {emptyLabel}
      </button>
    </div>
  );
}

function GrammarAudioField({
  row,
  value,
  onChange,
}: {
  row: DigitalTextbookDisplayRow;
  value: string;
  onChange: (value: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File) {
    setPending(true);
    setMessage(null);
    try {
      const created = await createGrammarAudioUploadUrlAction({
        textbookSlug: row.textbookSlug,
        chapterNumber: row.chapterNumber,
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败，请稍后重试");
    }
    setPending(false);
  }

  async function play() {
    setPending(true);
    setMessage(null);
    const result = await getGrammarAudioSignedUrlAction(value);
    if (result.ok && result.signedUrl) window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    else setMessage(result.message ?? "获取播放地址失败");
    setPending(false);
  }

  return (
    <div className="space-y-1">
      <div className="flex min-h-9 items-center gap-2 border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2">
        <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[var(--app-text-soft)]">
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          上传音频
          <input type="file" accept="audio/*" className="sr-only" disabled={pending} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} />
        </label>
        {value && (
          <button type="button" onClick={play} disabled={pending} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--app-accent)] disabled:opacity-50">
            <Volume2 className="size-3.5" />
            试听
          </button>
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-[var(--app-muted)]">{value || "尚未上传"}</span>
      </div>
      {message && <p className="text-[10px] text-rose-700">{message}</p>}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs font-semibold text-[var(--app-text-soft)]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS} />
    </label>
  );
}

function ActionButton({
  pending,
  label,
  onClick,
}: {
  pending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={pending} className="inline-flex h-9 items-center gap-1.5 bg-neutral-950 px-3 text-xs font-semibold text-white disabled:opacity-50">
      {pending && <LoaderCircle className="size-3.5 animate-spin" />}
      {pending ? "处理中…" : label}
    </button>
  );
}

function ResultMessage({ message }: { message: string }) {
  return <p className="border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{message}</p>;
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--app-soft-bg)] px-3 py-2">
      <p className="text-[10px] text-[var(--app-muted)]">{label}</p>
      <p className="mt-0.5 font-semibold text-[var(--app-text-soft)]">{value}</p>
    </div>
  );
}
