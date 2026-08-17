"use client";

// @refresh reset

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Clock3,
  GraduationCap,
  LibraryBig,
  Lock,
  Maximize2,
  Menu,
  Minimize2,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Volume2,
} from "lucide-react";

import { hangulIntroductionChapters } from "@/lib/korean-curriculum";
import {
  EBOOK_CHAPTER_TARGET_SECONDS,
  getEbookCompletionPercent,
  getVisibleEbookPages,
  MIN_EBOOK_PAGE_READING_SECONDS,
  type KoreanEbookProgressMap,
} from "@/lib/korean-ebook-progress";
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
  /** 伴学课堂模式：翻页实时同步 + 画笔/批注覆盖层。 */
  liveMode?: {
    role: "teacher" | "student";
    /** 课堂右侧抽屉是否展开；收起时阅读器恢复全宽。 */
    sidePanelOpen?: boolean;
    /** 课堂顶栏参与者列表。 */
    participantBar?: ReactNode;
    remotePage: number | null;
    onLocalPageChange: (page: number) => void;
    overlay: ReactNode;
    /** 章目录点击：切换章节（仅老师发起，课堂层负责服务端更新+广播）。 */
    onRequestChapter?: (chapterSlug: string) => void;
  };
};

type LocalStudyState = {
  bookmarkedChapters?: number[];
  notes?: Record<number, string>;
};

