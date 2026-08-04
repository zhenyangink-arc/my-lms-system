"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  LibraryBig,
  Lock,
  Maximize2,
  Menu,
  Minimize2,
  NotebookPen,
  Search,
  Volume2,
  X,
} from "lucide-react";

import { hangulIntroductionChapters } from "@/lib/korean-curriculum";
import type { KoreanEbookProgressMap } from "@/lib/korean-ebook-progress";
import { saveKoreanEbookProgressAction } from "./actions";
import { BatchimReadingBook } from "./BatchimReadingBook";
import { HangulBookOpening } from "./HangulBookOpening";
import { PronunciationRulesBook } from "./PronunciationRulesBook";
import { VowelsConsonantsBook } from "./VowelsConsonantsBook";

type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type HangulInteractiveBookProps = {
  courseId: string;
  lessonId: string;
  initialProgress: number;
  initialStatus: LessonProgressStatus;
  trackingDisabled: boolean;
  backHref: string;
  unlockedChapterCount: number;
  initialEbookProgress: KoreanEbookProgressMap;
  initialChapterSlug?: string;
};

type LocalStudyState = {
  bookmarkedChapters?: number[];
  notes?: Record<number, string>;
};

const hangulReference = {
  vowels: ["ㅏ", "ㅑ", "ㅓ", "ㅕ", "ㅗ", "ㅛ", "ㅜ", "ㅠ", "ㅡ", "ㅣ", "ㅐ", "ㅒ", "ㅔ", "ㅖ", "ㅘ", "ㅙ", "ㅚ", "ㅝ", "ㅞ", "ㅟ", "ㅢ"],
  consonants: ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ", "ㄲ", "ㄸ", "ㅃ", "ㅆ", "ㅉ"],
};

const hangulPinyinHints: Record<string, string> = {
  "ㅏ": "ā（啊）", "ㅑ": "yā（呀）", "ㅓ": "āo（奥）", "ㅕ": "yāo（腰）",
  "ㅗ": "wō（我）", "ㅛ": "yōu（呦）", "ㅜ": "wū（乌）", "ㅠ": "yòu（右）",
  "ㅡ": "ē（额）", "ㅣ": "yī（衣）", "ㅐ": "ai（哎）", "ㅒ": "ye（页）",
  "ㅔ": "ai（哎）", "ㅖ": "ye（页）", "ㅘ": "wa（哇）", "ㅙ": "wai（歪）",
  "ㅚ": "wai（外）", "ㅝ": "wo（窝）", "ㅞ": "wei（威）", "ㅟ": "wei（威）",
  "ㅢ": "yi（一）", "ㄱ": "g / k", "ㄴ": "n", "ㄷ": "d / t", "ㄹ": "r / l",
  "ㅁ": "m", "ㅂ": "b / p", "ㅅ": "s", "ㅇ": "ng（ying 的 ng 发音）",
  "ㅈ": "c", "ㅊ": "ch", "ㅋ": "k（四声）", "ㅌ": "t（四声）",
  "ㅍ": "p（四声）", "ㅎ": "h", "ㄲ": "g（四声）", "ㄸ": "d（四声）",
  "ㅃ": "p（四声）", "ㅆ": "s（四声）", "ㅉ": "z（四声）",
};

const hangulChapterPageCounts: Record<string, number> = {
  "meet-hangul": 13,
  "vowels-and-consonants": 14,
  "batchim-and-reading": 32,
  "pronunciation-rules-and-reading": 34,
};

const EFFECTIVE_READING_DELAY_MS = 8_000;

