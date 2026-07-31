"use client";

import { ArrowRight, CheckCircle2, Puzzle, ScanSearch, ShieldAlert, Tags } from "lucide-react";
import { type CSSProperties, useState } from "react";

export type KnowledgeInteractionType =
  | "assemble"
  | "deconstruct"
  | "repair"
  | "classify";

type Tone = {
  color: string;
  soft: string;
};

const tones: Record<KnowledgeInteractionType, Tone> = {
  assemble: { color: "#376f8a", soft: "#eaf4f7" },
  deconstruct: { color: "#70558f", soft: "#f2edf8" },
  repair: { color: "#b06f3c", soft: "#fbf0e5" },
  classify: { color: "#8a6a2f", soft: "#f8f1df" },
};

const fireworkColors = [
  "#e45f65",
  "#e7a83e",
  "#4da78a",
  "#568ec4",
  "#8b69b3",
  "#ef7e52",
];

const activeSelectionColor = "#79d995";
const activeSelectionText = "#174b2d";
const completedSelectionColor = "#ffda6b";
const completedSelectionText = "#5c4310";

const interactionTypes = [
  { id: "assemble" as const, label: "拼装", icon: Puzzle },
  { id: "deconstruct" as const, label: "拆解", icon: ScanSearch },
  { id: "repair" as const, label: "纠错", icon: ShieldAlert },
  { id: "classify" as const, label: "分类", icon: Tags },
];

const assembleChallenges = [
  {
    target: "가",
    expected: ["ㄱ", "ㅏ", ""],
    bank: ["ㅏ", "ㄱ", "ㅗ", ""],
    hint: "竖向元音放在初声右侧。",
  },
  {
    target: "고",
    expected: ["ㄱ", "ㅗ", ""],
    bank: ["ㅗ", "ㄴ", "", "ㄱ"],
    hint: "横向元音放在初声下方。",
  },
  {
    target: "한",
    expected: ["ㅎ", "ㅏ", "ㄴ"],
    bank: ["ㄴ", "ㅏ", "ㅎ", "ㄱ"],
    hint: "终声 ㄴ 放在方块最下方。",
  },
  {
    target: "읽",
    expected: ["ㅇ", "ㅣ", "ㄺ"],
    bank: ["ㄺ", "ㅣ", "ㅇ", "ㄴ"],
    hint: "复合收音 ㄺ 整体占据终声位置。",
  },
];

const initialJamo = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
const medialJamo = [
  "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ",
  "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ",
];
const finalJamo = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
  "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

function composeHangul(slots: string[]) {
  const initialIndex = initialJamo.indexOf(slots[0]);
  const medialIndex = medialJamo.indexOf(slots[1]);
  const finalIndex = finalJamo.indexOf(slots[2]);

  if (initialIndex < 0 || medialIndex < 0 || finalIndex < 0) {
    return slots.filter(Boolean).join("") || "—";
  }

  return String.fromCharCode(
    0xac00 + (initialIndex * 21 + medialIndex) * 28 + finalIndex,
  );
}

const deconstructChallenges = [
  {
    target: "한",
    options: [
      ["ㅎ", "ㅏ", "ㄴ"],
      ["ㄱ", "ㅏ", "ㄴ"],
      ["ㅎ", "ㅗ", "ㄴ"],
    ],
    correct: 0,
    explanation: "한 = 初声 ㅎ + 中声 ㅏ + 终声 ㄴ。",
  },
  {
    target: "고",
    options: [
      ["ㄱ", "ㅜ", "—"],
      ["ㄱ", "ㅗ", "—"],
      ["ㄴ", "ㅗ", "—"],
    ],
    correct: 1,
    explanation: "고 = 初声 ㄱ + 中声 ㅗ，没有终声。",
  },
  {
    target: "공",
    options: [
      ["ㄱ", "ㅗ", "ㅇ"],
      ["ㄱ", "ㅓ", "ㅇ"],
      ["ㄱ", "ㅗ", "ㄴ"],
    ],
    correct: 0,
    explanation: "공 = 初声 ㄱ + 中声 ㅗ + 终声 ㅇ。",
  },
  {
    target: "읽",
    options: [
      ["ㅇ", "ㅡ", "ㄺ"],
      ["ㅎ", "ㅣ", "ㄱ"],
      ["ㅇ", "ㅣ", "ㄺ"],
    ],
    correct: 2,
    explanation: "읽 = 初声 ㅇ + 中声 ㅣ + 复合终声 ㄺ。",
  },
];

