"use client";

import { Dices, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

export const QUESTION_DIFFICULTIES = [
  "foundation",
  "medium",
  "hard",
  "expert",
] as const;

export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export const QUESTION_DIFFICULTY_LABELS: Record<
  QuestionDifficulty,
  string
> = {
  foundation: "基础",
  medium: "中等",
  hard: "困难",
  expert: "极难",
};

type SelectableQuestion = {
  id: string;
  difficulty: string;
};

const defaultPercentages: Record<QuestionDifficulty, number> = {
  foundation: 40,
  medium: 30,
  hard: 20,
  expert: 10,
};

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function allocateCounts(
  total: number,
  percentages: Record<QuestionDifficulty, number>
) {
  const raw = QUESTION_DIFFICULTIES.map((difficulty) => ({
    difficulty,
    value: (total * percentages[difficulty]) / 100,
  }));
  const counts = Object.fromEntries(
    raw.map((item) => [item.difficulty, Math.floor(item.value)])
  ) as Record<QuestionDifficulty, number>;
  let remainder =
    total -
    QUESTION_DIFFICULTIES.reduce(
      (sum, difficulty) => sum + counts[difficulty],
      0
    );

  [...raw]
    .sort(
      (left, right) =>
        right.value -
        Math.floor(right.value) -
        (left.value - Math.floor(left.value))
    )
    .forEach((item) => {
      if (remainder <= 0) return;
      counts[item.difficulty] += 1;
      remainder -= 1;
    });
  return counts;
}

export function DifficultyRandomSelector({
  questions,
  onSelected,
  defaultTotal = 20,
  compact = false,
}: {
  questions: SelectableQuestion[];
  onSelected: (questionIds: string[]) => void;
  defaultTotal?: number;
  compact?: boolean;
}) {
  const [total, setTotal] = useState(
    Math.max(1, Math.min(defaultTotal, questions.length || defaultTotal))
  );
  const [percentages, setPercentages] = useState(defaultPercentages);
  const [message, setMessage] = useState("");
  const availability = useMemo(() => {
    const counts = Object.fromEntries(
      QUESTION_DIFFICULTIES.map((difficulty) => [difficulty, 0])
    ) as Record<QuestionDifficulty, number>;
    questions.forEach((question) => {
      if (QUESTION_DIFFICULTIES.includes(question.difficulty as QuestionDifficulty)) {
        counts[question.difficulty as QuestionDifficulty] += 1;
      }
    });
    return counts;
  }, [questions]);
  const percentageTotal = QUESTION_DIFFICULTIES.reduce(
    (sum, difficulty) => sum + percentages[difficulty],
    0
  );

  function selectRandomQuestions() {
    setMessage("");
    if (!Number.isInteger(total) || total < 1 || total > 100) {
      setMessage("总题数需要填写 1 至 100。");
      return;
    }
    if (total > questions.length) {
      setMessage(`当前章节只有 ${questions.length} 道可用题目。`);
      return;
    }
    if (
      QUESTION_DIFFICULTIES.some(
        (difficulty) =>
          !Number.isFinite(percentages[difficulty]) ||
          percentages[difficulty] < 0 ||
          percentages[difficulty] > 100
      )
    ) {
      setMessage("每个难度的百分比都需要填写 0 至 100。");
      return;
    }
    if (percentageTotal !== 100) {
      setMessage(`四个难度合计必须为 100%，当前为 ${percentageTotal}%。`);
      return;
    }

    const required = allocateCounts(total, percentages);
    const shortage = QUESTION_DIFFICULTIES.find(
      (difficulty) => availability[difficulty] < required[difficulty]
    );
    if (shortage) {
      setMessage(
        `${QUESTION_DIFFICULTY_LABELS[shortage]}需要 ${required[shortage]} 道，但当前只有 ${availability[shortage]} 道。`
      );
      return;
    }

    const ids = QUESTION_DIFFICULTIES.flatMap((difficulty) =>
      shuffled(
        questions.filter((question) => question.difficulty === difficulty)
      )
        .slice(0, required[difficulty])
        .map((question) => question.id)
    );
    onSelected(shuffled(ids));
    setMessage(
      `已随机选入 ${ids.length} 道：${QUESTION_DIFFICULTIES.map(
        (difficulty) =>
          `${QUESTION_DIFFICULTY_LABELS[difficulty]}${required[difficulty]}道`
      ).join("、")}。`
    );
  }

  return (
    <section
      className={`rounded-2xl border ${
        compact ? "p-3" : "app-soft-card p-4"
      }`}
      style={{ borderColor: "var(--app-border)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} style={{ color: "var(--app-accent)" }} />
          <div>
            <h4 className="text-xs font-black">按难度比例一键选题</h4>
            <p className="app-muted-text mt-0.5 text-[10px]">
              随机结果会替换当前尚未保存的选题，可继续手动调整。
            </p>
          </div>
        </div>
        <label className="text-[10px] font-black">
          总题数
          <input
            type="number"
            min={1}
            max={Math.min(100, Math.max(1, questions.length))}
            value={total}
            onChange={(event) => setTotal(Number(event.target.value))}
            className="app-input ml-2 w-20 rounded-lg border px-2 py-2 text-xs"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUESTION_DIFFICULTIES.map((difficulty) => (
          <label
            key={difficulty}
            className="app-card rounded-xl border p-2.5 text-[10px] font-black"
          >
            <span className="flex items-center justify-between gap-2">
              {QUESTION_DIFFICULTY_LABELS[difficulty]}
              <span className="app-muted-text">
                库存 {availability[difficulty]}
              </span>
            </span>
            <span className="mt-2 flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={percentages[difficulty]}
                onChange={(event) =>
                  setPercentages((current) => ({
                    ...current,
                    [difficulty]: Number(event.target.value),
                  }))
                }
                className="app-input min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs"
                aria-label={`${QUESTION_DIFFICULTY_LABELS[difficulty]}百分比`}
              />
              %
            </span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-[10px] font-black"
          style={{
            color:
              percentageTotal === 100 ? "var(--app-success)" : "#c94f45",
          }}
        >
          当前比例合计：{percentageTotal}%
        </p>
        <button
          type="button"
          onClick={selectRandomQuestions}
          disabled={questions.length === 0}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          <Dices size={14} />
          一键随机选题
        </button>
      </div>
      {message && (
        <p
          className="mt-3 rounded-xl px-3 py-2 text-[10px] font-bold"
          style={{
            color: message.startsWith("已随机")
              ? "var(--app-success)"
              : "#c94f45",
            backgroundColor: message.startsWith("已随机")
              ? "var(--app-success-soft)"
              : "#fff0ed",
          }}
        >
          {message}
        </p>
      )}
    </section>
  );
}
