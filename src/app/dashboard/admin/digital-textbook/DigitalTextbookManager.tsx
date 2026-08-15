"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  VocabularyLibraryWorkspace,
  GrammarLibraryWorkspace,
  type GrammarLibraryItem,
  type VocabularyLibraryItem,
} from "../growth-toolbox/GrowthToolboxManager";

import {
  addGrammarItemAction,
  addVocabularyWordAction,
  confirmGrammarAudioUploadAction,
  createGrammarAudioUploadUrlAction,
  getGrammarAudioSignedUrlAction,
  removeGrammarItemAction,
  removeVocabularyWordAction,
  setTextbookStatusAction,
  updateGrammarItemAction,
  updateVocabularyWordAction,
  type ActionResult,
  type GrammarExample,
  type GrammarItem,
  type VocabularyWord,
  type GrammarCaseRow,
  type GrammarFormRow,
} from "./actions";

export type AdminNode = { id: string; vocabulary: VocabularyWord[] };
export type AdminGrammarNode = { id: string; items: GrammarItem[] };
export type AdminChapter = {
  id: string;
  number: number;
  slug: string;
  status: string;
  textbookSlug: string;
  nodes: AdminNode[];
  grammarNodes: AdminGrammarNode[];
};
export type AdminTextbook = {
  id: string;
  slug: string;
  title: string;
  status: string;
  chapters: AdminChapter[];
};
export type AdminLesson = {
  id: string;
  title: string;
  textbooks: AdminTextbook[];
};
export type AdminCourse = {
  id: string;
  title: string;
  lessons: AdminLesson[];
};

const EMPTY_WORD: VocabularyWord = { ko: "", zh: "", pos: "", collocation: "", transcription: "" };

type FlatRow =
  | { kind: "course"; course: AdminCourse; depth: 0 }
  | { kind: "lesson"; course: AdminCourse; lesson: AdminLesson; depth: 1 }
  | { kind: "chapter"; course: AdminCourse; lesson: AdminLesson; textbook: AdminTextbook; chapter: AdminChapter; depth: 2 };

function courseStats(course: AdminCourse) {
  let chapters = 0;
  let words = 0;
  for (const lesson of course.lessons) {
    for (const textbook of lesson.textbooks) {
      chapters += textbook.chapters.length;
      for (const chapter of textbook.chapters) {
        for (const node of chapter.nodes) words += node.vocabulary.length;
      }
    }
  }
  return { chapters, words };
}

function lessonStats(lesson: AdminLesson) {
  let chapters = 0;
  let words = 0;
  for (const textbook of lesson.textbooks) {
    chapters += textbook.chapters.length;
    for (const chapter of textbook.chapters) {
      for (const node of chapter.nodes) words += node.vocabulary.length;
    }
  }
  return { chapters, words };
}

function chapterWords(chapter: AdminChapter): number {
  return chapter.nodes.reduce((sum, node) => sum + node.vocabulary.length, 0);
}