type ReadingSegment = {
  eventId: string;
  testSlug: string;
  currentPage: number;
  totalPages: number;
  readPages: number[];
  readingSeconds: number;
  inFlight: boolean;
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

const READING_IDLE_TIMEOUT_MS = 60_000;
const READING_HEARTBEAT_MS = 10_000;


/** 阅读计时（时间制）：累计阅读秒数 → "MM:SS" 格式。 */
function formatReadingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function createReadingEventId() {
  if (typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof window.crypto?.getRandomValues === "function") {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function getChapterUnlockRequirement(chapterIndex: number) {
  if (chapterIndex <= 0) return "进入课程即可学习";
  const prerequisite = hangulIntroductionChapters[chapterIndex - 1];
  return prerequisite
    ? `通过第 ${chapterIndex} 章「${prerequisite.title}」的章节测试后解锁`
    : "通过上一章的章节测试后解锁";
}

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
  liveMode,
}: HangulInteractiveBookProps) {
  const router = useRouter();
  const requestedChapterIndex = hangulIntroductionChapters.findIndex(
    (item) => item.slug === initialChapterSlug
  );
  // 没有 ?chapter= 时，优先恢复「最近有学习记录」的章，否则按课时总进度推算。
  const lastLearnedChapterIndex = (() => {
    let latestIndex = -1;
    let latestAt = 0;
    hangulIntroductionChapters.forEach((item, index) => {
      const record = initialEbookProgress[item.slug];
      if (!record || !((record.readingSeconds ?? 0) > 0)) return;
      const readAt = record.lastReadAt ? Date.parse(record.lastReadAt) : 0;
      if (latestIndex === -1 || readAt > latestAt) {
        latestIndex = index;
        latestAt = readAt;
      }
    });
    return latestIndex;
  })();
  const initialChapter =
    requestedChapterIndex >= 0
      ? requestedChapterIndex
      : lastLearnedChapterIndex >= 0
        ? lastLearnedChapterIndex
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

  // 伴学课堂：老师切换章节时（initialChapterSlug 变化）跟随换书。
  useEffect(() => {
    if (!liveMode) return;
    const requested = hangulIntroductionChapters.findIndex(
      (item) => item.slug === initialChapterSlug
    );
    if (requested >= 0) {
      // The live classroom chapter is an external synchronized snapshot.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChapterIndex(
        Math.min(requested, hangulIntroductionChapters.length - 1)
      );
    }
  }, [initialChapterSlug, liveMode]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBookFullscreen, setIsBookFullscreen] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [bookmarkedChapters, setBookmarkedChapters] = useState<number[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [hasLoadedLocalState, setHasLoadedLocalState] = useState(false);
  const [ebookProgress, setEbookProgress] =
    useState<KoreanEbookProgressMap>(initialEbookProgress);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState<Record<string, number>>({});
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [isIdleWarningOpen, setIsIdleWarningOpen] = useState(false);
  const lastActivityAtRef = useRef(0);
  const isIdlePausedRef = useRef(false);
  const pendingReadingSegmentsRef = useRef<Map<string, ReadingSegment>>(
    new Map()
  );
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

  async function toggleBookFullscreen() {
    const ebook = ebookRef.current;
    if (!ebook) return;

    if (isBookFullscreen) {
      // When the ebook is stacked above the already-fullscreen course reader,
      // exiting once reveals the course reader underneath instead of leaving it.
      if (document.fullscreenElement === ebook) {
        try {
          await document.exitFullscreen();
        } catch {
          // The CSS state below still restores the normal reader layout.
        }
      }
      setIsBookFullscreen(false);
      return;
    }

    try {
      await ebook.requestFullscreen();
    } catch {
      // Embedded browsers may reject nested fullscreen; CSS remains the fallback.
    }
    setIsBookFullscreen(true);
  }

  function connectEbookElement(node: HTMLElement | null) {
    if (ebookRef.current) {
      ebookRef.current.onfullscreenchange = null;
    }

    ebookRef.current = node;
    if (node) {
      node.onfullscreenchange = () => {
        setIsBookFullscreen(document.fullscreenElement === node);
      };
    }
  }

  async function confirmExitReader() {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Continue returning to the course when the browser refuses this request.
      }
    }

    await flushReadingTime(chapter.slug, currentPageCount);
    router.push(backHref);
  }

  async function openAssignmentBoard() {
    const savedSeconds =
      (ebookProgress[chapter.slug]?.readingSeconds ?? 0) +
      (accumulatedSeconds[chapter.slug] ?? 0) +
      liveElapsed;
    if (savedSeconds < EBOOK_CHAPTER_TARGET_SECONDS) return;
    await flushReadingTime(chapter.slug, currentPageCount);
    const coursesMarker = "/courses";
    const coursesIndex = backHref.indexOf(coursesMarker);
    const workspaceBasePath =
      coursesIndex >= 0 ? backHref.slice(0, coursesIndex) : "/dashboard";
    router.push(`${workspaceBasePath}/assignments`);
  }

  function openChapter(index: number) {
    if (liveMode) {
      // 伴学课堂：点击章目录请求切换章节（由课堂层服务端更新 + 广播同步双方）。
      const chapter = hangulIntroductionChapters[index];
      if (chapter) liveMode.onRequestChapter?.(chapter.slug);
      return;
    }
    if (index >= unlockedChapterCount) return;
    setLiveElapsed(0);
    setChapterIndex(index);
    setIsMenuOpen(false);
    setIsNotesOpen(false);
  }

  function handlePageChange(page: number) {
    // 先结算离开的书页；停留不足阈值的快速翻页不会记为已读。
    void flushReadingTime(chapter.slug, currentPageCount);
    const boundedPage = Math.min(Math.max(0, page), currentPageCount - 1);
    setEbookProgress((current) => ({
      ...current,
      [chapter.slug]: {
        ...current[chapter.slug],
        currentPage: boundedPage,
        totalPages: currentPageCount,
        progressPercent: current[chapter.slug]?.progressPercent ?? 0,
        readPages: current[chapter.slug]?.readPages ?? [],
      },
    }));
    // 伴学课堂：本地翻页上报给课堂层做实时同步（远端翻页带防循环）。
    if (liveMode) {
      liveMode.onLocalPageChange(boundedPage);
    }
    if (!trackingDisabled) {
      void saveKoreanEbookProgressAction({
        testSlug: chapter.slug,
        currentPage: boundedPage,
        totalPages: currentPageCount,
      });
    }
  }

  // 阅读目标、进度和测试解锁共用同一条章节时长规则。
  const chapterStartRef = useRef<number>(0);
  const ebookProgressRef = useRef(ebookProgress);
  useEffect(() => {
    if (chapterStartRef.current === 0) {
      chapterStartRef.current = Date.now();
    }
    ebookProgressRef.current = ebookProgress;
  }, [ebookProgress]);

  function acknowledgeReadingSegment(
    eventId: string,
    totalReadingSeconds: number | undefined
  ) {
    const segment = pendingReadingSegmentsRef.current.get(eventId);
    if (!segment) return;
    pendingReadingSegmentsRef.current.delete(eventId);
    setAccumulatedSeconds((current) => ({
      ...current,
      [segment.testSlug]: Math.max(
        0,
        (current[segment.testSlug] ?? 0) - segment.readingSeconds
      ),
    }));
    if (!Number.isFinite(totalReadingSeconds)) return;
    setEbookProgress((current) => ({
      ...current,
      [segment.testSlug]: {
        ...current[segment.testSlug],
        currentPage:
          current[segment.testSlug]?.currentPage ?? segment.currentPage,
        totalPages:
          current[segment.testSlug]?.totalPages ?? segment.totalPages,
        progressPercent:
          current[segment.testSlug]?.progressPercent ?? 0,
        readPages: current[segment.testSlug]?.readPages ?? [],
        readingSeconds: Math.max(
          current[segment.testSlug]?.readingSeconds ?? 0,
          Number(totalReadingSeconds) || 0
        ),
      },
    }));
  }

  async function persistReadingSegment(
    segment: ReadingSegment,
    transport: "action" | "keepalive"
  ) {
    if (transport === "action" && segment.inFlight) return;
    segment.inFlight = true;
    const payload = {
      eventId: segment.eventId,
      testSlug: segment.testSlug,
      currentPage: segment.currentPage,
      totalPages: segment.totalPages,
      readPages: segment.readPages,
      readingSeconds: segment.readingSeconds,
    };

    try {
      const result = transport === "keepalive"
        ? await fetch("/api/ebook-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
            keepalive: true,
          }).then(async (response) => {
            if (!response.ok) return { status: "error" as const };
            return (await response.json()) as {
              status: "success" | "error";
              totalReadingSeconds?: number;
            };
          })
        : await saveKoreanEbookProgressAction(payload);
      if (result.status === "success") {
        acknowledgeReadingSegment(
          segment.eventId,
          result.totalReadingSeconds
        );
      } else {
        segment.inFlight = false;
      }
    } catch {
      segment.inFlight = false;
    }
  }

  async function persistPendingReadingSegments(
    transport: "action" | "keepalive"
  ) {
    const segments = Array.from(pendingReadingSegmentsRef.current.values());
    await Promise.all(
      segments.map((segment) => persistReadingSegment(segment, transport))
    );
  }

  async function flushReadingTime(
    slug: string,
    totalPages: number,
    options?: { allowHidden?: boolean; transport?: "action" | "keepalive" }
  ) {
    if (
      trackingDisabled ||
      isIdlePausedRef.current ||
      (!options?.allowHidden && document.visibilityState !== "visible")
    ) {
      chapterStartRef.current = Date.now();
      return;
    }
    const elapsed = Math.min(
      35,
      Math.floor((Date.now() - chapterStartRef.current) / 1000)
    );
    if (elapsed <= 0) {
      await persistPendingReadingSegments(options?.transport ?? "action");
      return;
    }
    chapterStartRef.current = Date.now();
    setLiveElapsed(0);
    const trackedPage = ebookProgressRef.current[slug]?.currentPage ?? 0;
    const visiblePages = getVisibleEbookPages(trackedPage, totalPages);
    const qualifiedPages =
      elapsed >= MIN_EBOOK_PAGE_READING_SECONDS ? visiblePages : [];
    if (qualifiedPages.length > 0) {
      setEbookProgress((current) => ({
        ...current,
        [slug]: {
          ...current[slug],
          currentPage: trackedPage,
          totalPages,
          progressPercent: current[slug]?.progressPercent ?? 0,
          readPages: Array.from(
            new Set([...(current[slug]?.readPages ?? []), ...qualifiedPages])
          ),
        },
      }));
    }
    setAccumulatedSeconds((prev) => ({
      ...prev,
      [slug]: (prev[slug] ?? 0) + elapsed,
    }));
    const eventId = createReadingEventId();
    pendingReadingSegmentsRef.current.set(eventId, {
      eventId,
      testSlug: slug,
      currentPage: trackedPage,
      totalPages,
      readPages: qualifiedPages,
      readingSeconds: elapsed,
      inFlight: false,
    });
    await persistPendingReadingSegments(options?.transport ?? "action");
  }

  // 进入章节重置计时起点；每 10 秒把幂等计时片段写入数据库；
  // 刷新/关闭页面时用 keepalive 补存，数据库按 eventId 防止重复累计。
  useEffect(() => {
    if (trackingDisabled) return;
    const trackedSlug = chapter.slug;
    const trackedPageCount = currentPageCount;
    const flushTrackedChapter = () =>
      void flushReadingTime(trackedSlug, trackedPageCount);
    const flushBeforePageHide = () =>
      void flushReadingTime(trackedSlug, trackedPageCount, {
        allowHidden: true,
        transport: "keepalive",
      });
    chapterStartRef.current = Date.now();
    const timer = window.setInterval(flushTrackedChapter, READING_HEARTBEAT_MS);
    window.addEventListener("pagehide", flushBeforePageHide);
    return () => {
      flushTrackedChapter();
      window.clearInterval(timer);
      window.removeEventListener("pagehide", flushBeforePageHide);
    };
    // flushReadingTime deliberately captures the current tracking setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.slug, currentPageCount, trackingDisabled]);

  // 本会话已流逝秒数：每秒刷新，让右上角计时实时走动。
  useEffect(() => {
    if (trackingDisabled) return;
    const updateElapsed = () => {
      if (
        isIdlePausedRef.current ||
        document.visibilityState !== "visible"
      ) {
        setLiveElapsed(0);
        return;
      }
      setLiveElapsed(
        Math.min(
          35,
          Math.floor((Date.now() - chapterStartRef.current) / 1000)
        )
      );
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        void flushReadingTime(chapter.slug, currentPageCount, {
          allowHidden: true,
          transport: "keepalive",
        });
        return;
      }
      chapterStartRef.current = Date.now();
      lastActivityAtRef.current = Date.now();
      setLiveElapsed(0);
    };
    const tick = window.setInterval(() => {
      updateElapsed();
    }, 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // The active chapter values deliberately restart the visibility tracker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.slug, currentPageCount, trackingDisabled]);

  useEffect(() => {
    if (trackingDisabled) return;

    const resumeFromIdle = () => {
      lastActivityAtRef.current = Date.now();
      if (!isIdlePausedRef.current) return;
      isIdlePausedRef.current = false;
      chapterStartRef.current = Date.now();
      setLiveElapsed(0);
      setIsIdleWarningOpen(false);
    };

    lastActivityAtRef.current = Date.now();
    const activityEvents: Array<keyof WindowEventMap> = [
      "pointermove",
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
    ];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, resumeFromIdle, { passive: true });
    }

    const idleCheck = window.setInterval(() => {
      if (
        isIdlePausedRef.current ||
        document.visibilityState !== "visible" ||
        Date.now() - lastActivityAtRef.current < READING_IDLE_TIMEOUT_MS
      ) {
        return;
      }

      // The call starts synchronously and settles the last active slice before
      // the paused flag prevents subsequent heartbeats from adding time.
      void flushReadingTime(chapter.slug, currentPageCount);
      isIdlePausedRef.current = true;
      setLiveElapsed(0);
      setIsIdleWarningOpen(true);
    }, 1_000);

    return () => {
      window.clearInterval(idleCheck);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, resumeFromIdle);
      }
    };
    // The active chapter values deliberately restart the idle window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.slug, currentPageCount, trackingDisabled]);

  const currentReadingSeconds =
    (ebookProgress[chapter.slug]?.readingSeconds ?? 0) +
    (accumulatedSeconds[chapter.slug] ?? 0) +
    liveElapsed;
  const currentTargetTimePercent = Math.min(
    100,
    Math.round(
      (currentReadingSeconds / EBOOK_CHAPTER_TARGET_SECONDS) * 100
    )
  );
  const readingTimeTargetReached =
    currentReadingSeconds >= EBOOK_CHAPTER_TARGET_SECONDS;
  const targetTimerSeconds = Math.max(
    0,
    EBOOK_CHAPTER_TARGET_SECONDS - currentReadingSeconds
  );

  function toggleBookmark() {
    setBookmarkedChapters((current) =>
      current.includes(chapterIndex)
        ? current.filter((index) => index !== chapterIndex)
        : [...current, chapterIndex]
    );
  }

  function removeBookmark(index: number) {
    setBookmarkedChapters((current) =>
      current.filter((bookmarkedIndex) => bookmarkedIndex !== index)
    );
  }

  function speak(text: string, rate = speechRate) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div
      id="guide-target-beginner-course"
      ref={bookRef}
      className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-[var(--status-warning-surface)] text-[var(--foreground)] transition-[right] duration-300 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-[var(--ring)] [&_a:focus-visible]:ring-offset-2 [&_input:focus-visible]:outline-none [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[var(--ring)] [&_input:focus-visible]:ring-offset-2 ${
        liveMode?.sidePanelOpen ? "right-72" : "right-0 w-full"
      }`}
    >
      <header className="relative z-40 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)]/95 px-3 py-2.5 shadow-[0_1px_0_var(--border)] backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsExitDialogOpen(true)}
            aria-label="返回课程"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground-secondary)] shadow-sm transition hover:-translate-x-0.5 hover:border-[var(--border)] hover:bg-[var(--status-warning-surface)]"
          >
            <ArrowLeft aria-hidden="true" size={17} />
          </button>
          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            aria-label="打开章节目录"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground-secondary)] transition hover:bg-[var(--status-warning-surface)] lg:hidden"
          >
            <Menu aria-hidden="true" size={17} />
          </button>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={isSidebarCollapsed ? "展开章节目录" : "收起章节目录"}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--foreground-secondary)] transition hover:bg-[var(--status-warning-surface)] lg:flex"
          >
            {isSidebarCollapsed ? <PanelLeftOpen aria-hidden="true" size={18} /> : <PanelLeftClose aria-hidden="true" size={18} />}
          </button>
          <span className="hidden h-6 w-px bg-[var(--status-warning-surface)] sm:block" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-bold text-[var(--foreground)] sm:text-[15px]">韩语字母入门</p>
              <span className="hidden rounded-full bg-[var(--status-warning-surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-warning)] md:inline">
                第 {chapterIndex + 1} 章
              </span>
            </div>
            <p className="mt-0.5 hidden max-w-[26rem] truncate text-[11px] font-bold text-[var(--foreground-secondary)] sm:block">
              {chapter.title} · {chapter.koreanTitle}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
          {liveMode && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-success)] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm"
              title="实时伴学课堂"
            >
              <GraduationCap aria-hidden="true" size={13} />
              伴学课堂
            </span>
          )}
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto" aria-label="学习工具">
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--status-success)]">
              <Settings2 aria-hidden="true" size={14} />
              学习工具
            </span>
            <div className="flex shrink-0 items-center gap-1 rounded-xl bg-[var(--status-success-surface)] p-1" title="选择速度后会播放韩语示例；电子书内扬声器发音按此速度播放">
              <Volume2 aria-hidden="true" size={13} className="ml-1 text-[var(--status-success)]" />
              <span className="text-[10px] font-bold text-[var(--status-success)]">发音速度</span>
              {[
                { label: "慢速", value: 0.8 },
                { label: "标准", value: 1 },
                { label: "快速", value: 1.2 },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setSpeechRate(option.value);
                    speak("안녕하세요", option.value);
                  }}
                  aria-pressed={speechRate === option.value}
                  title={`切换到${option.label}并试听`}
                  className={`rounded-lg px-2 py-1.5 text-[10px] font-bold transition ${
                    speechRate === option.value
                      ? "bg-[var(--status-success)] text-white shadow-sm"
                      : "text-[var(--foreground-secondary)] hover:bg-white hover:text-[var(--status-success)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsReferenceOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-white px-2.5 text-[11px] font-bold text-[var(--status-success)] transition hover:border-[var(--border)] hover:bg-[var(--status-success-surface)] hover:text-[var(--status-success)]"
            >
              <Search aria-hidden="true" size={14} />
              字母速查
            </button>
            <button
              type="button"
              onClick={toggleBookmark}
              aria-pressed={isBookmarked}
              className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold transition ${
                isBookmarked
                  ? "border-[var(--border)] bg-[var(--status-warning-surface)] text-[var(--status-warning)] hover:bg-[var(--status-warning-surface)]"
                  : "border-[var(--border)] bg-white text-[var(--status-success)] hover:border-[var(--border)] hover:bg-[var(--card)] hover:text-[var(--status-warning)]"
              }`}
            >
              {isBookmarked ? <BookmarkCheck aria-hidden="true" size={14} /> : <Bookmark aria-hidden="true" size={14} />}
              {isBookmarked ? "已加书签" : "加入书签"}
            </button>
            <button
              type="button"
              onClick={() => setIsNotesOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-white px-2.5 text-[11px] font-bold text-[var(--status-success)] transition hover:border-[var(--border)] hover:bg-[var(--status-success-surface)] hover:text-[var(--status-success)]"
            >
              <NotebookPen aria-hidden="true" size={14} />
              本章笔记
            </button>
          </div>
          <div className="hidden min-w-32 items-center justify-between gap-3 rounded-2xl bg-[var(--status-warning-surface)] px-3 py-2 md:flex">
            <span className="text-[10px] font-bold text-[var(--foreground-secondary)]">本章阅读</span>
            <span className="tabular-nums text-xs font-bold text-[var(--status-warning)]">
              {formatReadingTime(currentReadingSeconds)}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleBookFullscreen}
            aria-label={isBookFullscreen ? "退出电子书全屏" : "电子书全屏"}
            aria-pressed={isBookFullscreen}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--primary)] hover:shadow-md"
          >
            {isBookFullscreen ? <Minimize2 aria-hidden="true" size={17} /> : <Maximize2 aria-hidden="true" size={17} />}
            <span className="hidden lg:inline">{isBookFullscreen ? "退出专注" : "专注阅读"}</span>
          </button>
        </div>
      </header>

      {liveMode?.participantBar && (
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--status-warning-surface)]/95 px-4 py-1.5 sm:px-5">
          {liveMode.participantBar}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={`absolute inset-y-0 left-0 z-30 flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--status-warning-surface)]/95 p-4 shadow-xl backdrop-blur-xl transition-[transform,width,padding] duration-300 lg:static lg:translate-x-0 lg:shadow-none ${
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          } ${isSidebarCollapsed ? "lg:w-[76px] lg:p-3" : "lg:w-64 lg:p-4"}`}
        >
          <div className={`mb-4 flex min-h-9 items-center text-sm font-bold text-[var(--foreground-secondary)] ${isSidebarCollapsed ? "justify-center" : "gap-2 px-2"}`}>
            <LibraryBig aria-hidden="true" size={17} className="shrink-0" />
            {!isSidebarCollapsed && <span>学习目录</span>}
          </div>
          <nav className="space-y-2" aria-label="章节目录">
            {hangulIntroductionChapters.map((item, index) => {
              const active = index === chapterIndex;
              const unlocked = index < unlockedChapterCount;
              const bookmarked = bookmarkedChapters.includes(index);
              const unlockRequirement = getChapterUnlockRequirement(index);
              const readingSeconds =
                (ebookProgress[item.slug]?.readingSeconds ?? 0) +
                (accumulatedSeconds[item.slug] ?? 0) +
                (active ? liveElapsed : 0);
              const chapterProgress = getEbookCompletionPercent({
                readingSeconds,
                readPages: ebookProgress[item.slug]?.readPages ?? [],
                totalPages: hangulChapterPageCounts[item.slug] ?? 1,
              });
              return (
                <div key={item.slug} className="group relative">
                  <button
                    type="button"
                    onClick={() => openChapter(index)}
                    disabled={!unlocked}
                    title={isSidebarCollapsed && unlocked ? `${item.title} · ${item.koreanTitle}` : undefined}
                    className={`w-full rounded-2xl text-left transition ${
                      isSidebarCollapsed
                        ? "p-2"
                        : bookmarked
                          ? "py-3 pl-3 pr-12"
                          : "p-3"
                    } ${
                      active
                        ? "bg-[var(--card)] shadow-[0_8px_24px_var(--border)] ring-1 ring-[var(--border)]"
                        : unlocked
                          ? "hover:bg-white/70"
                          : "cursor-not-allowed border border-[var(--border)] bg-[var(--status-warning-surface)]/75"
                    }`}
                  >
                    <span className={`flex items-start ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
                      <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition ${
                        active ? "bg-[var(--status-success)] text-white" : "bg-[var(--status-warning-surface)] text-[var(--foreground-secondary)]"
                      }`}>
                        {String(index + 1).padStart(2, "0")}
                        {!unlocked && isSidebarCollapsed && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--border)] text-[var(--status-warning)] ring-2 ring-[var(--border)]">
                            <Lock aria-hidden="true" size={9} strokeWidth={2.5} />
                          </span>
                        )}
                      </span>
                      {!isSidebarCollapsed && (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-[var(--foreground)]">{item.title}</span>
                            <span className="mt-1 block text-[11px] font-bold text-[var(--foreground-secondary)]">{item.koreanTitle}</span>
                            {unlocked && (
                              <span className="mt-2 block text-[10px] font-bold text-[var(--status-warning)]">
                                {chapterProgress > 0
                                  ? `阅读 ${chapterProgress}%`
                                  : "尚未阅读"}
                              </span>
                            )}
                          </span>
                          {!unlocked && (
                            <span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--status-warning-surface)] text-[var(--status-warning)] ring-1 ring-[var(--border)]">
                              <Lock aria-hidden="true" size={13} strokeWidth={2.4} />
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </button>
                  {bookmarked && (
                    <button
                      type="button"
                      onClick={() => removeBookmark(index)}
                      aria-label={`取消第 ${index + 1} 章书签`}
                      title="点击取消书签"
                      className={`absolute z-20 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--status-warning-surface)] text-[var(--status-warning)] shadow-sm transition hover:bg-[var(--status-warning-surface)] hover:text-[var(--status-warning)] ${
                        isSidebarCollapsed
                          ? "-bottom-1 -right-1 h-6 w-6"
                          : "right-3 top-3 h-7 w-7"
                      }`}
                    >
                      <BookmarkCheck aria-hidden="true" size={14} />
                    </button>
                  )}
                  {!unlocked && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 w-64 -translate-y-1/2 translate-x-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 opacity-0 shadow-[0_14px_38px_var(--border)] transition duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                    >
                      <p className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--status-warning)]">
                        <Lock aria-hidden="true" size={11} />
                        第 {index + 1} 章尚未解锁
                      </p>
                      <p className="mt-1 text-[11px] font-bold leading-5 text-[var(--status-warning)]">
                        {unlockRequirement}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          {!isSidebarCollapsed && (
            <div className="mt-auto rounded-2xl border border-[var(--border)] bg-[linear-gradient(145deg,var(--status-warning-surface),var(--status-warning-surface))] p-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-[var(--foreground-secondary)]">
                <span>本章学习目标</span>
                <span className="tabular-nums text-[var(--status-warning)]">
                  {readingTimeTargetReached
                    ? "已达标"
                    : `剩余 ${formatReadingTime(targetTimerSeconds)}`}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[var(--status-success)]" style={{ width: `${currentTargetTimePercent}%` }} />
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[var(--foreground-secondary)]">
                连续 60 秒无学习操作会暂停计时；累计有效阅读时间达标后完成本章。
              </p>
            </div>
          )}
        </aside>

        {isMenuOpen && (
          <button
            type="button"
            aria-label="关闭章节目录"
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 z-20 bg-[var(--primary)]/25 lg:hidden"
          />
        )}

        <main className="relative min-w-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_20%_0%,var(--card),transparent_36%),radial-gradient(circle_at_100%_100%,var(--border),transparent_42%),linear-gradient(145deg,var(--status-warning-surface),var(--status-warning-surface))] px-2 py-3 sm:px-4 lg:px-6 lg:py-5">
          <div aria-hidden="true" className="pointer-events-none absolute -left-20 bottom-8 h-56 w-56 rounded-full border-[28px] border-white/30" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--status-warning-surface)]/55" />
          <section
            ref={connectEbookElement}
            className={`relative mx-auto flex h-full min-h-0 w-full max-w-[1500px] items-stretch justify-center overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg ring-1 ring-[var(--border)] transition-[right] duration-300 sm:p-2 ${
            isBookFullscreen
              ? `fixed inset-y-0 left-0 z-[80] h-[100dvh] max-w-none rounded-none border-0 bg-[var(--status-success)] p-0 ring-0 ${
                  liveMode?.sidePanelOpen ? "right-72" : "right-0 w-screen"
                }`
              : ""
          }`}>
            {chapterIndex === 0 ? (
              <HangulBookOpening key={chapter.slug} isFullscreen={isBookFullscreen} speechRate={speechRate} initialPage={currentPage} onPageChange={handlePageChange} onStartTest={() => void openAssignmentBoard()} testLocked={!readingTimeTargetReached} live={liveMode ? { page: liveMode.remotePage, overlay: liveMode.overlay } : undefined} />
            ) : chapterIndex === 1 ? (
              <VowelsConsonantsBook key={chapter.slug} isFullscreen={isBookFullscreen} speechRate={speechRate} initialPage={currentPage} onPageChange={handlePageChange} onStartTest={() => void openAssignmentBoard()} testLocked={!readingTimeTargetReached} live={liveMode ? { page: liveMode.remotePage, overlay: liveMode.overlay } : undefined} />
            ) : chapterIndex === 2 ? (
              <BatchimReadingBook key={chapter.slug} isFullscreen={isBookFullscreen} speechRate={speechRate} initialPage={currentPage} onPageChange={handlePageChange} onStartTest={() => void openAssignmentBoard()} testLocked={!readingTimeTargetReached} live={liveMode ? { page: liveMode.remotePage, overlay: liveMode.overlay } : undefined} />
            ) : (
              <PronunciationRulesBook key={chapter.slug} isFullscreen={isBookFullscreen} speechRate={speechRate} initialPage={currentPage} onPageChange={handlePageChange} onStartTest={() => void openAssignmentBoard()} testLocked={!readingTimeTargetReached} live={liveMode ? { page: liveMode.remotePage, overlay: liveMode.overlay } : undefined} />
            )}
            {isBookFullscreen && (
              <button
                type="button"
                onClick={() => void toggleBookFullscreen()}
                className="absolute right-5 top-5 z-[90] inline-flex items-center gap-2 rounded-xl border border-white/20 bg-[var(--primary)]/85 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-[var(--primary)]"
              >
                <Minimize2 aria-hidden="true" size={16} />
                退出专注
              </button>
            )}
          </section>
        </main>
      </div>

      {isReferenceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--primary)]/35 p-4"
          role="presentation"
          onClick={() => setIsReferenceOpen(false)}
        >
          <section
            className="w-full max-w-6xl rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-2xl sm:p-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hangul-reference-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 id="hangul-reference-title" className="text-xl font-bold text-[var(--status-success)]">韩文字母速查表</h3>
                <p className="mt-2 text-base text-[var(--foreground-secondary)]">点击任意字母即可听发音；下方为拼音近似读音</p>
              </div>
              <button type="button" onClick={() => setIsReferenceOpen(false)} className="text-base font-bold text-[var(--foreground-secondary)]">关闭</button>
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-3">
              <div>
                <p className="mb-4 text-base font-bold tracking-widest text-[var(--status-success)]">
                  单元音 · {hangulReference.vowels.slice(0, 10).length} 个
                </p>
                <div className="flex flex-wrap gap-4">
                  {hangulReference.vowels.slice(0, 10).map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      title={`播放 ${letter} 的发音`}
                      onClick={() => speak(letter)}
                      className="flex h-[88px] w-20 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-white transition hover:border-[var(--border)] hover:text-[var(--status-success)]"
                    >
                      <span className="text-3xl font-bold text-[var(--primary)]">{letter}</span>
                      <span className="mt-1.5 text-xs font-bold leading-none text-[var(--foreground-secondary)]">{hangulPinyinHints[letter]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-4 text-base font-bold tracking-widest text-[var(--status-success)]">
                  双元音 · {hangulReference.vowels.slice(10).length} 个
                </p>
                <div className="flex flex-wrap gap-4">
                  {hangulReference.vowels.slice(10).map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      title={`播放 ${letter} 的发音`}
                      onClick={() => speak(letter)}
                      className="flex h-[88px] w-20 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-white transition hover:border-[var(--border)] hover:text-[var(--status-success)]"
                    >
                      <span className="text-3xl font-bold text-[var(--primary)]">{letter}</span>
                      <span className="mt-1.5 text-xs font-bold leading-none text-[var(--foreground-secondary)]">{hangulPinyinHints[letter]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-4 text-base font-bold tracking-widest text-[var(--status-success)]">
                  辅音 · {hangulReference.consonants.length} 个
                </p>
                <div className="flex flex-wrap gap-4">
                  {hangulReference.consonants.map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      title={`播放 ${letter} 的发音`}
                      onClick={() => speak(letter)}
                      className="flex h-[88px] w-24 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-white transition hover:border-[var(--border)] hover:text-[var(--status-success)]"
                    >
                      <span className="text-3xl font-bold text-[var(--primary)]">{letter}</span>
                      <span className="mt-1.5 text-xs font-bold leading-none text-[var(--foreground-secondary)]">{hangulPinyinHints[letter]}</span>
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
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--primary)]/55 p-5 backdrop-blur-sm"
          role="presentation"
          onClick={() => setIsExitDialogOpen(false)}
        >
          <section
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-[var(--card)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-reader-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[var(--border)] bg-[linear-gradient(135deg,var(--status-success-surface)_0%,var(--card)_70%)] px-7 py-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--status-success)] shadow-sm">
                <ArrowLeft aria-hidden="true" size={20} />
              </div>
              <h3 id="exit-reader-title" className="mt-4 text-xl font-bold tracking-tight text-[var(--primary)]">
                要退出本次阅读吗？
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                你的笔记与书签已自动保存。确认后将退出全屏并返回课程目录。
              </p>
            </div>
            <div className="flex gap-3 px-7 py-5">
              <button
                type="button"
                onClick={() => setIsExitDialogOpen(false)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--status-success)] transition hover:bg-[var(--status-success-surface)]"
              >
                继续阅读
              </button>
              <button
                type="button"
                onClick={() => void confirmExitReader()}
                className="flex-1 rounded-xl bg-[var(--status-success)] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--status-success)]"
              >
                确认退出
              </button>
            </div>
          </section>
        </div>
      )}

      {isIdleWarningOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--status-warning)]/45 p-5 backdrop-blur-sm">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reading-idle-warning-title"
            className="w-full max-w-sm rounded-[26px] border border-white/70 bg-[var(--card)] p-6 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--status-warning-surface)] text-[var(--status-warning)]">
              <Clock3 aria-hidden="true" size={22} />
            </div>
            <h3 id="reading-idle-warning-title" className="mt-4 text-lg font-bold text-[var(--foreground)]">
              阅读计时已暂停
            </h3>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--foreground-secondary)]">
              连续 60 秒未检测到学习操作。移动鼠标、使用键盘、触摸页面或点击下方按钮即可继续。
            </p>
            <button
              type="button"
              onClick={() => {
                lastActivityAtRef.current = Date.now();
                isIdlePausedRef.current = false;
                chapterStartRef.current = Date.now();
                setLiveElapsed(0);
                setIsIdleWarningOpen(false);
              }}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--status-success)] px-4 text-sm font-bold text-white transition hover:bg-[var(--status-success)]"
            >
              继续学习
            </button>
          </section>
        </div>
      )}

      {isNotesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--primary)]/35 p-4"
          role="presentation"
          onClick={() => setIsNotesOpen(false)}
        >
          <section
            className="w-full max-w-2xl rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chapter-notes-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 id="chapter-notes-title" className="text-base font-bold text-[var(--status-warning)]">
                  第 {chapterIndex + 1} 章学习笔记
                </h3>
                <p className="mt-1 text-xs text-[var(--status-warning)]">内容自动保存在当前浏览器</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNotesOpen(false)}
                className="text-xs font-bold text-[var(--status-warning)]"
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
              className="mt-4 min-h-36 w-full resize-y rounded-2xl border border-[var(--border)] bg-white/80 p-4 text-sm leading-6 text-[var(--foreground-secondary)] outline-none transition placeholder:text-[var(--foreground-muted)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]"
            />
          </section>
        </div>
      )}
    </div>
  );
}
