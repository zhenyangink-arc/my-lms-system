"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  Compass,
  ListChecks,
  Lock,
  Maximize2,
  Menu,
  Minimize2,
  NotebookPen,
  Search,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import type { KoreanEbookProgressMap } from "@/lib/korean-ebook-progress";
import { saveKoreanEbookProgressAction } from "./actions";
import {
  KOREAN_LEVEL_ONE_GUIDE_PAGE_COUNT,
  KoreanLevelOneGuideBook,
} from "./KoreanLevelOneGuideBook";
import {
  KOREAN_LEVEL_ONE_LESSONS,
  KoreanLevelOneLessonBook,
  getKoreanLevelOneLessonPageCount,
} from "./KoreanLevelOneLessonBook";
import { KoreanLevelOneLessonTwoBook } from "./KoreanLevelOneLessonTwoBook";
import { KoreanLevelOneLessonThreeBook } from "./KoreanLevelOneLessonThreeBook";
import { KoreanLevelOneLessonFourBook } from "./KoreanLevelOneLessonFourBook";
import { KoreanLevelOneLessonFiveBook } from "./KoreanLevelOneLessonFiveBook";
import { KoreanLevelOneLessonSixBook } from "./KoreanLevelOneLessonSixBook";
import { KoreanLevelOneLessonSevenBook } from "./KoreanLevelOneLessonSevenBook";
import { KoreanLevelOneLessonEightBook } from "./KoreanLevelOneLessonEightBook";
import { KoreanLevelOneLessonNineBook } from "./KoreanLevelOneLessonNineBook";
import { KoreanLevelOneLessonTenBook } from "./KoreanLevelOneLessonTenBook";
import { KoreanLevelOneLessonElevenBook } from "./KoreanLevelOneLessonElevenBook";
import { KoreanLevelOneLessonTwelveBook } from "./KoreanLevelOneLessonTwelveBook";
import { KoreanLevelOneLessonThirteenBook } from "./KoreanLevelOneLessonThirteenBook";
import { KoreanLevelOneLessonFourteenBook } from "./KoreanLevelOneLessonFourteenBook";
import { KoreanLevelOneLessonFifteenBook } from "./KoreanLevelOneLessonFifteenBook";
import { KoreanLevelOneLessonSixteenBook } from "./KoreanLevelOneLessonSixteenBook";

type KoreanLevelOneReaderProps = {
  backHref: string;
  unlockedLessonCount: number;
  initialEbookProgress: KoreanEbookProgressMap;
  initialChapterSlug?: string;
  trackingDisabled: boolean;
};

const books = [
  { number: 0, korean: "课程导读", chinese: "코스 안내" },
  ...KOREAN_LEVEL_ONE_LESSONS,
];


/** 阅读计时（时间制）：累计阅读秒数 → "MM:SS" 格式。 */
function formatReadingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** 时间制进度：10 分钟 = 100%（与学生端口径一致）。 */
function readingTimePercent(totalSeconds: number) {
  return Math.min(100, Math.round((totalSeconds / 600) * 100));
}