export function DigitalTextbookManager({
  courses,
  vocabularyLibrary,
  grammarLibrary,
}: {
  courses: AdminCourse[];
  vocabularyLibrary: VocabularyLibraryItem[];
  grammarLibrary: GrammarLibraryItem[];
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem("dtb-course-tree-collapsed");
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // 忽略读取失败
    }
    return new Set();
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("dtb-course-tree-collapsed", JSON.stringify([...collapsed]));
    } catch {
      // 忽略写入失败
    }
  }, [collapsed]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeChapter, setActiveChapter] = useState<AdminChapter | null>(null);
  const [activeGrammarChapter, setActiveGrammarChapter] = useState<AdminChapter | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [grammarOpen, setGrammarOpen] = useState(false);

  const rows = useMemo<FlatRow[]>(() => {
    const normalized = query.trim().toLowerCase();
    const filtering = Boolean(normalized) || statusFilter !== "all";

    const all: FlatRow[] = [];
    for (const course of courses) {
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
    const collapsedAncestorDepths: number[] = [];
    for (const row of all) {
      while (
        collapsedAncestorDepths.length > 0 &&
        collapsedAncestorDepths[collapsedAncestorDepths.length - 1] >= row.depth
      ) {
        collapsedAncestorDepths.pop();
      }
      const hidden = collapsedAncestorDepths.length > 0;
      if (row.kind === "course" && collapsed.has(`c:${row.course.id}`)) {
        collapsedAncestorDepths.push(row.depth);
      } else if (row.kind === "lesson" && collapsed.has(`l:${row.lesson.id}`)) {
        collapsedAncestorDepths.push(row.depth);
      }
      if (!hidden) result.push(row);
    }
    return result;
  }, [collapsed, query, statusFilter, courses]);

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
                            label={`${row.course.title}`}
                          />
                          <span className="min-w-0 truncate font-semibold">{row.course.title}</span>
                        </div>
                      </td>
                      <td className="app-muted-text px-3 py-2.5 text-[10px]">—</td>
                      <td className="app-muted-text px-3 py-2.5 font-mono text-[10px]">{stats.chapters}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px]">{stats.words}</td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-4 py-2.5 text-right">—</td>
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
                            label={`${row.lesson.title}`}
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
                          <StatusSwitch textbookId={textbook.id} status={textbook.status} onRefresh={() => router.refresh()} />
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
                    <td className="px-3 py-2 font-mono text-[10px]">{chapterWords(row.chapter)}</td>
                    <td className="px-3 py-2">
                      <RowStatus status={row.chapter.status} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveChapter(row.chapter)}
                          className="app-muted-text font-medium underline-offset-2 transition hover:text-[var(--app-accent)] hover:underline"
                        >
                          词汇编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveGrammarChapter(row.chapter)}
                          className="app-muted-text font-medium underline-offset-2 transition hover:text-[var(--app-accent)] hover:underline"
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

      {activeChapter && (
        <VocabularyWorkspace chapter={activeChapter} onClose={() => setActiveChapter(null)} />
      )}
      {activeGrammarChapter && (
        <GrammarWorkspace chapter={activeGrammarChapter} onClose={() => setActiveGrammarChapter(null)} />
      )}
      {libraryOpen && (
        <VocabularyLibraryWorkspace items={vocabularyLibrary} onClose={() => setLibraryOpen(false)} />
      )}
      {grammarOpen && (
        <GrammarLibraryWorkspace items={grammarLibrary} onClose={() => setGrammarOpen(false)} />
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

export function VocabularyWorkspace({
  chapter,
  onClose,
}: {
  chapter: AdminChapter;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 p-3 backdrop-blur-[1px] sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`第 ${chapter.number} 章词汇编辑工作窗`}
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
            <span className="truncate font-semibold">第 {chapter.number} 章 · {chapter.slug}</span>
            <span className="app-muted-text shrink-0">· 词汇编辑工作窗</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭编辑工作窗"
            className="app-muted-text flex h-8 w-8 items-center justify-center rounded-[6px] border transition-colors hover:bg-[var(--app-soft-bg)]"
            style={{ borderColor: "var(--app-border)" }}
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {chapter.nodes.length === 0 ? (
            <p className="app-muted-text py-10 text-center text-[12px]">本章还没有词汇模块节点。</p>
          ) : (
            <div className="space-y-5">
              {chapter.nodes.map((node) => (
                <NodeVocabularyBlock key={node.id} nodeId={node.id} words={node.vocabulary} onRefresh={() => router.refresh()} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NodeVocabularyBlock({
  nodeId,
  words,
  onRefresh,
}: {
  nodeId: string;
  words: VocabularyWord[];
  onRefresh: () => void;
}) {
  return (
    <div>
      {words.length > 0 && (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--app-border)" }}>
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>
                <th className="w-[14%] px-3 py-2 font-medium">来源</th>
                <th className="w-[4%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>#</th>
                <th className="w-[19%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>韩语</th>
                <th className="w-[19%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>中文</th>
                <th className="w-[10%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>词性</th>
                <th className="w-[17%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>搭配</th>
                <th className="w-[14%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>音标</th>
                <th className="w-[10%] border-l px-3 py-2 text-right font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {words.map((word, index) => (
                <WordRow
                  key={`${nodeId}-${index}`}
                  nodeId={nodeId}
                  index={index}
                  word={word}
                  onRefresh={onRefresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {words.length === 0 && (
        <p className="app-muted-text py-3 text-center text-xs font-medium">这个节点还没有词汇。</p>
      )}
      <AddVocabularyForm nodeId={nodeId} onRefresh={onRefresh} />
    </div>
  );
}

function WordRow({
  nodeId,
  index,
  word,
  onRefresh,
}: {
  nodeId: string;
  index: number;
  word: VocabularyWord;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VocabularyWord>(word);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setMessage(null);
    const result = await updateVocabularyWordAction(nodeId, index, draft);
    if (result.ok) {
      setEditing(false);
      onRefresh();
    } else {
      setMessage(result.message ?? "保存失败");
    }
    setPending(false);
  }

  async function remove() {
    setPending(true);
    setMessage(null);
    const result = await removeVocabularyWordAction(nodeId, index);
    if (result.ok) onRefresh();
    else setMessage(result.message ?? "删除失败");
    setPending(false);
  }

  if (editing) {
    return (
      <tr className="border-b last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
        <td colSpan={8} className="px-3 py-2">
          <div className="grid gap-2 sm:grid-cols-5">
            <WordInput value={draft.ko} onChange={(value) => setDraft({ ...draft, ko: value })} placeholder="韩语" />
            <WordInput value={draft.zh} onChange={(value) => setDraft({ ...draft, zh: value })} placeholder="中文释义" />
            <WordInput value={draft.pos} onChange={(value) => setDraft({ ...draft, pos: value })} placeholder="词性" />
            <WordInput value={draft.collocation} onChange={(value) => setDraft({ ...draft, collocation: value })} placeholder="搭配" />
            <WordInput value={draft.transcription} onChange={(value) => setDraft({ ...draft, transcription: value })} placeholder="音标（韩文）" />
          </div>
          {message && <Feedback message={message} />}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={save}
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
                setDraft(word);
                setEditing(false);
              }}
              className="rounded-[6px] border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
              style={{ borderColor: "var(--app-border)" }}
            >
              取消
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b text-[11px] last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
      <td className="px-3 py-2.5">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-[8px] font-medium"
          style={{
            color: "var(--app-secondary)",
            backgroundColor: "color-mix(in srgb, var(--app-secondary) 12%, transparent)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--app-secondary)" }} />
          来自互动教材数据库
        </span>
      </td>
      <td className="app-muted-text border-l px-3 py-2.5 font-mono text-[10px]" style={{ borderColor: "var(--app-border)" }}>{index + 1}</td>
      <td className="border-l px-3 py-2.5 font-semibold" style={{ borderColor: "var(--app-border)" }}>{word.ko}</td>
      <td className="border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>{word.zh}</td>
      <td className="app-muted-text border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>{word.pos}</td>
      <td className="border-l px-3 py-2.5 text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>{word.collocation}</td>
      <td className="border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>{word.transcription}</td>
      <td className="border-l px-3 py-2.5 text-right" style={{ borderColor: "var(--app-border)" }}>
        <div className="inline-flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-accent)]"
            title="编辑"
          >
            <Pencil size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-warm)] disabled:opacity-50"
            title="删除"
          >
            {pending ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function WordInput({
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

function AddVocabularyForm({ nodeId, onRefresh }: { nodeId: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState<VocabularyWord>(EMPTY_WORD);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setMessage(null);
    const result = await addVocabularyWordAction(nodeId, word);
    if (result.ok) {
      setWord(EMPTY_WORD);
      setOpen(false);
      onRefresh();
    } else {
      setMessage(result.message ?? "添加失败");
    }
    setPending(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="app-muted-text mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium transition hover:text-[var(--app-accent)]"
      >
        <Plus size={12} aria-hidden="true" />
        添加词汇
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "var(--app-border)", background: "var(--app-soft-bg)" }}>
      <p className="text-[11px] font-semibold">新增词汇</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-5">
        <WordInput value={word.ko} onChange={(value) => setWord({ ...word, ko: value })} placeholder="韩语（必填）" />
        <WordInput value={word.zh} onChange={(value) => setWord({ ...word, zh: value })} placeholder="中文释义" />
        <WordInput value={word.pos} onChange={(value) => setWord({ ...word, pos: value })} placeholder="词性，如 표현" />
        <WordInput value={word.collocation} onChange={(value) => setWord({ ...word, collocation: value })} placeholder="搭配用法" />
        <WordInput value={word.transcription} onChange={(value) => setWord({ ...word, transcription: value })} placeholder="音标（韩文）" />
      </div>
      {message && <Feedback message={message} />}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          {pending ? <LoaderCircle size={11} className="animate-spin" aria-hidden="true" /> : <Plus size={11} aria-hidden="true" />}
          添加
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-[6px] border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
          style={{ borderColor: "var(--app-border)" }}
        >
          取消
        </button>
      </div>
    </div>
  );
}

function Feedback({ message }: { message: string }) {
  return <p className="mt-1 text-[10px] font-medium" style={{ color: "var(--app-warm)" }}>{message}</p>;
}

function GrammarWorkspace({
  chapter,
  onClose,
}: {
  chapter: AdminChapter;
  onClose: () => void;
}) {
  const router = useRouter();
  const nodes = chapter.grammarNodes;
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 p-3 backdrop-blur-[1px] sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`第 ${chapter.number} 章语法编辑工作窗`}
    >
      <div
        className="course-editor-window app-card relative flex h-[min(820px,calc(100vh-24px))] w-full max-w-[1500px] flex-col overflow-hidden border shadow-2xl sm:h-[calc(100vh-40px)]"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div
          className="flex h-12 shrink-0 items-center justify-between border-b px-4"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div className="flex min-w-0 items-center gap-2 text-[11px]">
            <span className="truncate font-semibold">第 {chapter.number} 章 · {chapter.slug}</span>
            <span className="app-muted-text shrink-0">· 语法编辑工作窗</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭编辑工作窗"
            className="app-muted-text flex h-8 w-8 items-center justify-center rounded-[6px] border transition-colors hover:bg-[var(--app-soft-bg)]"
            style={{ borderColor: "var(--app-border)" }}
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {nodes.length === 0 ? (
            <p className="app-muted-text py-6 text-center text-[12px]">
              本章还没有语法数据，点击下方的“添加语法点”创建第一条（会自动创建语法模块）。
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--app-border)" }}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>
                    <th className="w-[4%] px-3 py-2 font-medium">#</th>
                    <th className="w-[10%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>语法</th>
                    <th className="w-[8%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>中文含义</th>
                    <th className="w-[7%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>尾字收音</th>
                    <th className="w-[10%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>情况说明</th>
                    <th className="w-[10%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>形态</th>
                    <th className="w-[9%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>组合</th>
                    <th className="w-[5%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>形态组合音频</th>
                    <th className="w-[10%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>例句展示</th>
                    <th className="w-[9%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>例句中文</th>
                    <th className="w-[5%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>例句展示语音</th>
                    <th className="w-[20%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>注意事项</th>
                    <th className="w-[5%] border-l px-3 py-2 font-medium" style={{ borderColor: "var(--app-border)" }}>来源</th>
                    <th className="w-[5%] border-l px-3 py-2 text-right font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) =>
                    node.items.length === 0 ? (
                      <tr key={node.id}>
                        <td colSpan={14} className="app-muted-text px-3 py-3 text-center text-[10px]">
                          这个语法节点还没有内容。
                        </td>
                      </tr>
                    ) : (
                      node.items.map((item, index) => (
                        <GrammarItemRow
                          key={`${node.id}-${index}`}
                          chapterId={chapter.id}
                          textbookSlug={chapter.textbookSlug}
                          chapterNumber={chapter.number}
                          index={index}
                          item={item}
                          onRefresh={() => router.refresh()}
                        />
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
          {addOpen ? (
            <GrammarItemForm
              chapterId={chapter.id}
              textbookSlug={chapter.textbookSlug}
              chapterNumber={chapter.number}
              onCancel={() => setAddOpen(false)}
              onRefresh={() => router.refresh()}
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

function GrammarItemRow({
  chapterId,
  textbookSlug,
  chapterNumber,
  index,
  item,
  onRefresh,
}: {
  chapterId: string;
  textbookSlug: string;
  chapterNumber: number;
  index: number;
  item: GrammarItem;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [audioPending, setAudioPending] = useState(false);

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

  async function remove() {
    setPending(true);
    setMessage(null);
    const result = await removeGrammarItemAction(chapterId, index);
    if (result.ok) onRefresh();
    else setMessage(result.message ?? "删除失败");
    setPending(false);
  }

  if (editing) {
    return (
      <tr className="border-b last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
        <td colSpan={14} className="px-3 py-2">
          {message && <Feedback message={message} />}
          <GrammarItemForm
            chapterId={chapterId}
            textbookSlug={textbookSlug}
            chapterNumber={chapterNumber}
            index={index}
            initial={item}
            onCancel={() => setEditing(false)}
            onRefresh={onRefresh}
            submitLabel="保存修改"
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b align-top text-[11px] last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
      <td className="app-muted-text px-3 py-2.5 font-mono text-[10px]">{index + 1}</td>
      <td className="px-3 py-2.5 font-semibold">{item.title}</td>
      <td className="border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>{item.meaning}</td>
      <td className="border-l px-3 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
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
      <td className="border-l px-3 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
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
      <td className="border-l px-3 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
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
      <td className="border-l px-3 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
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
      <td className="border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>
        {item.rows.length === 0 && <span className="app-muted-text">—</span>}
        {item.rows.map((row, rowIndex) =>
          row.audio ? (
            <p
              key={rowIndex}
              className="flex items-center gap-1.5 py-1"
              style={rowIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
            >
              <Volume2 size={11} aria-hidden="true" style={{ color: "var(--app-accent)" }} />
              <span className="max-w-[130px] truncate text-[10px] font-medium" title={row.audio}>
                {row.audio.split("/").pop()}
              </span>
              <button
                type="button"
                onClick={() => void playAudio(row.audio)}
                disabled={audioPending}
                className="app-muted-text shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-accent)] disabled:opacity-50"
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
      <td className="border-l px-3 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
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
      <td className="border-l px-3 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
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
      <td className="border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>
        {item.examples.length === 0 && <span className="app-muted-text">—</span>}
        {item.examples.map((example, exampleIndex) =>
          example.audio ? (
            <p
              key={exampleIndex}
              className="flex items-center gap-1.5 py-1"
              style={exampleIndex > 0 ? { borderTop: "1px solid var(--app-border)", paddingTop: 4 } : undefined}
            >
              <Volume2 size={11} aria-hidden="true" style={{ color: "var(--app-accent)" }} />
              <span className="max-w-[130px] truncate text-[10px] font-medium" title={example.audio}>
                {example.audio.split("/").pop()}
              </span>
              <button
                type="button"
                onClick={() => void playAudio(example.audio)}
                disabled={audioPending}
                className="app-muted-text shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-accent)] disabled:opacity-50"
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
      <td className="border-l px-3 py-2.5 leading-5" style={{ borderColor: "var(--app-border)" }}>
        {item.caution ? (
          <p style={{ color: "var(--app-warm)" }}>{item.caution}</p>
        ) : (
          <span className="app-muted-text">—</span>
        )}
      </td>
      <td className="border-l px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>
        <span
          className="inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-[8px] font-medium"
          style={{
            color: "var(--app-secondary)",
            backgroundColor: "color-mix(in srgb, var(--app-secondary) 12%, transparent)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--app-secondary)" }} />
          来自互动教材数据库
        </span>
      </td>
      <td className="border-l px-3 py-2.5 text-right" style={{ borderColor: "var(--app-border)" }}>
        <div className="inline-flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-accent)]"
            title="编辑"
          >
            <Pencil size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="app-muted-text rounded-[5px] p-1.5 transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-warm)] disabled:opacity-50"
            title="删除"
          >
            {pending ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function GrammarItemForm({
  chapterId,
  textbookSlug,
  chapterNumber,
  index,
  initial,
  onCancel,
  onRefresh,
  submitLabel = "添加语法点",
}: {
  chapterId: string;
  textbookSlug: string;
  chapterNumber: number;
  index?: number;
  initial?: GrammarItem;
  onCancel?: () => void;
  onRefresh: () => void;
  submitLabel?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [meaning, setMeaning] = useState(initial?.meaning ?? "");
  const [cases, setCases] = useState<GrammarCaseRow[]>(
    () => (initial?.cases ?? []).map((row) => ({ ...row }))
  );

  function updateCase(caseIndex: number, patch: Partial<GrammarCaseRow>) {
    setCases((current) => current.map((row, index) => (index === caseIndex ? { ...row, ...patch } : row)));
  }
  function removeCase(caseIndex: number) {
    setCases((current) => current.filter((_, index) => index !== caseIndex));
  }
  function addCase() {
    setCases((current) => [...current, { batchim: "", conjugation: "" }]);
  }
  const [rows, setRows] = useState<GrammarFormRow[]>(
    () => (initial?.rows ?? []).map((row) => ({ ...row }))
  );

  function updateRow(rowIndex: number, patch: Partial<GrammarFormRow>) {
    setRows((current) => current.map((row, index) => (index === rowIndex ? { ...row, ...patch } : row)));
  }
  function removeRow(rowIndex: number) {
    setRows((current) => current.filter((_, index) => index !== rowIndex));
  }
  function addRow() {
    setRows((current) => [...current, { form: "", combination: "", audio: "" }]);
  }
  const [examples, setExamples] = useState<GrammarExample[]>(
    () => (initial?.examples ?? []).map((example) => ({ ...example }))
  );

  function updateExample(exampleIndex: number, patch: Partial<GrammarExample>) {
    setExamples((current) => current.map((example, index) => (index === exampleIndex ? { ...example, ...patch } : example)));
  }
  function removeExample(exampleIndex: number) {
    setExamples((current) => current.filter((_, index) => index !== exampleIndex));
  }
  function addExample() {
    setExamples((current) => [...current, { ko: "", zh: "", audio: "" }]);
  }
  const [caution, setCaution] = useState(initial?.caution ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setMessage(null);
    const item: GrammarItem = {
      title: title.trim(),
      meaning: meaning.trim(),
      cases: cases
        .map((row) => ({ batchim: row.batchim.trim(), conjugation: row.conjugation.trim() }))
        .filter((row) => row.batchim || row.conjugation),
      rows: rows
        .map((row) => ({ form: row.form.trim(), combination: row.combination.trim(), audio: row.audio.trim() }))
        .filter((row) => row.form || row.combination),
      examples: examples
        .map((example) => ({ ko: example.ko.trim(), zh: example.zh.trim(), audio: example.audio.trim() }))
        .filter((example) => example.ko || example.zh),
      caution: caution.trim(),
    };
    const result =
      index === undefined
        ? await addGrammarItemAction(chapterId, item)
        : await updateGrammarItemAction(chapterId, index, item);
    if (result.ok) {
      if (index === undefined) {
        setTitle("");
        setMeaning("");
        setCases([]);
        setRows([]);
        setExamples([]);
        setCaution("");
      } else {
        onCancel?.();
      }
      onRefresh();
    } else {
      setMessage(result.message ?? "保存失败");
    }
    setPending(false);
  }

  const inputClass =
    "w-full rounded-[6px] border px-2.5 py-1.5 text-[11px] font-medium outline-none transition-colors focus:border-[var(--app-accent)]";
  const labelClass = "block text-[10px] font-semibold app-muted-text";

  return (
    <div
      className="rounded-xl border p-3.5"
      style={{ borderColor: "var(--app-border)", background: "var(--app-soft-bg)" }}
    >
      <p className="text-[11px] font-semibold">{index === undefined ? "新增语法点" : "编辑语法点"}</p>
      <div className="mt-2 space-y-2">
        <div>
          <label className={labelClass}>语法名称（必填）</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="如 N이에요／예요"
            className={`${inputClass} mt-1`}
          />
        </div>
        <div>
          <label className={labelClass}>中文含义</label>
          <input
            type="text"
            value={meaning}
            onChange={(event) => setMeaning(event.target.value)}
            placeholder="如 “是……”"
            className={`${inputClass} mt-1`}
          />
        </div>
        <div>
          <label className={labelClass}>收音情况（每行一个尾字收音 + 情况说明）</label>
          <div className="mt-1 overflow-hidden rounded-[6px] border" style={{ borderColor: "var(--app-border)" }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--app-border)" }}>
                  <th className="w-[5%] px-2 py-1.5 font-medium">#</th>
                  <th className="w-[38%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>尾字收音</th>
                  <th className="w-[51%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>情况说明</th>
                  <th className="w-[6%] border-l px-2 py-1.5 text-right font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 && (
                  <tr>
                    <td colSpan={4} className="app-muted-text px-3 py-3 text-center text-[10px]">
                      还没有收音情况行，点击下方“添加一行”。
                    </td>
                  </tr>
                )}
                {cases.map((caseRow, caseIndex) => (
                  <tr key={caseIndex} className="border-b align-top last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                    <td className="app-muted-text px-2 py-2 font-mono text-[10px]">{caseIndex + 1}</td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input
                        type="text"
                        value={caseRow.batchim}
                        onChange={(event) => updateCase(caseIndex, { batchim: event.target.value })}
                        placeholder="如 无收音"
                        className={inputClass}
                      />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input
                        type="text"
                        value={caseRow.conjugation}
                        onChange={(event) => updateCase(caseIndex, { conjugation: event.target.value })}
                        placeholder="如 无收音 → 예요"
                        className={inputClass}
                      />
                    </td>
                    <td className="border-l px-2 py-2 text-right" style={{ borderColor: "var(--app-border)" }}>
                      <button
                        type="button"
                        onClick={() => removeCase(caseIndex)}
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
            onClick={addCase}
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
                  <th className="w-[28%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>形态</th>
                  <th className="w-[28%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>组合</th>
                  <th className="w-[33%] border-l px-2 py-1.5 font-medium" style={{ borderColor: "var(--app-border)" }}>音频</th>
                  <th className="w-[6%] border-l px-2 py-1.5 text-right font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="app-muted-text px-3 py-3 text-center text-[10px]">
                      还没有形态组合行，点击下方“添加一行”。
                    </td>
                  </tr>
                )}
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b align-top last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                    <td className="app-muted-text px-2 py-2 font-mono text-[10px]">{rowIndex + 1}</td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input
                        type="text"
                        value={row.form}
                        onChange={(event) => updateRow(rowIndex, { form: event.target.value })}
                        placeholder="如 민지 + 예요"
                        className={inputClass}
                      />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input
                        type="text"
                        value={row.combination}
                        onChange={(event) => updateRow(rowIndex, { combination: event.target.value })}
                        placeholder="如 민지예요"
                        className={inputClass}
                      />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <GrammarRowAudioField
                        compact
                        textbookSlug={textbookSlug}
                        chapterNumber={chapterNumber}
                        value={row.audio}
                        onChange={(objectKey) => updateRow(rowIndex, { audio: objectKey })}
                      />
                    </td>
                    <td className="border-l px-2 py-2 text-right" style={{ borderColor: "var(--app-border)" }}>
                      <button
                        type="button"
                        onClick={() => removeRow(rowIndex)}
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
            onClick={addRow}
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
                {examples.length === 0 && (
                  <tr>
                    <td colSpan={5} className="app-muted-text px-3 py-3 text-center text-[10px]">
                      还没有例句，点击下方“添加一行”。
                    </td>
                  </tr>
                )}
                {examples.map((example, exampleIndex) => (
                  <tr key={exampleIndex} className="border-b align-top last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                    <td className="app-muted-text px-2 py-2 font-mono text-[10px]">{exampleIndex + 1}</td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input
                        type="text"
                        value={example.ko}
                        onChange={(event) => updateExample(exampleIndex, { ko: event.target.value })}
                        placeholder="如 저는 학생이에요."
                        className={inputClass}
                      />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <input
                        type="text"
                        value={example.zh}
                        onChange={(event) => updateExample(exampleIndex, { zh: event.target.value })}
                        placeholder="如 我是学生。"
                        className={inputClass}
                      />
                    </td>
                    <td className="border-l px-2 py-2" style={{ borderColor: "var(--app-border)" }}>
                      <GrammarRowAudioField
                        compact
                        textbookSlug={textbookSlug}
                        chapterNumber={chapterNumber}
                        value={example.audio}
                        onChange={(objectKey) => updateExample(exampleIndex, { audio: objectKey })}
                      />
                    </td>
                    <td className="border-l px-2 py-2 text-right" style={{ borderColor: "var(--app-border)" }}>
                      <button
                        type="button"
                        onClick={() => removeExample(exampleIndex)}
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
            onClick={addExample}
            className="app-muted-text mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium transition hover:text-[var(--app-accent)]"
          >
            <Plus size={12} aria-hidden="true" />
            添加一行
          </button>
        </div>
        <div>
          <label className={labelClass}>注意事项（可选）</label>
          <input
            type="text"
            value={caution}
            onChange={(event) => setCaution(event.target.value)}
            placeholder="如：书写时名词和이에요/예요之间不能有空格"
            className={`${inputClass} mt-1`}
          />
        </div>
      </div>
      {message && <Feedback message={message} />}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          {pending ? <LoaderCircle size={11} className="animate-spin" aria-hidden="true" /> : <Plus size={11} aria-hidden="true" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[6px] border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
            style={{ borderColor: "var(--app-border)" }}
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}

/** 形态组合行内的单个音频上传控件（存 Cloudflare R2，value 为 objectKey） */
function GrammarRowAudioField({
  textbookSlug,
  chapterNumber,
  value,
  onChange,
  compact = false,
}: {
  textbookSlug: string;
  chapterNumber: number;
  value: string;
  onChange: (objectKey: string) => void;
  compact?: boolean;
}) {
  const inputId = useId();
  const [status, setStatus] = useState<"idle" | "uploading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    void upload(file);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setStatus("uploading");
    setMessage("正在上传音频到 R2…");
    try {
      const created = await createGrammarAudioUploadUrlAction({
        textbookSlug,
        chapterNumber,
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
    <div
      className={compact ? "" : "mt-2 border-t pt-2"}
      style={{
        borderColor: "var(--app-border-soft)",
        ...(isDragging
          ? {
              borderRadius: 6,
              borderTop: "1px solid var(--app-accent)",
              backgroundColor: "color-mix(in srgb, var(--app-accent) 8%, transparent)",
            }
          : {}),
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {value ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-medium">
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
          {!compact && previewUrl && (
            <audio controls src={previewUrl} preload="none" className="h-7 w-full rounded-[6px]" />
          )}
          <p className="text-[9px]" style={{ color: "var(--app-muted)" }}>
            {isDragging ? "松开即可替换" : "拖拽新音频到此处可替换"}
          </p>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[6px] border border-dashed px-2 py-1.5 text-[10px] font-medium transition-colors hover:bg-[var(--app-soft-bg)]"
          style={{
            borderColor: isDragging ? "var(--app-accent)" : "var(--app-border)",
            color: isDragging ? "var(--app-accent)" : undefined,
          }}
        >
          {status === "uploading" ? (
            <LoaderCircle size={11} className="animate-spin" aria-hidden="true" />
          ) : (
            <Volume2 size={11} aria-hidden="true" />
          )}
          {status === "uploading" ? "上传中…" : isDragging ? "松开上传" : "点击或拖拽上传音频"}
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
      {!compact && (
        <p
          className="mt-1 text-[9px] leading-4"
          style={{ color: status === "error" ? "var(--app-warm)" : "var(--app-muted)" }}
        >
          {message || "支持常用音频格式，文件不超过 20 兆，保存至对象存储"}
        </p>
      )}
    </div>
  );
}
