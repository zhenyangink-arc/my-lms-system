"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GrowthToolboxVocabularyWord } from "@/features/growth-toolbox/api/types";
import {
  BookOpen,
  BookOpenCheck,
  Check,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Volume2,
  X,
} from "lucide-react";

import {
  addGrammarLibraryAction,
  addToolboxVocabularyAction,
  removeGrammarLibraryAction,
  removeToolboxVocabularyAction,
  updateGrammarLibraryAction,
  updateToolboxVocabularyAction,
  type ActionResult,
} from "./actions";

import {
  confirmGrammarAudioUploadAction,
  createGrammarAudioUploadUrlAction,
  getGrammarAudioSignedUrlAction,
  setTextbookStatusAction,
} from "../digital-textbook/actions";

export type VocabularyLibraryItem = {
  id: string;
  ko: string;
  zh: string;
  pos: string;
  collocation: string;
  transcription: string;
  source: "textbook" | "custom";
  sortOrder: number;
};

export type GrammarLibraryItem = {
  id: string;
  title: string;
  meaning: string;
  cases: { batchim: string; conjugation: string }[];
  rows: { form: string; combination: string; audio: string }[];
  examples: { ko: string; zh: string; audio: string }[];
  caution: string;
  source: "textbook" | "custom";
  sortOrder: number;
};

export type CourseTree = {
  id: string;
  title: string;
  slug: string;
  lessons: {
    id: string;
    title: string;
    textbooks: {
      id: string;
      title: string;
      slug: string;
      status: string;
      chapters: {
        id: string;
        number: number;
        slug: string;
        vocabularyCount: number;
        vocabularyNodes: { id: string; vocabulary: GrowthToolboxVocabularyWord[] }[];
      }[];
    }[];
  }[];
};

type FlatRow =
  | { kind: "course"; course: CourseTree; depth: 0 }
  | { kind: "lesson"; course: CourseTree; lesson: CourseTree["lessons"][number]; depth: 1 }
  | {
      kind: "chapter";
      course: CourseTree;
      lesson: CourseTree["lessons"][number];
      textbook: CourseTree["lessons"][number]["textbooks"][number];
      chapter: CourseTree["lessons"][number]["textbooks"][number]["chapters"][number];
      depth: 2;
    };

function courseStats(course: CourseTree) {
  let chapters = 0;
  let words = 0;
  for (const lesson of course.lessons) {
    for (const textbook of lesson.textbooks) {
      chapters += textbook.chapters.length;
      for (const chapter of textbook.chapters) words += chapter.vocabularyCount;
    }
  }
  return { chapters, words };
}

function lessonStats(lesson: CourseTree["lessons"][number]) {
  let chapters = 0;
  let words = 0;
  for (const textbook of lesson.textbooks) {
    chapters += textbook.chapters.length;
    for (const chapter of textbook.chapters) words += chapter.vocabularyCount;
  }
  return { chapters, words };
}