export function KoreanLevelOneReader({
  backHref,
  unlockedLessonCount,
  initialEbookProgress,
  initialChapterSlug,
  trackingDisabled,
}: KoreanLevelOneReaderProps) {
  const router = useRouter();
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [note, setNote] = useState("");
  const [hasLoadedCache, setHasLoadedCache] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.78);
  const requestedLessonNumber = Number(
    initialChapterSlug?.match(/^korean-level-one-(\d{2})$/)?.[1] ?? 0
  );
  const initialSelectedBookIndex =
    requestedLessonNumber >= 1 &&
      requestedLessonNumber <= unlockedLessonCount
      ? requestedLessonNumber
      : 0;
  const initialSelectedTestSlug =
    initialSelectedBookIndex === 0
      ? null
      : `korean-level-one-${String(initialSelectedBookIndex).padStart(2, "0")}`;
  const [currentPage, setCurrentPage] = useState(
    initialSelectedTestSlug
      ? initialEbookProgress[initialSelectedTestSlug]?.currentPage ?? 0
      : 0
  );
  const [ebookProgress, setEbookProgress] =
    useState<KoreanEbookProgressMap>(initialEbookProgress);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState<Record<string, number>>({});
  const [selectedBookIndex, setSelectedBookIndex] = useState(
    initialSelectedBookIndex
  );
  const selectedLesson =
    selectedBookIndex === 0
      ? null
      : KOREAN_LEVEL_ONE_LESSONS[selectedBookIndex - 1] ?? null;
  const selectedBook = books[selectedBookIndex] ?? books[0];
  const selectedPageCount =
    selectedBookIndex === 0
      ? KOREAN_LEVEL_ONE_GUIDE_PAGE_COUNT
      : getKoreanLevelOneLessonPageCount(selectedBook.number);
  const selectedTestSlug =
    selectedBookIndex === 0
      ? null
      : `korean-level-one-${String(selectedBook.number).padStart(2, "0")}`;
  const progress =
    selectedTestSlug === null
      ? Math.min(
          100,
          Math.round(((currentPage + 2) / selectedPageCount) * 100)
        )
      : Math.min(
          100,
          Math.round(
            (((ebookProgress[selectedTestSlug]?.readingSeconds ?? 0) +
              (accumulatedSeconds[selectedTestSlug] ?? 0)) /
              600) *
              100
          )
        );
  const initialSelectedPage =
    selectedTestSlug === null
      ? 0
      : ebookProgress[selectedTestSlug]?.currentPage ?? 0;

  function selectBook(index: number) {
    if (index > unlockedLessonCount) return;
    const book = books[index] ?? books[0];
    const testSlug =
      index === 0
        ? null
        : `korean-level-one-${String(book.number).padStart(2, "0")}`;
    setSelectedBookIndex(index);
    setCurrentPage(testSlug ? ebookProgress[testSlug]?.currentPage ?? 0 : 0);
    setIsMenuOpen(false);
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
    if (!selectedTestSlug) return;
    const boundedPage = Math.min(Math.max(0, page), selectedPageCount - 1);
    setEbookProgress((current) => ({
      ...current,
      [selectedTestSlug]: {
        currentPage: boundedPage,
        totalPages: selectedPageCount,
        progressPercent: current[selectedTestSlug]?.progressPercent ?? 0,
        readPages: current[selectedTestSlug]?.readPages ?? [],
      },
    }));
    if (!trackingDisabled) {
      void saveKoreanEbookProgressAction({
        testSlug: selectedTestSlug,
        currentPage: boundedPage,
        totalPages: selectedPageCount,
      });
    }
  }

  // —— 阅读计时：进度按累计阅读时长计算（单本教材 10 分钟 = 100%）——
  const bookStartRef = useRef<number>(0);
  const testSlugRef = useRef(selectedTestSlug);
  const currentPageRef2 = useRef(currentPage);
  const pageCountRef = useRef(selectedPageCount);
  const ebookProgressRef2 = useRef(ebookProgress);
  useEffect(() => {
    if (bookStartRef.current === 0) {
      bookStartRef.current = Date.now();
    }
    testSlugRef.current = selectedTestSlug;
    currentPageRef2.current = currentPage;
    pageCountRef.current = selectedPageCount;
    ebookProgressRef2.current = ebookProgress;
  }, [selectedTestSlug, currentPage, selectedPageCount, ebookProgress]);

  // 本会话已流逝秒数：每秒刷新，让右上角计时实时走动。
  const [liveElapsed, setLiveElapsed] = useState(0);
  useEffect(() => {
    const tick = window.setInterval(() => {
      setLiveElapsed(Math.floor((Date.now() - bookStartRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [selectedTestSlug, trackingDisabled]);

  function flushReadingTime() {
    const slug = testSlugRef.current;
    if (!slug) return;
    const elapsed = Math.floor((Date.now() - bookStartRef.current) / 1000);
    if (elapsed <= 0) return;
    bookStartRef.current = Date.now();
    setAccumulatedSeconds((prev) => ({
      ...prev,
      [slug]: (prev[slug] ?? 0) + elapsed,
    }));
    void saveKoreanEbookProgressAction({
      testSlug: slug,
      // 本地没有该本书的进度快照时，不传页码，避免用 0 覆盖已保存的阅读位置。
      currentPage: ebookProgressRef2.current[slug]
        ? currentPageRef2.current
        : null,
      totalPages: pageCountRef.current,
      readPages: [],
      readingSeconds: elapsed,
    });
  }

  // 进入教材重置计时起点；每 30 秒把心跳时长写入数据库；切书/卸载时先落库。
  useEffect(() => {
    bookStartRef.current = Date.now();
    const timer = window.setInterval(flushReadingTime, 30_000);
    return () => {
      flushReadingTime();
      window.clearInterval(timer);
    };
  }, [selectedTestSlug, trackingDisabled]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("korean-level-one-reader");
        if (stored) {
          const parsed = JSON.parse(stored) as { bookmarked?: boolean; note?: string };
          setIsBookmarked(Boolean(parsed.bookmarked));
          setNote(parsed.note ?? "");
        }
      } catch {
        // A damaged local cache must not block the reader.
      }
      setHasLoadedCache(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasLoadedCache) return;
    window.localStorage.setItem(
      "korean-level-one-reader",
      JSON.stringify({ bookmarked: isBookmarked, note })
    );
  }, [hasLoadedCache, isBookmarked, note]);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  }

  async function exitReader() {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // The route change below still lets the learner leave the reader.
      }
    }
    router.push(backHref);
  }

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f7faf8] text-[#173f4a]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#dce8e1] bg-white/95 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsExitDialogOpen(true)}
            aria-label="退出课程阅读器"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dce8e1] text-[#60736a] transition hover:bg-[#eef6f2]"
          >
            <ArrowLeft size={17} />
          </button>
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            aria-label="打开课程目录"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dce8e1] text-[#60736a] transition hover:bg-[#eef6f2] lg:hidden"
          >
            <Menu size={17} />
          </button>
          <span className="hidden h-5 w-px bg-[#dce4df] sm:block" />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-[#173f4a]">韩国语 1 级</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-2 rounded-xl border border-[#dce4df] bg-white px-3 py-2 text-xs font-bold text-[#657a70] xl:inline-flex">
            <Volume2 size={14} />
            <span>发音速度</span>
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
            className="hidden items-center gap-1.5 rounded-xl border border-[#ead3a7] bg-[#fff4df] px-3 py-2 text-xs font-black text-[#294f43] transition hover:bg-[#ffefd0] md:inline-flex"
          >
            <Search size={16} />
            常用表达
          </button>
          <button
            type="button"
            onClick={() => setIsBookmarked((current) => !current)}
            aria-label={isBookmarked ? "取消书签" : "添加书签"}
            aria-pressed={isBookmarked}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-black transition ${
              isBookmarked ? "bg-[#fff1df] text-[#b87131]" : "text-[#294f43] hover:bg-[#f1f5f2]"
            }`}
          >
            {isBookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
            <span className="hidden 2xl:inline">{isBookmarked ? "已加书签" : "加入书签"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            aria-label="打开学习笔记"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-black text-[#294f43] transition hover:bg-[#f1f5f2]"
          >
            <NotebookPen size={17} />
            <span className="hidden 2xl:inline">本章笔记</span>
          </button>
          <button
            type="button"
            onClick={() => setIsReadingMode((current) => !current)}
            aria-pressed={isReadingMode}
            className="inline-flex items-center gap-2 rounded-xl border border-[#dce4df] bg-white px-3 py-2 text-xs font-black text-[#4f685c] transition hover:border-[#9fbbb0] hover:bg-[#f1f7f4]"
          >
            {isReadingMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            <span className="hidden sm:inline">{isReadingMode ? "退出阅读模式" : "阅读模式"}</span>
          </button>
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-bold text-[#83948b]">阅读进度</p>
            <p className="text-sm font-black text-[#238777]">
              {selectedTestSlug === null
                ? `${progress}%`
                : formatReadingTime(
                    (ebookProgress[selectedTestSlug]?.readingSeconds ?? 0) +
                      (accumulatedSeconds[selectedTestSlug] ?? 0) +
                      liveElapsed
                  )}
            </p>
          </div>
          <div className="hidden h-2 w-20 overflow-hidden rounded-full bg-[#e5ece8] 2xl:block">
            <div
              className="h-full rounded-full bg-[#2c9a87] transition-all"
              style={{
                width: `${
                  selectedTestSlug === null
                    ? progress
                    : readingTimePercent(
                        (ebookProgress[selectedTestSlug]?.readingSeconds ?? 0) +
                          (accumulatedSeconds[selectedTestSlug] ?? 0) +
                          liveElapsed
                      )
                }%`,
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsExitDialogOpen(true)}
            aria-label="退出课程阅读器"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dce4df] bg-white text-[#60736a] transition hover:border-[#d79a87] hover:bg-[#fff5f1] hover:text-[#b4513b]"
          >
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside className={`absolute inset-y-0 left-0 z-30 flex w-72 shrink-0 flex-col border-r border-[#dce8e1] bg-[#f1f7f4] p-4 shadow-xl transition-transform lg:static lg:translate-x-0 lg:shadow-none ${
          isReadingMode ? "hidden" : isMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}>
          <div className="mb-4 flex items-center gap-2 px-2 text-sm font-black text-[#315f52]">
            <BookOpenCheck size={16} />
            课程目录
          </div>
          <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {books.map((book, index) => {
              const active = index === selectedBookIndex;
              const unlocked = index === 0 || index <= unlockedLessonCount;
              const testSlug =
                index === 0
                  ? null
                  : `korean-level-one-${String(book.number).padStart(2, "0")}`;
              const bookProgress = testSlug
                ? ebookProgress[testSlug]?.progressPercent ?? 0
                : 0;
              return (
                <button
                  key={`${book.number}-${book.korean}`}
                  type="button"
                  onClick={() => selectBook(index)}
                  disabled={!unlocked}
                  className={`block w-full rounded-2xl p-3 text-left transition ${
                    active
                      ? "bg-white shadow-sm ring-1 ring-[#cfe2d9]"
                      : unlocked
                        ? "hover:bg-white/70"
                        : "cursor-not-allowed opacity-55"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${active ? "bg-[#238777] text-white" : "bg-[#dfece6] text-[#60736a]"}`}>
                      {String(book.number).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-[#294f43]">{book.korean}</span>
                      <span className="mt-1 block text-[11px] font-bold text-[#789087]">{book.chinese}</span>
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${active ? "bg-[#e5f3ee] text-[#238777]" : "bg-[#e6ece9] text-[#71857b]"}`}>
                        {!unlocked
                          ? "未开放"
                          : active
                          ? "当前"
                          : index === 0
                            ? "课程导读"
                            : bookProgress > 0
                              ? `阅读 ${bookProgress}%`
                              : "尚未阅读"}
                      </span>
                    </span>
                    {!unlocked && (
                      <Lock size={14} className="ml-auto shrink-0 text-[#83948b]" />
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>
        {isMenuOpen && !isReadingMode && (
          <button
            type="button"
            aria-label="关闭课程目录"
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 z-20 bg-[#173f4a]/25 lg:hidden"
          />
        )}

        <main
          className={
            isReadingMode
              ? "fixed inset-0 z-40 min-w-0 overflow-hidden bg-[#101613]"
              : "min-w-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-12"
          }
        >
          {selectedLesson?.number === 16 ? (
            <KoreanLevelOneLessonSixteenBook
              key="lesson-16"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 15 ? (
            <KoreanLevelOneLessonFifteenBook
              key="lesson-15"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 14 ? (
            <KoreanLevelOneLessonFourteenBook
              key="lesson-14"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 13 ? (
            <KoreanLevelOneLessonThirteenBook
              key="lesson-13"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 12 ? (
            <KoreanLevelOneLessonTwelveBook
              key="lesson-12"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 11 ? (
            <KoreanLevelOneLessonElevenBook
              key="lesson-11"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 10 ? (
            <KoreanLevelOneLessonTenBook
              key="lesson-10"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 9 ? (
            <KoreanLevelOneLessonNineBook
              key="lesson-9"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 8 ? (
            <KoreanLevelOneLessonEightBook
              key="lesson-8"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 7 ? (
            <KoreanLevelOneLessonSevenBook
              key="lesson-7"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 6 ? (
            <KoreanLevelOneLessonSixBook
              key="lesson-6"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 5 ? (
            <KoreanLevelOneLessonFiveBook
              key="lesson-5"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 4 ? (
            <KoreanLevelOneLessonFourBook
              key="lesson-4"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 3 ? (
            <KoreanLevelOneLessonThreeBook
              key="lesson-3"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson?.number === 2 ? (
            <KoreanLevelOneLessonTwoBook
              key="lesson-2"
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : selectedLesson ? (
            <KoreanLevelOneLessonBook
              key={`lesson-${selectedLesson.number}`}
              lesson={selectedLesson}
              isFullscreen={isReadingMode}
              initialPage={initialSelectedPage}
              onPageChange={handlePageChange}
              speechRate={speechRate}
            />
          ) : (
            <KoreanLevelOneGuideBook
              key="course-guide"
              isFullscreen={isReadingMode}
              onPageChange={setCurrentPage}
            />
          )}
          <section className="hidden">
            <div className="overflow-hidden rounded-[28px] border border-[#d5e8e1] bg-[linear-gradient(135deg,#eaf7f2_0%,#f8fcfb_58%,#fff7ea_100%)] p-6 shadow-sm sm:p-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-black text-[#238777] shadow-sm ring-1 ring-[#d8ebe7]">
                <Compass size={14} />
                第 01 章 · 课程导读
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight text-[#173f4a] sm:text-4xl">从会读，到敢开口表达</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[#607b7a]">韩国语 1 级将带你把韩文字母和发音基础，转换成可用于课堂与日常生活的词汇、句型和短对话能力。</p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {[
                ["你将学会", "掌握高频词汇、基本句型和自我介绍等生活表达。", Sparkles],
                ["学习方式", "每个模块按“听懂 → 跟读 → 组织 → 开口”推进。", ListChecks],
                ["完成目标", "能在常见情境中进行简短、自然的韩语交流。", CheckCircle2],
              ].map(([title, description, Icon]) => {
                const CardIcon = Icon as typeof Sparkles;
                return (
                  <article key={title as string} className="rounded-3xl border border-[#dce8e1] bg-white p-5 shadow-sm">
                    <CardIcon className="text-[#238777]" size={22} />
                    <h2 className="mt-4 text-base font-black text-[#294f43]">{title as string}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#71857b]">{description as string}</p>
                  </article>
                );
              })}
            </div>

            <section className="mt-7 rounded-[28px] border border-[#dce8e1] bg-white p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e5f3ee] text-[#238777]"><ListChecks size={19} /></span>
                <div>
                  <h2 className="font-black text-[#294f43]">建议学习顺序</h2>
                  <p className="mt-1 text-sm text-[#71857b]">每次学习 20–30 分钟，完成练习后再进入下一模块。</p>
                </div>
              </div>
              <ol className="mt-6 grid gap-3 sm:grid-cols-2">
                {["先完成发音与课堂表达，建立开口信心", "用核心词汇为句子搭建素材", "通过基础句型组织自己的意思", "在生活会话中完成听说整合"].map((item, index) => (
                  <li key={item} className="flex items-center gap-3 rounded-2xl bg-[#f4f8f6] p-4 text-sm font-bold text-[#46665b]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-[#238777]">{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </section>

            <p className="mt-8 flex items-center justify-center gap-2 text-xs font-bold text-[#82958c]"><Circle size={10} /> 后续模块将在课程内容发布后按顺序开放</p>
          </section>
        </main>
        {isReadingMode && (
          <div className="fixed right-5 top-5 z-50 flex overflow-hidden rounded-xl border border-white/20 bg-[#173f4a]/85 text-white shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setIsReadingMode(false)}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-black transition hover:bg-[#173f4a]"
            >
              <Minimize2 size={16} />
              退出阅读模式
            </button>
            <button
              type="button"
              onClick={() => setIsExitDialogOpen(true)}
              aria-label="退出课程阅读器"
              className="border-l border-white/20 px-3 transition hover:bg-[#173f4a]"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {isReferenceOpen && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-[#173f4a]/40 p-4 backdrop-blur-sm"
          onClick={() => setIsReferenceOpen(false)}
        >
          <section
            className="w-full max-w-4xl rounded-[28px] border border-[#d6e5de] bg-[#f7fbf9] p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="level-one-reference-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-[#238777]">快速参考</p>
                <h2 id="level-one-reference-title" className="mt-2 text-2xl font-black text-[#173f4a]">韩国语 1 级常用表达</h2>
                <p className="mt-2 text-sm text-[#71857b]">点击韩语表达即可按当前速度播放发音。</p>
              </div>
              <button type="button" onClick={() => setIsReferenceOpen(false)} className="rounded-xl border border-[#dce4df] bg-white p-2 text-[#60736a]"><X size={17} /></button>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["안녕하세요?", "你好。"],
                ["저는 학생이에요.", "我是学生。"],
                ["만나서 반갑습니다.", "很高兴认识你。"],
                ["감사합니다.", "谢谢。"],
                ["잘 모르겠어요.", "我不太清楚。"],
                ["다시 말해 주세요.", "请再说一次。"],
              ].map(([korean, chinese]) => (
                <button key={korean} type="button" onClick={() => speak(korean)} className="rounded-2xl border border-[#dce8e1] bg-white p-4 text-left transition hover:border-[#79b9aa] hover:bg-[#f0f8f5]">
                  <span className="block text-lg font-black text-[#294f43]">{korean}</span>
                  <span className="mt-2 block text-xs font-bold text-[#789087]">{chinese}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {isNotesOpen && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-[#173f4a]/40 p-4 backdrop-blur-sm"
          onClick={() => setIsNotesOpen(false)}
        >
          <section
            className="w-full max-w-2xl rounded-[26px] border border-[#ead9c5] bg-[#fffaf2] p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="level-one-notes-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="level-one-notes-title" className="text-lg font-black text-[#704f2f]">
                  {selectedBookIndex === 0
                    ? "第 00 章学习笔记"
                    : `第 ${String(selectedBook.number).padStart(2, "0")} 课学习笔记`}
                </h2>
                <p className="mt-1 text-xs text-[#92785e]">笔记会自动保存在当前浏览器。</p>
              </div>
              <button type="button" onClick={() => setIsNotesOpen(false)} className="rounded-xl p-2 text-[#92785e] hover:bg-white"><X size={17} /></button>
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="记录学习目标、重点表达或自己的学习计划……"
              className="mt-5 min-h-52 w-full resize-y rounded-2xl border border-[#ead9c5] bg-white/85 p-4 text-sm leading-7 text-[#5f4a36] outline-none transition placeholder:text-[#b6a28f] focus:border-[#c9803c] focus:ring-2 focus:ring-[#f5dfc7]"
            />
          </section>
        </div>
      )}

      {isExitDialogOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#102f35]/55 p-5 backdrop-blur-sm" onClick={() => setIsExitDialogOpen(false)}>
          <section className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-[#f9fcfa] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="korean-level-one-exit-title" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-[#dce8e1] bg-[linear-gradient(135deg,#e7f4ef_0%,#f9fcfa_70%)] px-7 py-6">
              <ArrowLeft className="text-[#238777]" size={22} />
              <h2 id="korean-level-one-exit-title" className="mt-4 text-xl font-black text-[#173f4a]">要退出本次阅读吗？</h2>
              <p className="mt-2 text-sm leading-6 text-[#60736a]">
                当前电子书会保留在课程目录中，你可以随时重新进入。
              </p>
            </div>
            <div className="flex gap-3 px-7 py-5">
              <button type="button" onClick={() => setIsExitDialogOpen(false)} className="flex-1 rounded-xl border border-[#d7e4de] bg-white px-4 py-3 text-sm font-black text-[#526b60] transition hover:bg-[#f2f7f4]">继续阅读</button>
              <button type="button" onClick={() => void exitReader()} className="flex-1 rounded-xl bg-[#238777] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#1d7466]">确认退出</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