const repairChallenges = [
  {
    symbol: "고",
    prompt: "ㅗ 被放进了终声位，把它移回正确位置。",
    wrong: ["ㄱ", "", "ㅗ"],
    expected: ["ㄱ", "ㅗ", ""],
    explanation: "横向元音 ㅗ、ㅜ、ㅡ 放在初声下方。",
  },
  {
    symbol: "한",
    prompt: "中声和终声放反了，交换错误部件的位置。",
    wrong: ["ㅎ", "ㄴ", "ㅏ"],
    expected: ["ㅎ", "ㅏ", "ㄴ"],
    explanation: "在 한 中，ㅏ 是中声，ㄴ 是终声。",
  },
  {
    symbol: "아",
    prompt: "无声初声 ㅇ 和元音 ㅏ 的位置放反了，请修复。",
    wrong: ["ㅏ", "ㅇ", ""],
    expected: ["ㅇ", "ㅏ", ""],
    explanation: "元音开头的音节用无声的 ㅇ 填充初声位置。",
  },
  {
    symbol: "읽",
    prompt: "中声 ㅣ 和复合收音 ㄺ 放反了，请交换回来。",
    wrong: ["ㅇ", "ㄺ", "ㅣ"],
    expected: ["ㅇ", "ㅣ", "ㄺ"],
    explanation: "ㄺ 是复合收音，整体占据终声位置。",
  },
];

const classificationRounds = [
  {
    prompt: "按照元音方向，把 6 个音节放进对应分类盒。",
    buckets: [
      { id: "vertical", label: "竖向元音" },
      { id: "horizontal", label: "横向元音" },
    ],
    items: [
      { symbol: "가", bucket: "vertical" },
      { symbol: "너", bucket: "vertical" },
      { symbol: "미", bucket: "vertical" },
      { symbol: "고", bucket: "horizontal" },
      { symbol: "누", bucket: "horizontal" },
      { symbol: "브", bucket: "horizontal" },
    ],
    explanation: "ㅏ、ㅓ、ㅣ 属于竖向元音；ㅗ、ㅜ、ㅡ 属于横向元音。",
  },
  {
    prompt: "按照终声结构，把音节放进三个分类盒。",
    buckets: [
      { id: "none", label: "无收音" },
      { id: "single", label: "单收音" },
      { id: "double", label: "复合收音" },
    ],
    items: [
      { symbol: "아", bucket: "none" },
      { symbol: "고", bucket: "none" },
      { symbol: "한", bucket: "single" },
      { symbol: "공", bucket: "single" },
      { symbol: "읽", bucket: "double" },
      { symbol: "값", bucket: "double" },
    ],
    explanation: "没有终声、单辅音终声和复合终声是三种不同结构。",
  },
  {
    prompt: "按照音节方块外形，把音节放进对应区域。",
    buckets: [
      { id: "side", label: "左右结构" },
      { id: "stacked", label: "上下结构" },
      { id: "batchim", label: "底部带收音" },
    ],
    items: [
      { symbol: "가", bucket: "side" },
      { symbol: "네", bucket: "side" },
      { symbol: "고", bucket: "stacked" },
      { symbol: "무", bucket: "stacked" },
      { symbol: "한", bucket: "batchim" },
      { symbol: "공", bucket: "batchim" },
    ],
    explanation: "竖向元音形成左右结构，横向元音形成上下结构，收音位于方块底部。",
  },
];