export function GrowthToolboxManager({
  courseTree,
  vocabularyLibrary,
  grammarLibrary,
}: {
  courseTree: CourseTree[];
  vocabularyLibrary: VocabularyLibraryItem[];
  grammarLibrary: GrammarLibraryItem[];
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem("gtb-course-tree-collapsed");
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // 忽略读取失败
    }
    return new Set();
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("gtb-course-tree-collapsed", JSON.stringify([...collapsed]));
    } catch {
      // 忽略写入失败
    }
  }, [collapsed]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [grammarOpen, setGrammarOpen] = useState(false);

  const rows = useMemo<FlatRow[]>(() => {
    const normalized = query.trim().toLowerCase();
    const filtering = Boolean(normalized) || statusFilter !== "all";

    const all: FlatRow[] = [];
    for (const course of courseTree) {
      all.push({ kind: "course", course, depth: 0 });
      for (const lesson of course.lessons) {
        all.push({ kind: "lesson", course, lesson, depth: 1 });
        for (const textbook of lesson.textbooks) {
          for (const chapter of textbook.chapters) {
            all.push({ kind: "chapter", course, lesson, textbook, chapter, depth: 2 });
          }
        }
      }
    }

    if (filtering) {
      return all.filter((row) => {
        let haystack = "";
        let status: string | null = null;
        if (row.kind === "course") {
          haystack = row.course.title;
        } else if (row.kind === "lesson") {
          haystack = row.lesson.title;
          status = row.lesson.textbooks[0]?.status ?? null;
        } else {
          haystack = `第 ${row.chapter.number} 章 ${row.chapter.slug} ${row.textbook.title} ${row.textbook.slug}`;
          status = row.textbook.status;
        }
        const matchesQuery = !normalized || haystack.toLowerCase().includes(normalized);
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        return matchesQuery && matchesStatus;
      });
    }

    const result: FlatRow[] = [];
    const collapsedDepths: number[] = [];
    for (const row of all) {
      while (
        collapsedDepths.length > 0 &&
        collapsedDepths[collapsedDepths.length - 1] >= row.depth
      ) {
        collapsedDepths.pop();
      }
      const hidden = collapsedDepths.length > 0;
      if (row.kind === "course" && collapsed.has(`c:${row.course.id}`)) {
        collapsedDepths.push(row.depth);
      } else if (row.kind === "lesson" && collapsed.has(`l:${row.lesson.id}`)) {
        collapsedDepths.push(row.depth);
      }
      if (!hidden) result.push(row);
    }
    return result;
  }, [collapsed, query, statusFilter, courseTree]);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="rounded-xl border" style={{ borderColor: "var(--app-border)" }}>
      {/* 工具栏 */}
      <div
        className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--app-border)" }}
      >
        <label className="relative">
          <Search size={12} className="app-muted-text absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索课程、课时、教材或章节"
            className="app-input w-64 rounded-[6px] border py-2 pl-8 pr-8 text-[11px] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清空搜索"
              className="app-muted-text absolute right-2 top-1/2 -translate-y-1/2 p-1"
            >
              <X size={12} />
            </button>
          )}
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="app-input rounded-[6px] border px-3 py-2 text-[11px] outline-none"
        >
          <option value="all">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="archived">已归档</option>
        </select>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
          style={{ borderColor: "var(--app-border)", color: "var(--app-accent)" }}
        >
          <BookOpenCheck size={12} aria-hidden="true" />
          练习词库（{vocabularyLibrary.length}）
        </button>
        <button
          type="button"
          onClick={() => setGrammarOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
          style={{ borderColor: "var(--app-border)", color: "var(--app-secondary)" }}
        >
          <BookOpen size={12} aria-hidden="true" />
          语法库（{grammarLibrary.length}）
        </button>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>
              <th className="w-[34%] px-4 py-2.5 font-medium">课程结构</th>
              <th className="w-[18%] px-3 py-2.5 font-medium">互动教材</th>
              <th className="w-[8%] px-3 py-2.5 font-medium">章节</th>
              <th className="w-[8%] px-3 py-2.5 font-medium">词汇</th>
              <th className="w-[12%] px-3 py-2.5 font-medium">状态</th>
              <th className="w-[14%] px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="app-muted-text px-4 py-10 text-center text-[12px]">
                  没有符合当前条件的课程内容。
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                if (row.kind === "course") {
                  const stats = courseStats(row.course);
                  return (
                    <tr key={`c-${row.course.id}`} className="border-b text-[11px] last:border-b-0" style={{ borderColor: "var(--app-border-soft)" }}>
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-1">
                          <ToggleButton
                            open={!collapsed.has(`c:${row.course.id}`)}
                            onClick={() => toggle(`c:${row.course.id}`)}
                            label={row.course.title}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{row.course.title}</span>
                          </span>
                        </div>
                      </td>
                      <td className="app-muted-text px-3 py-2.5 text-[10px]">—</td>
                      <td className="app-muted-text px-3 py-2.5 font-mono text-[10px]">{stats.chapters}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px]">{stats.words}</td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="app-muted-text px-4 py-2.5 text-right">—</td>
                    </tr>
                  );
                }

                if (row.kind === "lesson") {
                  const stats = lessonStats(row.lesson);
                  const textbook = row.lesson.textbooks[0];
                  return (
                    <tr key={`l-${row.lesson.id}`} className="border-b text-[11px] last:border-b-0" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-soft-bg)" }}>
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: "18px" }}>
                          <ToggleButton
                            open={!collapsed.has(`l:${row.lesson.id}`)}
                            onClick={() => toggle(`l:${row.lesson.id}`)}
                            label={row.lesson.title}
                          />
                          <span className="min-w-0 truncate font-medium">{row.lesson.title}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {textbook ? (
                          <>
                            <span className="block truncate font-medium">{textbook.title || textbook.slug}</span>
                          </>
                        ) : (
                          <span className="app-muted-text text-[10px]">—</span>
                        )}
                      </td>
                      <td className="app-muted-text px-3 py-2.5 font-mono text-[10px]">{stats.chapters}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px]">{stats.words}</td>
                      <td className="px-3 py-2.5">
                        {textbook ? <RowStatus status={textbook.status} /> : <span className="app-muted-text text-[10px]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {textbook ? (
                          <StatusSwitch
                            textbookId={textbook.id}
                            status={textbook.status}
                            onRefresh={() => router.refresh()}
                          />
                        ) : (
                          <span className="app-muted-text text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={`ch-${row.chapter.id}`} className="border-b text-[11px] last:border-b-0" style={{ borderColor: "var(--app-border-soft)" }}>
                    <td className="px-4 py-2">
                      <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: "42px" }}>
                        <span className="w-6 shrink-0" />
                        <span className="min-w-0 truncate font-medium">
                          第 {row.chapter.number} 章 · {row.chapter.slug}
                        </span>
                      </div>
                    </td>
                    <td className="app-muted-text px-3 py-2 text-[10px]">—</td>
                    <td className="app-muted-text px-3 py-2 font-mono text-[10px]">—</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{row.chapter.vocabularyCount}</td>
                    <td className="px-3 py-2">
                      <RowStatus status={row.textbook.status} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setLibraryOpen(true)}
                          className="app-muted-text font-medium underline-offset-2 transition hover:text-[var(--app-accent)] hover:underline"
                        >
                          词汇编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => setGrammarOpen(true)}
                          className="app-muted-text font-medium underline-offset-2 transition hover:text-[var(--app-secondary)] hover:underline"
                        >
                          语法编辑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {/* 练习词库工作窗 */}
      {libraryOpen && (
        <VocabularyLibraryWorkspace
          items={vocabularyLibrary}
          onClose={() => setLibraryOpen(false)}
        />
      )}
      {/* 语法库工作窗 */}
      {grammarOpen && (
        <GrammarLibraryWorkspace
          items={grammarLibrary}
          onClose={() => setGrammarOpen(false)}
        />
      )}
    </section>
  );
}

