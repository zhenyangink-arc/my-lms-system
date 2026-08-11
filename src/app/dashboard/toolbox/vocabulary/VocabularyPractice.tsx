"use client";

import { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  PartyPopper,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
} from "lucide-react";

export type Word = {
  ko: string;
  zh: string;
  pos: string;
  collocation: string;
  transcription: string;
};

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function speakKorean(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function VocabularyPractice({
  words,
  textbookCount,
  customCount,
}: {
  words: Word[];
  textbookCount: number;
  customCount: number;
}) {
  const [deck, setDeck] = useState<Word[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);

  if (words.length === 0) {
    return (
      <section
        className="app-soft-card flex min-h-64 flex-col items-center justify-center rounded-3xl border p-8 text-center"
        style={{ borderColor: "var(--app-border)" }}
      >
        <BookOpen size={30} className="opacity-40" aria-hidden="true" />
        <p className="mt-3 text-sm font-black">词库还是空的</p>
        <p className="app-muted-text mt-1 text-xs">
          管理员添加单词后，会自动出现在这里。
        </p>
      </section>
    );
  }

  /** ① 开始页 */
  if (!deck) {
    return (
      <section
        className="relative overflow-hidden rounded-3xl border p-8 text-center sm:p-10"
        style={{
          borderColor: "var(--app-border)",
          background:
            "linear-gradient(150deg, var(--app-card-bg), var(--app-accent-soft) 70%, var(--app-hero-end))",
        }}
      >
        <div
          className="pointer-events-none absolute -top-14 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{ backgroundColor: "var(--app-accent-soft)" }}
        />
        <div className="relative">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}
          >
            <Sparkles size={26} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-black">开始翻卡</h2>
          <p className="app-muted-text mx-auto mt-2 max-w-sm text-sm font-bold leading-6">
            从练习词库中随机抽取 {words.length} 个单词，翻卡认识、再学巩固。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
              {words.length} 个单词
            </span>
            <span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>
              教材 {textbookCount}
            </span>
            <span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}>
              自定义 {customCount}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeck(shuffle(words));
              setIndex(0);
              setFlipped(false);
              setKnownCount(0);
            }}
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-8 text-sm font-black text-white shadow-sm transition hover:opacity-90"
            style={{
              background:
                "linear-gradient(135deg, var(--app-accent), color-mix(in srgb, var(--app-accent) 70%, var(--app-secondary)))",
            }}
          >
            <Play size={16} aria-hidden="true" />
            开始练习
          </button>
        </div>
      </section>
    );
  }

  /** ② 闪卡 / 完成 */
  const done = knownCount >= deck.length;
  const currentWord = done ? null : deck[index];
  const progressPercent = deck.length > 0 ? Math.round((knownCount / deck.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="app-card rounded-3xl border p-5" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="app-muted-text text-[10px] font-black tracking-[0.18em]">
              单词练习
            </p>
            <h2 className="mt-0.5 truncate text-lg font-black">本轮 · {deck.length} 词</h2>
          </div>
          <span
            className="shrink-0 rounded-full px-3 py-1 text-xs font-black"
            style={{
              color: "var(--app-accent)",
              backgroundColor: "var(--app-accent-soft)",
            }}
          >
            {knownCount}/{deck.length}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, backgroundColor: "var(--app-success)" }}
            />
          </div>
          <span className="text-xs font-black tabular-nums" style={{ color: "var(--app-success)" }}>
            {progressPercent}%
          </span>
        </div>
      </div>

      {done ? (
        <section
          className="relative overflow-hidden rounded-3xl border p-10 text-center"
          style={{ borderColor: "var(--app-border)", background: "var(--app-card-bg)" }}
        >
          <div
            className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-50 blur-3xl"
            style={{ backgroundColor: "var(--app-success-soft)" }}
          />
          <div className="relative">
            <PartyPopper size={36} className="mx-auto" style={{ color: "var(--app-success)" }} aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">本轮全部完成</h3>
            <p className="app-muted-text mt-2 text-sm font-bold">
              你已经把 {deck.length} 个单词都过了一遍。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--app-success-soft)" }}>
                <p className="text-2xl font-black" style={{ color: "var(--app-success)" }}>{knownCount}</p>
                <p className="app-muted-text mt-0.5 text-xs font-bold">已掌握</p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--app-warm-soft)" }}>
                <p className="text-2xl font-black" style={{ color: "var(--app-warm)" }}>{deck.length}</p>
                <p className="app-muted-text mt-0.5 text-xs font-bold">单词总数</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeck(shuffle(deck));
                setIndex(0);
                setFlipped(false);
                setKnownCount(0);
              }}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition hover:opacity-90"
              style={{ backgroundColor: "var(--app-accent)" }}
            >
              <RotateCcw size={15} aria-hidden="true" />
              打乱再来一轮
            </button>
          </div>
        </section>
      ) : (
        currentWord && (
          <div className="space-y-4">
            <div className="[perspective:1200px]">
              <div
                className={`relative h-80 w-full transition-transform duration-500 [transform-style:preserve-3d] ${
                  flipped ? "[transform:rotateY(180deg)]" : ""
                }`}
              >
                {/* 正面：韩语 */}
                <button
                  type="button"
                  onClick={() => setFlipped((value) => !value)}
                  className="absolute inset-0 overflow-hidden rounded-3xl border [backface-visibility:hidden]"
                  style={{
                    borderColor: "var(--app-border)",
                    background:
                      "linear-gradient(150deg, var(--app-accent-soft), var(--app-card-bg) 55%, var(--app-hero-end))",
                  }}
                >
                  <div
                    className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-60 blur-3xl"
                    style={{ backgroundColor: "var(--app-accent-soft)" }}
                  />
                  <div className="relative flex h-full flex-col items-center justify-center p-6">
                    <span
                      className="rounded-full px-3 py-1 text-[10px] font-black"
                      style={{
                        color: "var(--app-accent)",
                        backgroundColor: "var(--app-accent-soft)",
                      }}
                    >
                      {currentWord.pos || "词汇"}
                    </span>
                    <p className="mt-6 text-center text-4xl font-black tracking-wide">{currentWord.ko}</p>
                    {currentWord.transcription && (
                      <p className="mt-3 text-center text-lg font-bold" style={{ color: "var(--app-accent)" }}>
                        {currentWord.transcription}
                      </p>
                    )}
                    <span className="mt-8 inline-flex items-center gap-1.5 text-xs font-black" style={{ color: "var(--app-accent)" }}>
                      <Volume2 size={13} aria-hidden="true" />
                      点击卡片查看释义
                    </span>
                  </div>
                </button>
                {/* 背面：中文释义 */}
                <button
                  type="button"
                  onClick={() => setFlipped((value) => !value)}
                  className="absolute inset-0 overflow-hidden rounded-3xl border [transform:rotateY(180deg)] [backface-visibility:hidden]"
                  style={{
                    borderColor: "var(--app-border)",
                    background:
                      "linear-gradient(150deg, var(--app-warm-soft), var(--app-card-bg) 55%, var(--app-hero-start))",
                  }}
                >
                  <div
                    className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full opacity-60 blur-3xl"
                    style={{ backgroundColor: "var(--app-warm-soft)" }}
                  />
                  <div className="relative flex h-full flex-col items-center justify-center p-6">
                    <p className="text-center text-3xl font-black">{currentWord.zh || "—"}</p>
                    {currentWord.collocation && (
                      <p className="app-muted-text mt-5 max-w-sm text-center text-sm font-bold leading-6">
                        {currentWord.collocation}
                      </p>
                    )}
                    <span className="app-muted-text mt-8 text-xs font-bold">点击卡片翻回韩语</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setFlipped(false);
                  setIndex((value) => value + 1);
                  setKnownCount((value) => value + 1);
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-white shadow-sm transition hover:opacity-90"
                style={{
                  background:
                    "linear-gradient(135deg, var(--app-success), color-mix(in srgb, var(--app-success) 75%, var(--app-accent)))",
                }}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                认识
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeck((prev) => {
                    if (!prev || prev.length === 0) return prev;
                    const next = [...prev];
                    const [current] = next.splice(index, 1);
                    next.push(current);
                    return next;
                  });
                  setFlipped(false);
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition hover:bg-black/[0.03]"
                style={{ borderColor: "var(--app-border)", color: "var(--app-warm)" }}
              >
                <RotateCcw size={15} aria-hidden="true" />
                再学一遍
              </button>
            </div>

            <button
              type="button"
              onClick={() => speakKorean(currentWord.ko)}
              className="app-muted-text mx-auto flex items-center gap-1.5 text-xs font-black transition hover:opacity-70"
            >
              <Volume2 size={13} aria-hidden="true" />
              朗读发音
            </button>
          </div>
        )
      )}
    </div>
  );
}