export function KnowledgeInteractionLab({
  onMasteryChange,
}: {
  onMasteryChange: (type: KnowledgeInteractionType) => void;
}) {
  const [type, setType] = useState<KnowledgeInteractionType>("assemble");
  const [indices, setIndices] = useState<Record<KnowledgeInteractionType, number>>({
    assemble: 0,
    deconstruct: 0,
    repair: 0,
    classify: 0,
  });
  const [correctCounts, setCorrectCounts] = useState<
    Record<KnowledgeInteractionType, number>
  >({
    assemble: 0,
    deconstruct: 0,
    repair: 0,
    classify: 0,
  });
  const [awarded, setAwarded] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [activeSlot, setActiveSlot] = useState(0);
  const [slots, setSlots] = useState(["", "", ""]);
  const [touchedSlots, setTouchedSlots] = useState([false, false, false]);
  const [deconstructSlots, setDeconstructSlots] = useState<
    Array<string | null>
  >([null, null, null]);
  const [deconstructActiveSlot, setDeconstructActiveSlot] = useState(0);
  const [repairSlots, setRepairSlots] = useState<string[]>([
    ...repairChallenges[0].wrong,
  ]);
  const [repairSourceSlot, setRepairSourceSlot] = useState<number | null>(null);
  const [repairTouchedSlots, setRepairTouchedSlots] = useState([
    false,
    false,
    false,
  ]);
  const [classifyPlacements, setClassifyPlacements] = useState<
    Record<string, string>
  >({});
  const [selectedClassifyItem, setSelectedClassifyItem] = useState<
    string | null
  >(null);

  const tone = tones[type];
  const index = indices[type];
  const assemble = assembleChallenges[index % assembleChallenges.length];
  const deconstruct =
    deconstructChallenges[index % deconstructChallenges.length];
  const repair = repairChallenges[index % repairChallenges.length];
  const classify = classificationRounds[index % classificationRounds.length];
  const deconstructBank = Array.from(
    new Set(deconstruct.options.flat()),
  );

  function resetAnswer(
    nextType = type,
    nextIndex = indices[nextType],
  ) {
    setAwarded(false);
    setResult(null);
    setActiveSlot(0);
    setSlots(["", "", ""]);
    setTouchedSlots([false, false, false]);
    setDeconstructSlots([null, null, null]);
    setDeconstructActiveSlot(0);
    setRepairSlots([
      ...repairChallenges[nextIndex % repairChallenges.length].wrong,
    ]);
    setRepairSourceSlot(null);
    setRepairTouchedSlots([false, false, false]);
    setClassifyPlacements({});
    setSelectedClassifyItem(null);
  }

  function chooseType(nextType: KnowledgeInteractionType) {
    setType(nextType);
    resetAnswer(nextType, indices[nextType]);
  }

  function recordResult(correct: boolean) {
    setResult(correct ? "correct" : "wrong");
    if (!correct || awarded) return;

    setAwarded(true);
    const currentCount = correctCounts[type];
    if (currentCount >= 3) return;

    const nextCount = currentCount + 1;
    setCorrectCounts((current) => ({ ...current, [type]: nextCount }));
    if (nextCount === 3) onMasteryChange(type);
  }

  function placeDeconstructPart(slotIndex: number, part: string) {
    const nextSlots = deconstructSlots.map((value) =>
      value === part ? null : value,
    );
    nextSlots[slotIndex] = part;
    setDeconstructSlots(nextSlots);
    const nextEmptySlot = nextSlots.findIndex((value) => value === null);
    setDeconstructActiveSlot(nextEmptySlot);

    if (nextEmptySlot >= 0) {
      setResult(null);
      return;
    }

    const expected = deconstruct.options[deconstruct.correct];
    recordResult(
      nextSlots.every((value, partIndex) => value === expected[partIndex]),
    );
  }

  function swapRepairParts(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      setRepairSourceSlot(null);
      return;
    }
    const nextSlots = [...repairSlots];
    [nextSlots[sourceIndex], nextSlots[targetIndex]] = [
      nextSlots[targetIndex],
      nextSlots[sourceIndex],
    ];
    setRepairSlots(nextSlots);
    setRepairTouchedSlots((current) =>
      current.map((touched, slotIndex) =>
        slotIndex === sourceIndex || slotIndex === targetIndex
          ? true
          : touched,
      ),
    );
    setRepairSourceSlot(null);
    setResult(null);
  }

  function chooseRepairSlot(slotIndex: number) {
    if (repairSourceSlot === null) {
      setRepairSourceSlot(slotIndex);
      return;
    }
    swapRepairParts(repairSourceSlot, slotIndex);
  }

  function placeClassifyItem(symbol: string, bucketId: string) {
    const nextPlacements = {
      ...classifyPlacements,
      [symbol]: bucketId,
    };
    setClassifyPlacements(nextPlacements);
    setSelectedClassifyItem(null);

    if (Object.keys(nextPlacements).length < classify.items.length) {
      setResult(null);
      return;
    }

    recordResult(
      classify.items.every(
        (item) => nextPlacements[item.symbol] === item.bucket,
      ),
    );
  }

  function nextQuestion() {
    const lengths: Record<KnowledgeInteractionType, number> = {
      assemble: assembleChallenges.length,
      deconstruct: deconstructChallenges.length,
      repair: repairChallenges.length,
      classify: classificationRounds.length,
    };
    const nextIndex = (indices[type] + 1) % lengths[type];
    setIndices((current) => ({
      ...current,
      [type]: nextIndex,
    }));
    resetAnswer(type, nextIndex);
  }

  const feedback =
    type === "assemble"
      ? assemble.hint
      : type === "deconstruct"
        ? deconstruct.explanation
        : type === "repair"
          ? repair.explanation
          : classify.explanation;
  const assembledPreview = composeHangul(slots);
  const idleInstruction =
    type === "assemble"
      ? "选择三个位置并点击检查拼装，判断结果会显示在这里。"
      : type === "deconstruct"
        ? "拖动部件到初声、中声、终声槽位，放满后会自动判断。"
        : type === "repair"
          ? "拖动部件交换位置，或依次点击两个位置，然后检查修复。"
          : "把全部音节放进分类盒，系统会自动判断整组结果。";
  const wrongInstruction =
    type === "deconstruct"
      ? "结构还不对，点选一个槽位后可以重新放入部件。"
      : type === "repair"
        ? "修复还没完成，只提示位置有误，请继续观察并交换。"
        : type === "classify"
          ? "这一组还有音节放错了，点击盒内卡片即可拿出重分。"
          : "还不对，再观察结构和位置后重试。";

  return (
    <div
      className="border-t p-4 sm:p-6"
      style={{ borderColor: "var(--app-border-soft)", backgroundColor: "#faf8f3" }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black">互动练习台</p>
          <p className="app-muted-text mt-1 text-[10px]">
            每类答对 3 题，即可完成这一项训练。
          </p>
        </div>
        <span className="text-[10px] font-black" style={{ color: tone.color }}>
          本项进度 {correctCounts[type]} / 3
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {interactionTypes.map((item) => {
          const Icon = item.icon;
          const selected = type === item.id;
          const itemTone = tones[item.id];
          const mastered = correctCounts[item.id] >= 3;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseType(item.id)}
              className="flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-xs font-black"
              style={{
                color: selected ? "white" : itemTone.color,
                borderColor: selected
                  ? itemTone.color
                  : itemTone.soft,
                backgroundColor: selected
                  ? itemTone.color
                  : itemTone.soft,
              }}
            >
              <Icon size={15} />
              {item.label}
              {mastered && (
                <CheckCircle2
                  className="ml-auto"
                  size={14}
                  style={{ color: "var(--app-success)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        className="relative mt-4 overflow-hidden rounded-3xl border p-4 sm:p-5"
        style={{ borderColor: tone.color, backgroundColor: tone.soft }}
      >
        {result === "correct" && (
          <div
            key={`${type}-${index}-${correctCounts[type]}`}
            className="pointer-events-none absolute inset-0 z-20"
            aria-hidden="true"
          >
            {[0, 1].map((burstIndex) => (
              <span
                key={`core-${burstIndex}`}
                className="knowledge-firework-core"
                style={
                  {
                    left: burstIndex === 0 ? "32%" : "70%",
                    top: burstIndex === 0 ? "42%" : "36%",
                    color: burstIndex === 0 ? "#e7a83e" : "#8b69b3",
                    "--delay": `${burstIndex * 80}ms`,
                  } as CSSProperties
                }
              />
            ))}
            {Array.from({ length: 24 }, (_, particleIndex) => {
              const rayIndex = particleIndex % 12;
              const burstIndex = Math.floor(particleIndex / 12);
              return (
                <span
                  key={particleIndex}
                  className="knowledge-firework-particle"
                  style={
                    {
                      left: burstIndex === 0 ? "32%" : "70%",
                      top: burstIndex === 0 ? "42%" : "36%",
                      color:
                        fireworkColors[
                          particleIndex % fireworkColors.length
                        ],
                      backgroundColor:
                        fireworkColors[
                          particleIndex % fireworkColors.length
                        ],
                      "--angle": `${rayIndex * 30}deg`,
                      "--distance": `-${48 + (rayIndex % 3) * 10}px`,
                      "--delay": `${burstIndex * 80}ms`,
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
        )}
        {type === "assemble" && (
          <div className="grid items-center gap-5 lg:grid-cols-[150px_minmax(0,1fr)_150px]">
            <div className="text-center">
              <p className="text-[10px] font-black" style={{ color: tone.color }}>
                拼出目标音节
              </p>
              <p className="mt-2 text-7xl font-black">{assemble.target}</p>
            </div>
            <div>
              <div className="grid grid-cols-3 gap-2">
                {["初声", "中声", "终声"].map((label, slotIndex) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveSlot(slotIndex)}
                    className="min-h-20 rounded-2xl border p-2 text-center transition"
                    style={{
                      color:
                        activeSlot === slotIndex
                          ? activeSelectionText
                          : touchedSlots[slotIndex]
                            ? completedSelectionText
                            : "var(--app-text)",
                      borderColor:
                        activeSlot === slotIndex
                          ? activeSelectionColor
                          : touchedSlots[slotIndex]
                            ? "#d6a83f"
                            : `${tone.color}66`,
                      backgroundColor:
                        activeSlot === slotIndex
                          ? activeSelectionColor
                          : touchedSlots[slotIndex]
                            ? completedSelectionColor
                            : "white",
                    }}
                  >
                    <span
                      className="block text-[9px] font-black"
                      style={{
                        color:
                          activeSlot === slotIndex
                            ? activeSelectionText
                            : touchedSlots[slotIndex]
                              ? completedSelectionText
                              : tone.color,
                      }}
                    >
                      {label}
                    </span>
                    <span className="mt-2 block text-2xl font-black">
                      {touchedSlots[slotIndex]
                        ? slots[slotIndex] || "无"
                        : "＋"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {assemble.bank.map((letter) => {
                  const selectedLetter = touchedSlots.some(
                    (touched, slotIndex) =>
                      touched && slots[slotIndex] === letter,
                  );
                  return (
                    <button
                      key={letter || "none"}
                      type="button"
                      onClick={() => {
                        if (activeSlot < 0) return;
                        const nextSlots = [...slots];
                        nextSlots[activeSlot] = letter;
                        setSlots(nextSlots);
                        const nextTouchedSlots = touchedSlots.map(
                          (touched, slotIndex) =>
                            slotIndex === activeSlot ? true : touched,
                        );
                        setTouchedSlots(nextTouchedSlots);
                        const nextUntouchedSlot = nextTouchedSlots.findIndex(
                          (touched) => !touched,
                        );
                        setActiveSlot(nextUntouchedSlot);
                        setResult(null);
                      }}
                      className="min-w-11 rounded-xl border px-3 py-2 text-sm font-black transition hover:-translate-y-0.5"
                      style={{
                        color: selectedLetter
                          ? completedSelectionText
                          : "var(--app-text)",
                        borderColor: selectedLetter
                          ? "#d6a83f"
                          : `${tone.color}66`,
                        backgroundColor: selectedLetter
                          ? completedSelectionColor
                          : "white",
                        opacity: activeSlot < 0 ? 0.7 : 1,
                      }}
                    >
                      {letter || "无收音"}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    recordResult(
                      touchedSlots.every(Boolean) &&
                        slots.join("|") === assemble.expected.join("|"),
                    )
                  }
                  className="ml-auto rounded-xl px-4 py-2 text-xs font-black text-white"
                  style={{ backgroundColor: tone.color }}
                >
                  检查拼装
                </button>
              </div>
            </div>
            <div
              className="rounded-3xl border bg-white px-3 py-4 text-center"
              style={{ borderColor: tone.color }}
            >
              <p className="text-[10px] font-black" style={{ color: tone.color }}>
                我的拼装
              </p>
              <p className="mt-2 text-6xl font-black">{assembledPreview}</p>
              <div className="mt-3 grid gap-1 text-[9px] font-bold">
                {["初声", "中声", "终声"].map((label, slotIndex) => (
                  <p key={label} className="flex items-center justify-between gap-2">
                    <span className="app-muted-text">{label}</span>
                    <span>
                      {touchedSlots[slotIndex]
                        ? slots[slotIndex] || "无收音"
                        : "待选择"}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {type === "deconstruct" && (
          <div className="grid items-center gap-5 lg:grid-cols-[160px_minmax(0,1fr)]">
            <div className="text-center">
              <p className="text-[10px] font-black" style={{ color: tone.color }}>
                拆开目标音节
              </p>
              <p className="mt-2 text-7xl font-black">{deconstruct.target}</p>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black">把部件放进正确的结构槽位</p>
                <p className="app-muted-text text-[9px] font-bold">
                  支持拖动，也可以先点槽位再点部件
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["初声", "中声", "终声"].map((label, slotIndex) => {
                  const value = deconstructSlots[slotIndex];
                  const active = deconstructActiveSlot === slotIndex;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDeconstructActiveSlot(slotIndex)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const part = event.dataTransfer.getData("text/plain");
                        if (part) placeDeconstructPart(slotIndex, part);
                      }}
                      className="min-h-20 rounded-2xl border p-2 text-center transition"
                      style={{
                        color: active
                          ? activeSelectionText
                          : value
                            ? completedSelectionText
                            : "var(--app-text)",
                        borderColor: active
                          ? "#55b978"
                          : value
                            ? "#d6a83f"
                            : `${tone.color}66`,
                        backgroundColor: active
                          ? activeSelectionColor
                          : value
                            ? completedSelectionColor
                            : "white",
                      }}
                    >
                      <span className="block text-[9px] font-black">{label}</span>
                      <span className="mt-2 block text-2xl font-black">
                        {value === "—" ? "无终声" : value || "放这里"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3">
                <span className="app-muted-text mr-1 text-[9px] font-black">
                  部件库
                </span>
                {deconstructBank.map((part) => {
                  const used = deconstructSlots.includes(part);
                  return (
                    <button
                      key={part}
                      type="button"
                      draggable
                      onDragStart={(event) =>
                        event.dataTransfer.setData("text/plain", part)
                      }
                      onClick={() => {
                        if (deconstructActiveSlot >= 0) {
                          placeDeconstructPart(deconstructActiveSlot, part);
                        }
                      }}
                      className="min-w-12 cursor-grab rounded-xl border px-3 py-2 text-sm font-black transition active:cursor-grabbing"
                      style={{
                        color: used
                          ? completedSelectionText
                          : "var(--app-text)",
                        borderColor: used ? "#d6a83f" : `${tone.color}66`,
                        backgroundColor: used
                          ? completedSelectionColor
                          : "white",
                      }}
                    >
                      {part === "—" ? "无终声" : part}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {type === "repair" && (
          <div className="grid items-center gap-5 lg:grid-cols-[140px_minmax(0,1fr)_170px]">
            <div className="text-center">
              <p className="text-[10px] font-black" style={{ color: tone.color }}>
                目标音节
              </p>
              <p className="mt-2 text-7xl font-black">{repair.symbol}</p>
            </div>
            <div>
              <p className="text-sm font-black leading-6">{repair.prompt}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {["初声", "中声", "终声"].map((label, slotIndex) => {
                  const active = repairSourceSlot === slotIndex;
                  return (
                  <button
                    key={label}
                    type="button"
                    draggable={Boolean(repairSlots[slotIndex])}
                    onClick={() => chooseRepairSlot(slotIndex)}
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "text/plain",
                        String(slotIndex),
                      )
                    }
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceIndex = Number(
                        event.dataTransfer.getData("text/plain"),
                      );
                      if (Number.isInteger(sourceIndex)) {
                        swapRepairParts(sourceIndex, slotIndex);
                      }
                    }}
                    className="min-h-20 cursor-grab rounded-2xl border p-2 text-center transition active:cursor-grabbing"
                    style={{
                      color: active
                        ? activeSelectionText
                        : repairTouchedSlots[slotIndex]
                          ? completedSelectionText
                          : "var(--app-text)",
                      borderColor: active
                        ? "#55b978"
                        : repairTouchedSlots[slotIndex]
                          ? "#d6a83f"
                          : `${tone.color}66`,
                      backgroundColor: active
                        ? activeSelectionColor
                        : repairTouchedSlots[slotIndex]
                          ? completedSelectionColor
                          : "white",
                    }}
                  >
                    <span className="block text-[9px] font-black">{label}</span>
                    <span className="mt-2 block text-2xl font-black">
                      {repairSlots[slotIndex] || "空位"}
                    </span>
                  </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="app-muted-text text-[9px] font-bold">
                  拖动部件交换位置；触屏时依次点击两个位置。
                </p>
                <button
                  type="button"
                  onClick={() =>
                    recordResult(
                      repairSlots.join("|") === repair.expected.join("|"),
                    )
                  }
                  className="rounded-xl px-4 py-2 text-xs font-black text-white"
                  style={{ backgroundColor: tone.color }}
                >
                  检查修复
                </button>
              </div>
            </div>
            <div className="grid gap-2 rounded-3xl border bg-white p-3 text-center" style={{ borderColor: `${tone.color}66` }}>
              <div className="rounded-2xl px-2 py-3" style={{ backgroundColor: "#fff0e5" }}>
                <p className="text-[9px] font-black" style={{ color: tone.color }}>
                  修改前
                </p>
                <p className="mt-1 text-2xl font-black">
                  {repair.wrong.map((part) => part || "□").join(" · ")}
                </p>
              </div>
              <div className="rounded-2xl px-2 py-3" style={{ backgroundColor: tone.soft }}>
                <p className="text-[9px] font-black" style={{ color: tone.color }}>
                  当前结构
                </p>
                <p className="mt-1 text-4xl font-black">
                  {composeHangul(repairSlots)}
                </p>
              </div>
            </div>
          </div>
        )}

        {type === "classify" && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black">{classify.prompt}</p>
              <p className="app-muted-text text-[9px] font-bold">
                拖进分类盒，或先点音节再点分类盒
              </p>
            </div>
            <div className="mt-3 flex min-h-16 flex-wrap items-center gap-2 rounded-2xl bg-white p-3">
              <span className="app-muted-text mr-1 text-[9px] font-black">
                待分类
              </span>
              {classify.items
                .filter((item) => !classifyPlacements[item.symbol])
                .map((item) => {
                  const selected = selectedClassifyItem === item.symbol;
                  return (
                  <button
                    key={item.symbol}
                    type="button"
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/plain", item.symbol)
                    }
                    onClick={() =>
                      setSelectedClassifyItem(
                        selected ? null : item.symbol,
                      )
                    }
                    className="min-w-14 cursor-grab rounded-xl border px-3 py-2 text-lg font-black transition active:cursor-grabbing"
                    style={{
                      color: selected
                        ? activeSelectionText
                        : "var(--app-text)",
                      borderColor: selected
                        ? "#55b978"
                        : `${tone.color}66`,
                      backgroundColor: selected
                        ? activeSelectionColor
                        : "white",
                    }}
                  >
                    {item.symbol}
                  </button>
                  );
                })}
              {Object.keys(classifyPlacements).length === classify.items.length && (
                <span className="app-muted-text text-[9px] font-bold">
                  已全部放置，点击盒内卡片可重新调整。
                </span>
              )}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {classify.buckets.map((bucket) => {
                const placedItems = classify.items.filter(
                  (item) => classifyPlacements[item.symbol] === bucket.id,
                );
                return (
                  <div
                    key={bucket.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (selectedClassifyItem) {
                        placeClassifyItem(selectedClassifyItem, bucket.id);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        selectedClassifyItem &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        placeClassifyItem(selectedClassifyItem, bucket.id);
                      }
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const symbol = event.dataTransfer.getData("text/plain");
                      if (symbol) placeClassifyItem(symbol, bucket.id);
                    }}
                    className="min-h-28 rounded-2xl border bg-white p-3 text-left transition"
                    style={{
                      borderColor: selectedClassifyItem
                        ? activeSelectionColor
                        : `${tone.color}66`,
                    }}
                  >
                    <span className="block text-[10px] font-black" style={{ color: tone.color }}>
                      {bucket.label}
                    </span>
                    <span className="mt-3 flex flex-wrap gap-2">
                      {placedItems.length === 0 && (
                        <span className="app-muted-text text-[9px] font-bold">
                          放到这里
                        </span>
                      )}
                      {placedItems.map((item) => (
                        <button
                          key={item.symbol}
                          type="button"
                          draggable
                          onDragStart={(event) => {
                            event.stopPropagation();
                            event.dataTransfer.setData(
                              "text/plain",
                              item.symbol,
                            );
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            const nextPlacements = { ...classifyPlacements };
                            delete nextPlacements[item.symbol];
                            setClassifyPlacements(nextPlacements);
                            setSelectedClassifyItem(item.symbol);
                            setResult(null);
                          }}
                          className="rounded-xl border px-3 py-2 text-lg font-black"
                          style={{
                            color: completedSelectionText,
                            borderColor: "#d6a83f",
                            backgroundColor: completedSelectionColor,
                          }}
                        >
                          {item.symbol}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div
          className="mt-4 flex min-h-11 flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[10px] font-bold leading-5"
          style={{
            color:
              result === "correct"
                ? "var(--app-success)"
                : result === "wrong"
                  ? "#c94f45"
                  : "var(--app-muted)",
          }}
        >
          <span className="flex-1">
            {result === "correct"
              ? `回答正确。${feedback}`
              : result === "wrong"
                ? wrongInstruction
                : idleInstruction}
          </span>
          {result === "correct" && (
            <button
              type="button"
              onClick={nextQuestion}
              className="inline-flex items-center gap-1 font-black"
            >
              下一题
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