function ToggleButton({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={open ? `收起${label}` : `展开${label}`}
      aria-expanded={open}
      onClick={onClick}
      className="app-muted-text flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] transition-colors hover:bg-[var(--app-soft-bg)]"
    >
      <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
  );
}

function RowStatus({ status }: { status: string }) {
  const tone =
    status === "published"
      ? "var(--app-success)"
      : status === "draft"
        ? "var(--app-warm)"
        : "var(--app-muted)";
  const label = status === "published" ? "已发布" : status === "draft" ? "草稿" : "已归档";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium"
      style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
      {label}
    </span>
  );
}

function StatusSwitch({
  textbookId,
  status,
  onRefresh,
}: {
  textbookId: string;
  status: string;
  onRefresh: () => void;
}) {
  const [pending, setPending] = useState(false);
  const nextStatus = status === "published" ? "draft" : "published";

  async function run() {
    setPending(true);
    const result: ActionResult = await setTextbookStatusAction(textbookId, nextStatus);
    if (result.ok) onRefresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="app-muted-text font-medium underline-offset-2 transition hover:text-[var(--app-accent)] hover:underline disabled:opacity-50"
    >
      {pending ? (
        <LoaderCircle size={11} className="inline animate-spin" aria-hidden="true" />
      ) : status === "published" ? (
        "下架"
      ) : (
        "发布"
      )}
    </button>
  );
}

const EMPTY_LIBRARY_WORD = {
  ko: "",
  zh: "",
  pos: "",
  collocation: "",
  transcription: "",
};