export function HangulInteractiveBook({
  courseId,
  lessonId,
  initialProgress,
  initialStatus,
  trackingDisabled,
  backHref,
  unlockedChapterCount,
  initialEbookProgress,
  initialChapterSlug,
}: HangulInteractiveBookProps) {
  const router = useRouter();
  const requestedChapterIndex = hangulIntroductionChapters.findIndex(
    (item) => item.slug === initialChapterSlug
  );
  const initialChapter =
    requestedChapterIndex >= 0
      ? requestedChapterIndex
      : initialProgress >= 76
        ? 3
        : initialProgress >= 51
          ? 2
          : initialProgress >= 26
            ? 1
            : 0;
  const [chapterIndex, setChapterIndex] = useState(
    Math.min(
      initialChapter,
      Math.max(0, unlockedChapterCount - 1),
      hangulIntroductionChapters.length - 1
    )
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBookFullscreen, setIsBookFullscreen] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.78);
  const [bookmarkedChapters, setBookmarkedChapters] = useState<number[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [hasLoadedLocalState, setHasLoadedLocalState] = useState(false);
  const [ebookProgress, setEbookProgress] =
    useState<KoreanEbookProgressMap>(initialEbookProgress);
  const bookRef = useRef<HTMLDivElement>(null);
  const ebookRef = useRef<HTMLElement>(null);
  const storageKey = `hangul-book:${lessonId}`;
  const chapter = hangulIntroductionChapters[chapterIndex];
  const isBookmarked = bookmarkedChapters.includes(chapterIndex);
  const currentPageCount = hangulChapterPageCounts[chapter.slug] ?? 1;
  const currentPage = Math.min(
    ebookProgress[chapter.slug]?.currentPage ?? 0,
    currentPageCount - 1
  );
  const progress = Math.round(
    ((ebookProgress[chapter.slug]?.readPages ?? []).filter(
      (page) => page >= 0 && page < currentPageCount
    ).length /
      currentPageCount) *
      100
  );

  // These values remain part of the server/client contract for progress tracking.
  void courseId;
  void initialStatus;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as LocalStudyState;
        // Local storage is an external source; hydrate its snapshot after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBookmarkedChapters(parsed.bookmarkedChapters ?? []);
        setNotes(parsed.notes ?? {});
      }
    } catch {
      // A damaged local cache must not block the electronic book.
    } finally {
      setHasLoadedLocalState(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedLocalState) return;
    const state: LocalStudyState = { bookmarkedChapters, notes };
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [bookmarkedChapters, hasLoadedLocalState, notes, storageKey]);

  function toggleBookFullscreen() {
    setIsBookFullscreen((current) => !current);
  }

  async function confirmExitReader() {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Continue returning to the course when the browser refuses this request.
      }
    }

    router.push(backHref);
  }

  function openChapter(index: number) {
    if (index >= unlockedChapterCount) return;
    setChapterIndex(index);
    setIsMenuOpen(false);
    setIsNotesOpen(false);
  }

  function handlePageChange(page: number) {
    const boundedPage = Math.min(Math.max(0, page), currentPageCount - 1);
    setEbookProgress((current) => ({
      ...current,
      [chapter.slug]: {
        currentPage: boundedPage,
        totalPages: currentPageCount,
        progressPercent: current[chapter.slug]?.progressPercent ?? 0,
        readPages: current[chapter.slug]?.readPages ?? [],
      },
    }));
    if (!trackingDisabled) {
      void saveKoreanEbookProgressAction({
        testSlug: chapter.slug,
        currentPage: boundedPage,
        totalPages: currentPageCount,
      });
    }
  }

  useEffect(() => {
    if (trackingDisabled) return;
    const chapterSlug = chapter.slug;
    const visiblePages = [currentPage, currentPage + 1].filter(
      (page) => page >= 0 && page < currentPageCount
    );
    const timeoutId = window.setTimeout(() => {
      setEbookProgress((current) => {
        const previous = current[chapterSlug];
        const readPages = Array.from(
          new Set([
            ...(previous?.readPages ?? []).filter(
              (page) => page >= 0 && page < currentPageCount
            ),
            ...visiblePages,
          ])
        ).sort((a, b) => a - b);
        return {
          ...current,
          [chapterSlug]: {
            currentPage,
            totalPages: currentPageCount,
            readPages,
            progressPercent: Math.round(
              (readPages.length / currentPageCount) * 100
            ),
          },
        };
      });
      void saveKoreanEbookProgressAction({
        testSlug: chapterSlug,
        currentPage,
        totalPages: currentPageCount,
        readPages: visiblePages,
      });
    }, EFFECTIVE_READING_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [chapter.slug, currentPage, currentPageCount, trackingDisabled]);

  function toggleBookmark() {
    setBookmarkedChapters((current) =>
      current.includes(chapterIndex)
        ? current.filter((index) => index !== chapterIndex)
        : [...current, chapterIndex]
    );
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div
      id="guide-target-beginner-course"
      ref={bookRef}
      className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f7faf8] text-[#173f4a]"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#dce8e1] bg-white/95 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsExitDialogOpen(true)}
            aria-label="返回课程"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dce8e1] text-[#60736a] transition hover:bg-[#eef6f2]"
          >
            <ArrowLeft size={17} />
          </button>
          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            aria-label="打开章节目录"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dce8e1] text-[#60736a] transition hover:bg-[#eef6f2] lg:hidden"
          >
            <Menu size={17} />
          </button>
          <span className="hidden h-5 w-px bg-[#dce4df] sm:block" />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-[#173f4a]">韩语字母入门</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="hidden items-center gap-2 rounded-xl border border-[#dce4df] bg-white px-3 py-2 text-xs font-bold text-[#657a70] sm:inline-flex">
            <Volume2 size={14} />
            <span className="hidden lg:inline">发音速度</span>
            <select
              value={speechRate}
              onChange={(event) => setSpeechRate(Number(event.target.value))}
              className="bg-transparent font-black text-[#294f43] outline-none"
              aria-label="选择发音速度"
            >
              <option value={0.62}>慢速</option>
              <option value={0.78}>标准</option>
              <option value={0.95}>快速</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setIsReferenceOpen(true)}
            title="韩文字母速查"
            className="hidden items-center gap-1.5 rounded-xl border border-[#ead3a7] bg-[#fff4df] px-3 py-2 text-xs font-black text-[#294f43] transition hover:bg-[#ffefd0] md:inline-flex"
          >
            <Search size={16} />
            字母速查
          </button>
          <button
            type="button"
            onClick={toggleBookmark}
            aria-label={isBookmarked ? "取消书签" : "添加书签"}
            aria-pressed={isBookmarked}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-black transition ${
              isBookmarked
                ? "bg-[#fff1df] text-[#b87131]"
                : "text-[#294f43] hover:bg-[#f1f5f2]"
            }`}
          >
            {isBookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
            <span>{isBookmarked ? "已加书签" : "加入书签"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            aria-label="打开学习笔记"
            aria-pressed={isNotesOpen}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-black transition ${
              isNotesOpen
                ? "bg-[#fff1df] text-[#b87131]"
                : "text-[#294f43] hover:bg-[#f1f5f2]"
            }`}
          >
            <NotebookPen size={17} />
            <span>本章笔记</span>
          </button>
          <button
            type="button"
            onClick={toggleBookFullscreen}
            aria-label={isBookFullscreen ? "退出电子书全屏" : "电子书全屏"}
            aria-pressed={isBookFullscreen}
            className="inline-flex items-center gap-2 rounded-xl border border-[#dce4df] bg-white px-3 py-2 text-xs font-black text-[#4f685c] transition hover:border-[#9fbbb0] hover:bg-[#f1f7f4]"
          >
            {isBookFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            <span className="hidden sm:inline">{isBookFullscreen ? "退出阅读模式" : "阅读模式"}</span>
          </button>
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-bold text-[#83948b]">阅读进度</p>
            <p className="text-sm font-black text-[#238777]">{progress}%</p>
          </div>
          <div className="hidden h-2 w-20 overflow-hidden rounded-full bg-[#e5ece8] lg:block lg:w-28">
            <div
              className="h-full rounded-full bg-[#2c9a87] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsExitDialogOpen(true)}
            aria-label="退出阅读器"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dce4df] bg-white text-[#60736a] transition hover:border-[#d79a87] hover:bg-[#fff5f1] hover:text-[#b4513b]"
          >
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={`absolute inset-y-0 left-0 z-30 flex w-72 shrink-0 flex-col border-r border-[#dce8e1] bg-[#f1f7f4] p-4 shadow-xl transition-transform lg:static lg:translate-x-0 lg:shadow-none ${
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-4 flex items-center gap-2 px-2 text-sm font-black text-[#315f52]">
            <LibraryBig size={16} />
            章节目录
          </div>
          <nav className="space-y-2">
            {hangulIntroductionChapters.map((item, index) => {
              const active = index === chapterIndex;
              const unlocked = index < unlockedChapterCount;
              const chapterProgress =
                Math.round(
                  ((ebookProgress[item.slug]?.readPages ?? []).filter(
                    (page) =>
                      page >= 0 &&
                      page < (hangulChapterPageCounts[item.slug] ?? 1)
                  ).length /
                    (hangulChapterPageCounts[item.slug] ?? 1)) *
                    100
                );
              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => openChapter(index)}
                  disabled={!unlocked}
                  className={`w-full rounded-2xl p-3 text-left transition ${
                    active
                      ? "bg-white shadow-sm ring-1 ring-[#cfe2d9]"
                      : unlocked
                        ? "hover:bg-white/70"
                        : "cursor-not-allowed opacity-55"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                      active ? "bg-[#238777] text-white" : "bg-[#dfece6] text-[#60736a]"
                    }`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-[#294f43]">{item.title}</span>
                      <span className="mt-1 block text-[11px] font-bold text-[#789087]">{item.koreanTitle}</span>
                      {unlocked && (
                        <span className="mt-2 block text-[10px] font-black text-[#238777]">
                          {chapterProgress > 0
                            ? `阅读 ${chapterProgress}%`
                            : "尚未阅读"}
                        </span>
                      )}
                    </span>
                    {bookmarkedChapters.includes(index) && (
                      <BookmarkCheck size={14} className="ml-auto shrink-0 text-[#c9803c]" />
                    )}
                    {!unlocked && (
                      <Lock size={14} className="ml-auto shrink-0 text-[#83948b]" />
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl bg-[#e4f1eb] p-4">
            <p className="text-xs font-black text-[#315f52]">阅读提示</p>
            <p className="mt-1 text-[11px] leading-5 text-[#688078]">
              每个章节都是一本独立电子书。使用书本两侧按钮、键盘方向键或目录页码翻页。
            </p>
          </div>
        </aside>

        {isMenuOpen && (
          <button
            type="button"
            aria-label="关闭章节目录"
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 z-20 bg-[#173f4a]/25 lg:hidden"
          />
        )}

        <main className="relative min-w-0 flex-1 overflow-hidden px-[5px] py-4 lg:py-5">
          <section
            ref={ebookRef}
            className={`mx-auto flex h-full min-h-0 w-full max-w-[1500px] items-stretch justify-center overflow-hidden ${
            isBookFullscreen ? "fixed inset-0 z-40 h-[100dvh] w-screen max-w-none bg-[#101613]" : ""
          }`}>
            {chapterIndex === 0 ? (
              <HangulBookOpening key={chapter.slug} isFullscreen={isBookFullscreen} speechRate={speechRate} initialPage={currentPage} onPageChange={handlePageChange} onStartTest={() => router.push(`/dashboard/assignments/korean/${chapter.slug}`)} />
            ) : chapterIndex === 1 ? (
              <VowelsConsonantsBook key={chapter.slug} isFullscreen={isBookFullscreen} speechRate={speechRate} initialPage={currentPage} onPageChange={handlePageChange} onStartTest={() => router.push(`/dashboard/assignments/korean/${chapter.slug}`)} />
            ) : chapterIndex === 2 ? (
              <BatchimReadingBook key={chapter.slug} isFullscreen={isBookFullscreen} speechRate={speechRate} initialPage={currentPage} onPageChange={handlePageChange} onStartTest={() => router.push(`/dashboard/assignments/korean/${chapter.slug}`)} />
            ) : (
              <PronunciationRulesBook key={chapter.slug} isFullscreen={isBookFullscreen} speechRate={speechRate} initialPage={currentPage} onPageChange={handlePageChange} onStartTest={() => router.push(`/dashboard/assignments/korean/${chapter.slug}`)} />
            )}
          </section>
        </main>
        {isBookFullscreen && (
          <div className="fixed right-5 top-5 z-50 flex overflow-hidden rounded-xl border border-white/20 bg-[#173f4a]/85 text-white shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={toggleBookFullscreen}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-black transition hover:bg-[#173f4a]"
            >
              <Minimize2 size={16} />
              退出阅读模式
            </button>
            <button
              type="button"
              onClick={() => setIsExitDialogOpen(true)}
              aria-label="退出阅读器"
              className="border-l border-white/20 px-3 transition hover:bg-[#173f4a]"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {isReferenceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#173f4a]/35 p-4"
          role="presentation"
          onClick={() => setIsReferenceOpen(false)}
        >
          <section
            className="w-full max-w-6xl rounded-[28px] border border-[#cfe2d9] bg-[#f3faf7] p-7 shadow-2xl sm:p-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hangul-reference-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 id="hangul-reference-title" className="text-xl font-black text-[#294f43]">韩文字母速查表</h2>
                <p className="mt-2 text-base text-[#71857b]">点击任意字母即可听发音；下方为拼音近似读音</p>
              </div>
              <button type="button" onClick={() => setIsReferenceOpen(false)} className="text-base font-bold text-[#71857b]">关闭</button>
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-3">
              <div>
                <p className="mb-4 text-base font-black tracking-widest text-[#238777]">
                  单元音 · {hangulReference.vowels.slice(0, 10).length} 个
                </p>
                <div className="flex flex-wrap gap-4">
                  {hangulReference.vowels.slice(0, 10).map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      title={`播放 ${letter} 的发音`}
                      onClick={() => speak(letter)}
                      className="flex h-[88px] w-20 flex-col items-center justify-center rounded-2xl border border-[#d6e5de] bg-white transition hover:border-[#68ad9e] hover:text-[#238777]"
                    >
                      <span className="text-3xl font-black text-[#173f4a]">{letter}</span>
                      <span className="mt-1.5 text-xs font-bold leading-none text-[#71857b]">{hangulPinyinHints[letter]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-4 text-base font-black tracking-widest text-[#238777]">
                  双元音 · {hangulReference.vowels.slice(10).length} 个
                </p>
                <div className="flex flex-wrap gap-4">
                  {hangulReference.vowels.slice(10).map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      title={`播放 ${letter} 的发音`}
                      onClick={() => speak(letter)}
                      className="flex h-[88px] w-20 flex-col items-center justify-center rounded-2xl border border-[#d6e5de] bg-white transition hover:border-[#68ad9e] hover:text-[#238777]"
                    >
                      <span className="text-3xl font-black text-[#173f4a]">{letter}</span>
                      <span className="mt-1.5 text-xs font-bold leading-none text-[#71857b]">{hangulPinyinHints[letter]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-4 text-base font-black tracking-widest text-[#238777]">
                  辅音 · {hangulReference.consonants.length} 个
                </p>
                <div className="flex flex-wrap gap-4">
                  {hangulReference.consonants.map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      title={`播放 ${letter} 的发音`}
                      onClick={() => speak(letter)}
                      className="flex h-[88px] w-24 flex-col items-center justify-center rounded-2xl border border-[#d6e5de] bg-white transition hover:border-[#68ad9e] hover:text-[#238777]"
                    >
                      <span className="text-3xl font-black text-[#173f4a]">{letter}</span>
                      <span className="mt-1.5 text-xs font-bold leading-none text-[#71857b]">{hangulPinyinHints[letter]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {isExitDialogOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#102f35]/55 p-5 backdrop-blur-sm"
          role="presentation"
          onClick={() => setIsExitDialogOpen(false)}
        >
          <section
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-[#f9fcfa] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-reader-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[#dce8e1] bg-[linear-gradient(135deg,#e7f4ef_0%,#f9fcfa_70%)] px-7 py-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#238777] shadow-sm">
                <ArrowLeft size={20} />
              </div>
              <h2 id="exit-reader-title" className="mt-4 text-xl font-black tracking-tight text-[#173f4a]">
                要退出本次阅读吗？
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#60736a]">
                你的笔记与书签已自动保存。确认后将退出全屏并返回课程目录。
              </p>
            </div>
            <div className="flex gap-3 px-7 py-5">
              <button
                type="button"
                onClick={() => setIsExitDialogOpen(false)}
                className="flex-1 rounded-xl border border-[#d7e4de] bg-white px-4 py-3 text-sm font-black text-[#526b60] transition hover:bg-[#f2f7f4]"
              >
                继续阅读
              </button>
              <button
                type="button"
                onClick={() => void confirmExitReader()}
                className="flex-1 rounded-xl bg-[#238777] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#1d7466]"
              >
                确认退出
              </button>
            </div>
          </section>
        </div>
      )}

      {isNotesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#173f4a]/35 p-4"
          role="presentation"
          onClick={() => setIsNotesOpen(false)}
        >
          <section
            className="w-full max-w-2xl rounded-[24px] border border-[#ead9c5] bg-[#fffaf2] p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chapter-notes-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="chapter-notes-title" className="text-base font-black text-[#704f2f]">
                  第 {chapterIndex + 1} 章学习笔记
                </h2>
                <p className="mt-1 text-xs text-[#92785e]">内容自动保存在当前浏览器</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNotesOpen(false)}
                className="text-xs font-bold text-[#92785e]"
              >
                关闭
              </button>
            </div>
            <textarea
              value={notes[chapterIndex] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({ ...current, [chapterIndex]: event.target.value }))
              }
              placeholder="记下容易混淆的字母、发音口型或自己的记忆方法……"
              className="mt-4 min-h-36 w-full resize-y rounded-2xl border border-[#ead9c5] bg-white/80 p-4 text-sm leading-6 text-[#5f4a36] outline-none transition placeholder:text-[#b6a28f] focus:border-[#c9803c] focus:ring-2 focus:ring-[#f5dfc7]"
            />
          </section>
        </div>
      )}
    </div>
  );
}