export function VocabularyLibraryWorkspace({
  items,
  onClose,
}: {
  items: VocabularyLibraryItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_LIBRARY_WORD);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const textbookCount = items.filter((item) => item.source === "textbook").length;
  const customCount = items.length - textbookCount;

  async function submitAdd() {
    setPending(true);
    setMessage(null);
    const result = await addToolboxVocabularyAction(draft);
    if (result.ok) {
      setDraft(EMPTY_LIBRARY_WORD);
      setAddOpen(false);
      router.refresh();
    } else {
      setMessage(result.message ?? "添加失败");
    }
    setPending(false);
  }

  async function submitUpdate(itemId: string) {
    setPending(true);
    setMessage(null);
    const result = await updateToolboxVocabularyAction(itemId, draft);
    if (result.ok) {
      setEditId(null);
      setDraft(EMPTY_LIBRARY_WORD);
      router.refresh();
    } else {
      setMessage(result.message ?? "保存失败");
    }
    setPending(false);
  }

  async function remove(itemId: string) {
    setPending(true);
    setMessage(null);
    const result = await removeToolboxVocabularyAction(itemId);
    if (result.ok) router.refresh();
    else setMessage(result.message ?? "删除失败");
    setPending(false);
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 p-3 backdrop-blur-[1px] sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="练习词库工作窗"
    >
      <div
        className="course-editor-window app-card relative flex h-[min(800px,calc(100vh-24px))] w-full max-w-[1500px] flex-col overflow-hidden border shadow-2xl sm:h-[calc(100vh-40px)]"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div
          className="flex h-12 shrink-0 items-center justify-between border-b px-4"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div className="flex min-w-0 items-center gap-2 text-[11px]">
            <span className="truncate font-semibold">练习词库</span>
            <span className="app-muted-text shrink-0">
              · {items.length} 词（教材 {textbookCount} · 自定义 {customCount}）
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭练习词库"
            className="app-muted-text flex h-8 w-8 items-center justify-center rounded-[6px] border transition-colors hover:bg-[var(--app-soft-bg)]"
            style={{ borderColor: "var(--app-border)" }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {message && <Feedback message={message} />}

          {items.length === 0 && !addOpen && (
            <p className="app-muted-text py-8 text-center text-[12px]">
              词库还没有单词，点击"添加单词"开始录入。
            </p>
          )}

          {items.length > 0 && (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--app-border)" }}>
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>
                    <th className="w-[14%] px-3 py-2 font-medium">来源</th>
                    <th className="w-[5%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>#</th>
                    <th className="w-[17%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>韩语</th>
                    <th className="w-[17%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>中文</th>
                    <th className="w-[10%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>词性</th>
                    <th className="w-[16%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>搭配</th>
                    <th className="w-[13%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>音标</th>
                    <th className="w-[12%] border-l px-3 py-2 text-right font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, itemIndex) =>
                    editId === item.id ? (
                      <tr key={item.id} className="border-b last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                        <td colSpan={8} className="px-3 py-2">
                          <div className="grid gap-2 sm:grid-cols-5">
                            <LibraryWordInput value={draft.ko} onChange={(value) => setDraft({ ...draft, ko: value })} placeholder="韩语" />
                            <LibraryWordInput value={draft.zh} onChange={(value) => setDraft({ ...draft, zh: value })} placeholder="中文释义" />
                            <LibraryWordInput value={draft.pos} onChange={(value) => setDraft({ ...draft, pos: value })} placeholder="词性" />
                            <LibraryWordInput value={draft.collocation} onChange={(value) => setDraft({ ...draft, collocation: value })} placeholder="搭配" />
                            <LibraryWordInput value={draft.transcription} onChange={(value) => setDraft({ ...draft, transcription: value })} placeholder="音标（韩文）" />
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => submitUpdate(item.id)}
                              disabled={pending}
                              className="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                              style={{ backgroundColor: "var(--app-accent)" }}
                            >
                              {pending ? <LoaderCircle size={11} className="animate-spin" aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditId(null);
                                setDraft(EMPTY_LIBRARY_WORD);
                              }}
                              className="rounded-[6px] border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
                              style={{ borderColor: "var(--app-border)" }}
                            >
                              取消
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.id} className="border-b text-[11px] last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                        <td className="px-3 py-2.5">
                          <SourceBadge source={item.source} />
                        </td>
                        <td className="app-muted-text border-l px-3 py-2.5 font-mono text-[10px]" style={{ borderColor: "var(--app-border)" }}>{itemIndex + 1}</td>
                        <td className="border-l px-3 py-2.5 font-semibold" style={{ borderColor: "var(--app-border)" }}>{item.ko}</td>
                        <td className="border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>{item.zh}</td>
                        <td className="app-muted-text border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>{item.pos}</td>
                        <td className="border-l px-3 py-2.5 text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>{item.collocation}</td>
                        <td className="border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>{item.transcription}</td>
                        <td className="border-l px-3 py-2.5 text-right" style={{ borderColor: "var(--app-border)" }}>
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditId(item.id);
                                setDraft({
                                  ko: item.ko,
                                  zh: item.zh,
                                  pos: item.pos,
                                  collocation: item.collocation,
                                  transcription: item.transcription,
                                });
                              }}
                              className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-accent)]"
                              title="编辑"
                            >
                              <Pencil size={12} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(item.id)}
                              disabled={pending}
                              className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-warm)] disabled:opacity-50"
                              title="删除"
                            >
                              {pending ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {addOpen ? (
            <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--app-border)", background: "var(--app-soft-bg)" }}>
              <p className="text-[11px] font-semibold">新增单词（仅加入练习词库，不影响互动教材）</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-5">
                <LibraryWordInput value={draft.ko} onChange={(value) => setDraft({ ...draft, ko: value })} placeholder="韩语（必填）" />
                <LibraryWordInput value={draft.zh} onChange={(value) => setDraft({ ...draft, zh: value })} placeholder="中文释义" />
                <LibraryWordInput value={draft.pos} onChange={(value) => setDraft({ ...draft, pos: value })} placeholder="词性，如 명사" />
                <LibraryWordInput value={draft.collocation} onChange={(value) => setDraft({ ...draft, collocation: value })} placeholder="搭配用法" />
                <LibraryWordInput value={draft.transcription} onChange={(value) => setDraft({ ...draft, transcription: value })} placeholder="音标（韩文）" />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={submitAdd}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "var(--app-accent)" }}
                >
                  {pending ? <LoaderCircle size={11} className="animate-spin" aria-hidden="true" /> : <Plus size={11} aria-hidden="true" />}
                  添加
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setDraft(EMPTY_LIBRARY_WORD);
                  }}
                  className="rounded-[6px] border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="app-muted-text mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium transition hover:text-[var(--app-accent)]"
            >
              <Plus size={12} aria-hidden="true" />
              添加单词
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LibraryWordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[6px] border px-2.5 py-1.5 text-[11px] font-medium outline-none transition-colors focus:border-[var(--app-accent)]"
      style={{ borderColor: "var(--app-border)", background: "var(--app-card-bg)" }}
    />
  );
}

function SourceBadge({ source }: { source: "textbook" | "custom" }) {
  const tone = source === "textbook" ? "var(--app-secondary)" : "var(--app-accent)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-[8px] font-medium leading-none"
      style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)` }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: tone }} />
      {source === "textbook" ? "来自互动教材数据库" : "自定义"}
    </span>
  );
}

function Feedback({ message }: { message: string }) {
  return <p className="mt-1 text-[10px] font-medium" style={{ color: "var(--app-warm)" }}>{message}</p>;
}

type LibraryGrammarDraft = {
  title: string;
  meaning: string;
  cases: { batchim: string; conjugation: string }[];
  rows: { form: string; combination: string; audio: string }[];
  examples: { ko: string; zh: string; audio: string }[];
  caution: string;
};

const EMPTY_LIBRARY_GRAMMAR: LibraryGrammarDraft = {
  title: "",
  meaning: "",
  cases: [],
  rows: [],
  examples: [],
  caution: "",
};

export function GrammarLibraryWorkspace({
  items,
  onClose,
}: {
  items: GrammarLibraryItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LibraryGrammarDraft>(EMPTY_LIBRARY_GRAMMAR);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [audioPending, setAudioPending] = useState(false);

  function toDraft(item: GrammarLibraryItem): LibraryGrammarDraft {
    return {
      title: item.title,
      meaning: item.meaning,
      cases: item.cases.map((c) => ({ ...c })),
      rows: item.rows.map((r) => ({ ...r })),
      examples: item.examples.map((e) => ({ ...e })),
      caution: item.caution,
    };
  }

  async function playAudio(objectKey: string) {
    setAudioPending(true);
    const result = await getGrammarAudioSignedUrlAction(objectKey);
    setAudioPending(false);
    if (result.ok && result.signedUrl) {
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } else {
      setMessage(result.message ?? "获取播放地址失败");
    }
  }

  async function submitAdd() {
    setPending(true);
    setMessage(null);
    const result = await addGrammarLibraryAction(draft);
    if (result.ok) {
      setDraft(EMPTY_LIBRARY_GRAMMAR);
      setAddOpen(false);
      router.refresh();
    } else {
      setMessage(result.message ?? "添加失败");
    }
    setPending(false);
  }

  async function submitUpdate(itemId: string) {
    setPending(true);
    setMessage(null);
    const result = await updateGrammarLibraryAction(itemId, draft);
    if (result.ok) {
      setEditId(null);
      setDraft(EMPTY_LIBRARY_GRAMMAR);
      router.refresh();
    } else {
      setMessage(result.message ?? "保存失败");
    }
    setPending(false);
  }

  async function remove(itemId: string) {
    setPending(true);
    setMessage(null);
    const result = await removeGrammarLibraryAction(itemId);
    if (result.ok) router.refresh();
    else setMessage(result.message ?? "删除失败");
    setPending(false);
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 p-3 backdrop-blur-[1px] sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="语法库工作窗"
    >
      <div
        className="course-editor-window app-card relative flex h-[min(800px,calc(100vh-24px))] w-full max-w-[1500px] flex-col overflow-hidden border shadow-2xl sm:h-[calc(100vh-40px)]"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div
          className="flex h-12 shrink-0 items-center justify-between border-b px-4"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div className="flex min-w-0 items-center gap-2 text-[11px]">
            <span className="truncate font-semibold">语法库</span>
            <span className="app-muted-text shrink-0">· {items.length} 条语法</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭语法库"
            className="app-muted-text flex h-8 w-8 items-center justify-center rounded-[6px] border transition-colors hover:bg-[var(--app-soft-bg)]"
            style={{ borderColor: "var(--app-border)" }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {message && <Feedback message={message} />}

          {items.length === 0 && !addOpen && (
            <p className="app-muted-text py-8 text-center text-[12px]">
              语法库还没有内容，点击"添加语法点"开始录入。
            </p>
          )}

          {items.length > 0 && (
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--app-border)" }}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>
                    <th className="w-[4%] px-3 py-2 font-medium">#</th>
                    <th className="w-[10%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>语法</th>
                    <th className="w-[8%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>中文含义</th>
                    <th className="w-[7%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>尾字收音</th>
                    <th className="w-[10%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>情况说明</th>
                    <th className="w-[10%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>形态</th>
                    <th className="w-[9%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>组合</th>
                    <th className="w-[5%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>形态组合音频</th>
                    <th className="w-[10%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>例句展示</th>
                    <th className="w-[9%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>例句中文</th>
                    <th className="w-[5%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>例句展示语音</th>
                    <th className="w-[20%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>注意事项</th>
                    <th className="w-[5%] border-l px-2 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>来源</th>
                    <th className="w-[5%] border-l px-2 py-2 text-right font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) =>
                    editId === item.id ? (
                      <tr key={item.id} className="border-b last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                        <td colSpan={14} className="px-3 py-2">
                          <LibraryGrammarItemForm
                            draft={draft}
                            setDraft={setDraft}
                            pending={pending}
                            submitLabel="保存修改"
                            onSubmit={() => void submitUpdate(item.id)}
                            onCancel={() => {
                              setEditId(null);
                              setDraft(EMPTY_LIBRARY_GRAMMAR);
                            }}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.id} className="border-b align-top text-[11px] last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                        <td className="app-muted-text px-2 py-2.5 font-mono text-[10px]">{index + 1}</td>
                        <td className="border-l px-2 py-2.5 font-semibold" style={{ borderColor: "var(--app-border)" }}>{item.title}</td>
                        <td className="border-l px-2 py-2.5" style={{ borderColor: "var(--app-border)" }}>{item.meaning}</td>
                        <td className="border-l px-2 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
                          {item.cases.map((caseRow, caseIndex) => (
                            <p
                              key={caseIndex}
                              className="py-1"
                              style={caseIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                            >
                              {caseRow.batchim}
                            </p>
                          ))}
                        </td>
                        <td className="border-l px-2 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
                          {item.cases.map((caseRow, caseIndex) => (
                            <p
                              key={caseIndex}
                              className="py-1"
                              style={caseIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                            >
                              {caseRow.conjugation}
                            </p>
                          ))}
                        </td>
                        <td className="border-l px-2 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
                          {item.rows.map((row, rowIndex) => (
                            <p
                              key={rowIndex}
                              className="py-1"
                              style={rowIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                            >
                              {row.form}
                            </p>
                          ))}
                        </td>
                        <td className="border-l px-2 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
                          {item.rows.map((row, rowIndex) => (
                            <p
                              key={rowIndex}
                              className="py-1"
                              style={rowIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                            >
                              {row.combination}
                            </p>
                          ))}
                        </td>
                        <td className="border-l px-2 py-2.5" style={{ borderColor: "var(--app-border)" }}>
                          {item.rows.length === 0 && <span className="app-muted-text">—</span>}
                          {item.rows.map((row, rowIndex) =>
                            row.audio ? (
                              <p
                                key={rowIndex}
                                className="flex items-center gap-1 py-1"
                                style={rowIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                              >
                                <Volume2 size={11} aria-hidden="true" style={{ color: "var(--app-accent)" }} />
                                <span className="max-w-[110px] truncate text-[10px] font-medium" title={row.audio}>{row.audio.split("/").pop()}</span>
                                <button
                                  type="button"
                                  onClick={() => void playAudio(row.audio)}
                                  disabled={audioPending}
                                  className="app-muted-text shrink-0 rounded-[4px] px-1 py-0.5 text-[10px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-accent)] disabled:opacity-50"
                                >
                                  {audioPending ? "…" : "试听"}
                                </button>
                              </p>
                            ) : (
                              <p
                                key={rowIndex}
                                className="app-muted-text py-1 text-[10px]"
                                style={rowIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                              >
                                —
                              </p>
                            )
                          )}
                        </td>
                        <td className="border-l px-2 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
                          {item.examples.map((example, exampleIndex) => (
                            <p
                              key={exampleIndex}
                              className="py-1"
                              style={exampleIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                            >
                              <span className="font-semibold">{example.ko}</span>
                            </p>
                          ))}
                        </td>
                        <td className="border-l px-2 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
                          {item.examples.map((example, exampleIndex) => (
                            <p
                              key={exampleIndex}
                              className="py-1"
                              style={exampleIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                            >
                              <span className="app-muted-text">{example.zh}</span>
                            </p>
                          ))}
                        </td>
                        <td className="border-l px-2 py-2.5" style={{ borderColor: "var(--app-border)" }}>
                          {item.examples.length === 0 && <span className="app-muted-text">—</span>}
                          {item.examples.map((example, exampleIndex) =>
                            example.audio ? (
                              <p
                                key={exampleIndex}
                                className="flex items-center gap-1 py-1"
                                style={exampleIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                              >
                                <Volume2 size={11} aria-hidden="true" style={{ color: "var(--app-accent)" }} />
                                <span className="max-w-[110px] truncate text-[10px] font-medium" title={example.audio}>{example.audio.split("/").pop()}</span>
                                <button
                                  type="button"
                                  onClick={() => void playAudio(example.audio)}
                                  disabled={audioPending}
                                  className="app-muted-text shrink-0 rounded-[4px] px-1 py-0.5 text-[10px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-accent)] disabled:opacity-50"
                                >
                                  {audioPending ? "…" : "试听"}
                                </button>
                              </p>
                            ) : (
                              <p
                                key={exampleIndex}
                                className="app-muted-text py-1 text-[10px]"
                                style={exampleIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
                              >
                                —
                              </p>
                            )
                          )}
                        </td>
                        <td className="border-l px-2 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
                          {item.caution ? (
                            <p style={{ color: "var(--app-warm)" }}>{item.caution}</p>
                          ) : (
                            <span className="app-muted-text">—</span>
                          )}
                        </td>
                        <td className="border-l px-2 py-2.5" style={{ borderColor: "var(--app-border)" }}>
                          <SourceBadge source={item.source} />
                        </td>
                        <td className="border-l px-2 py-2.5 text-right" style={{ borderColor: "var(--app-border)" }}>
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditId(item.id);
                                setDraft(toDraft(item));
                              }}
                              className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-accent)]"
                              title="编辑"
                            >
                              <Pencil size={12} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void remove(item.id)}
                              disabled={pending}
                              className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-warm)] disabled:opacity-50"
                              title="删除"
                            >
                              {pending ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {addOpen ? (
            <LibraryGrammarItemForm
              draft={draft}
              setDraft={setDraft}
              pending={pending}
              submitLabel="添加"
              onSubmit={() => void submitAdd()}
              onCancel={() => {
                setAddOpen(false);
                setDraft(EMPTY_LIBRARY_GRAMMAR);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="app-muted-text inline-flex items-center gap-1.5 text-[11px] font-medium transition hover:text-[var(--app-accent)]"
            >
              <Plus size={12} aria-hidden="true" />
              添加语法点
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const LIBRARY_AUDIO_SLUG = "growth-toolbox";

function LibraryGrammarItemForm({
  draft,
  setDraft,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: LibraryGrammarDraft;
  setDraft: React.Dispatch<React.SetStateAction<LibraryGrammarDraft>>;
  pending: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const inputClass =
    "w-full rounded-[6px] border px-2.5 py-1.5 text-[11px] font-medium outline-none transition-colors focus:border-[var(--app-accent)]";
  const labelClass = "block text-[10px] font-semibold app-muted-text";

  function patch(patch: Partial<LibraryGrammarDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }
  function updateCase(index: number, patchData: { batchim?: string; conjugation?: string }) {
    setDraft((current) => ({
      ...current,
      cases: current.cases.map((row, i) => (i === index ? { ...row, ...patchData } : row)),
    }));
  }
  function updateRow(index: number, patchData: Partial<{ form: string; combination: string; audio: string }>) {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, i) => (i === index ? { ...row, ...patchData } : row)),
    }));
  }
  function updateExample(index: number, patchData: Partial<{ ko: string; zh: string; audio: string }>) {
    setDraft((current) => ({
      ...current,
      examples: current.examples.map((row, i) => (i === index ? { ...row, ...patchData } : row)),
    }));
  }

  return (
    <div
      className="rounded-xl border p-3.5"
      style={{ borderColor: "var(--app-border)", background: "var(--app-soft-bg)" }}
    >
      <div className="space-y-2">
        <div>
          <label className={labelClass}>语法名称（必填）</label>
          <input type="text" value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="如 N이에요／예요" className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label className={labelClass}>中文含义</label>
          <input type="text" value={draft.meaning} onChange={(event) => patch({ meaning: event.target.value })} placeholder="如 “是……”" className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label className={labelClass}>收音情况（每行一个尾字收音 + 情况说明）</label>
          <div className="mt-1 overflow-hidden rounded-[6px] border" style={{ borderColor: "var(--app-border)" }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>
                  <th className="w-[5%] px-2 py-1.5 font-medium">#</th>
                  <th className="w-[44%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>尾字收音</th>
                  <th className="w-[45%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>情况说明</th>
                  <th className="w-[6%] border-l px-2 py-1.5 text-right font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {draft.cases.length === 0 && (
                  <tr>
                    <td colSpan={4} className="app-muted-text px-3 py-3 text-center text-[10px]">还没有收音情况行，点击下方"添加一行"。</td>
                  </tr>
                )}
                {draft.cases.map((caseRow, caseIndex) => (
                  <tr key={caseIndex} className="border-b align-top last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                    <td className="app-muted-text px-2 py-2 font-mono text-[10px]">{caseIndex + 1}</td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input type="text" value={caseRow.batchim} onChange={(event) => updateCase(caseIndex, { batchim: event.target.value })} placeholder="如 无收音" className={inputClass} />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input type="text" value={caseRow.conjugation} onChange={(event) => updateCase(caseIndex, { conjugation: event.target.value })} placeholder="如 无收音 → 예요" className={inputClass} />
                    </td>
                    <td className="border-l px-2 py-2 text-right" style={{ borderColor: "var(--app-border)" }}>
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, cases: current.cases.filter((_, i) => i !== caseIndex) }))}
                        title="删除这一行"
                        className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-warm)]"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setDraft((current) => ({ ...current, cases: [...current.cases, { batchim: "", conjugation: "" }] }))}
            className="app-muted-text mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium transition hover:text-[var(--app-accent)]"
          >
            <Plus size={12} aria-hidden="true" />
            添加一行
          </button>
        </div>
        <div>
          <label className={labelClass}>形态组合（每行一个形态 + 组合结果，可各自配音频）</label>
          <div className="mt-1 overflow-hidden rounded-[6px] border" style={{ borderColor: "var(--app-border)" }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>
                  <th className="w-[5%] px-2 py-1.5 font-medium">#</th>
                  <th className="w-[26%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>形态</th>
                  <th className="w-[26%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>组合</th>
                  <th className="w-[37%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>音频</th>
                  <th className="w-[6%] border-l px-2 py-1.5 text-right font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {draft.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="app-muted-text px-3 py-3 text-center text-[10px]">还没有形态组合行，点击下方"添加一行"。</td>
                  </tr>
                )}
                {draft.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b align-top last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                    <td className="app-muted-text px-2 py-2 font-mono text-[10px]">{rowIndex + 1}</td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input type="text" value={row.form} onChange={(event) => updateRow(rowIndex, { form: event.target.value })} placeholder="如 민지 + 예요" className={inputClass} />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input type="text" value={row.combination} onChange={(event) => updateRow(rowIndex, { combination: event.target.value })} placeholder="如 민지예요" className={inputClass} />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <LibraryGrammarRowAudioField value={row.audio} onChange={(objectKey) => updateRow(rowIndex, { audio: objectKey })} />
                    </td>
                    <td className="border-l px-2 py-2 text-right" style={{ borderColor: "var(--app-border)" }}>
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, rows: current.rows.filter((_, i) => i !== rowIndex) }))}
                        title="删除这一行"
                        className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-warm)]"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setDraft((current) => ({ ...current, rows: [...current.rows, { form: "", combination: "", audio: "" }] }))}
            className="app-muted-text mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium transition hover:text-[var(--app-accent)]"
          >
            <Plus size={12} aria-hidden="true" />
            添加一行
          </button>
        </div>
        <div>
          <label className={labelClass}>例句展示（每行一例：韩语 + 中文，可各自配语音）</label>
          <div className="mt-1 overflow-hidden rounded-[6px] border" style={{ borderColor: "var(--app-border)" }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>
                  <th className="w-[5%] px-2 py-1.5 font-medium">#</th>
                  <th className="w-[26%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>韩语</th>
                  <th className="w-[26%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>中文</th>
                  <th className="w-[37%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>语音</th>
                  <th className="w-[6%] border-l px-2 py-1.5 text-right font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {draft.examples.length === 0 && (
                  <tr>
                    <td colSpan={5} className="app-muted-text px-3 py-3 text-center text-[10px]">还没有例句，点击下方"添加一行"。</td>
                  </tr>
                )}
                {draft.examples.map((example, exampleIndex) => (
                  <tr key={exampleIndex} className="border-b align-top last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                    <td className="app-muted-text px-2 py-2 font-mono text-[10px]">{exampleIndex + 1}</td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input type="text" value={example.ko} onChange={(event) => updateExample(exampleIndex, { ko: event.target.value })} placeholder="如 저는 학생이에요." className={inputClass} />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input type="text" value={example.zh} onChange={(event) => updateExample(exampleIndex, { zh: event.target.value })} placeholder="如 我是学生。" className={inputClass} />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <LibraryGrammarRowAudioField value={example.audio} onChange={(objectKey) => updateExample(exampleIndex, { audio: objectKey })} />
                    </td>
                    <td className="border-l px-2 py-2 text-right" style={{ borderColor: "var(--app-border)" }}>
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, examples: current.examples.filter((_, i) => i !== exampleIndex) }))}
                        title="删除这一行"
                        className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-warm)]"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setDraft((current) => ({ ...current, examples: [...current.examples, { ko: "", zh: "", audio: "" }] }))}
            className="app-muted-text mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium transition hover:text-[var(--app-accent)]"
          >
            <Plus size={12} aria-hidden="true" />
            添加一行
          </button>
        </div>
        <div>
          <label className={labelClass}>注意事项（可选）</label>
          <input type="text" value={draft.caution} onChange={(event) => patch({ caution: event.target.value })} placeholder="如：书写时名词和이에요/예요之间不能有空格" className={`${inputClass} mt-1`} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          {pending ? <LoaderCircle size={11} className="animate-spin" aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[6px] border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
          style={{ borderColor: "var(--app-border)" }}
        >
          取消
        </button>
      </div>
    </div>
  );
}

/** 语法库行内音频上传（存 Cloudflare R2，value 为 objectKey） */
function LibraryGrammarRowAudioField({
  value,
  onChange,
}: {
  value: string;
  onChange: (objectKey: string) => void;
}) {
  const inputId = useId();
  const [status, setStatus] = useState<"idle" | "uploading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setStatus("uploading");
    setMessage("正在上传音频到 R2…");
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
      setPreviewUrl(confirmed.signedUrl);
      setStatus("ready");
      setMessage("已上传，保存后生效");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "上传失败，请稍后重试");
    }
  }

  async function preview() {
    const result = await getGrammarAudioSignedUrlAction(value);
    if (result.ok && result.signedUrl) setPreviewUrl(result.signedUrl);
    else setMessage(result.message ?? "获取播放地址失败");
  }

  return (
    <div>
      {value ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="flex min-w-0 flex-1 items-center gap-1 text-[10px] font-medium">
              <Volume2 size={11} aria-hidden="true" style={{ color: "var(--app-accent)" }} />
              <span className="truncate" title={value}>{value.split("/").pop()}</span>
            </span>
            <button
              type="button"
              onClick={() => void preview()}
              className="app-muted-text shrink-0 rounded-[5px] border px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
              style={{ borderColor: "var(--app-border)" }}
            >
              试听
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setPreviewUrl("");
                setMessage("");
              }}
              className="app-muted-text shrink-0 rounded-[5px] border px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-warm)]"
              style={{ borderColor: "var(--app-border)" }}
            >
              移除
            </button>
          </div>
          {previewUrl && (
            <audio controls src={previewUrl} preload="none" className="h-6 w-full rounded-[6px]" />
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[6px] border border-dashed px-2 py-1.5 text-[10px] font-medium transition-colors hover:bg-[var(--app-soft-bg)]"
          style={{ borderColor: "var(--app-border)" }}
        >
          {status === "uploading" ? <LoaderCircle size={11} className="animate-spin" aria-hidden="true" /> : <Volume2 size={11} aria-hidden="true" />}
          {status === "uploading" ? "上传中…" : "点击上传音频"}
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept="audio/*"
        className="sr-only"
        disabled={status === "uploading"}
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      {message && (
        <p className="mt-0.5 text-[9px] leading-4" style={{ color: status === "error" ? "var(--app-warm)" : "var(--app-muted)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
