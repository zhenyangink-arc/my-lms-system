"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  ExternalLink,
  Filter,
  GraduationCap,
  Landmark,
  MapPin,
  RotateCcw,
  Scale,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SchoolCrest } from "@/components/school/SchoolCrest";
import {
  addLibraryUniversityTargetAction,
  saveUniversityAssessmentAction,
  toggleUniversityComparisonAction,
  type UniversityAssessmentState,
} from "./actions";

export type KoreanUniversity = {
  id: string;
  slug: string;
  name_zh: string;
  name_ko: string;
  name_en: string;
  logo_url: string | null;
  detailed_introduction: string | null;
  ownership: "national" | "public" | "private";
  province: string;
  city: string;
  admission_stages: string[];
  discipline_groups: string[];
  tuition_min_krw: number;
  tuition_max_krw: number;
  tuition_min_cny: number;
  tuition_max_cny: number;
  tuition_reference_year: number;
  qs_rank_display: string | null;
  qs_rank_sort: number | null;
  qs_ranking_year: number | null;
  joongang_rank_display: string | null;
  joongang_rank_sort: number | null;
  joongang_ranking_year: number | null;
  summary: string;
  highlights: string[];
  ranking_source_url: string | null;
  is_featured: boolean;
};

type UniversityLibraryProps = {
  universities: KoreanUniversity[];
  comparedIds: string[];
  targetIds: string[];
};

const stageOptions = [
  ["language", "语学堂"],
  ["bachelor_fresh", "本科新入"],
  ["bachelor_transfer", "本科插班"],
  ["master", "硕士"],
  ["doctor", "博士"],
] as const;

const regionOptions = [
  "首尔特别市",
  "釜山广域市",
  "大邱广域市",
  "仁川广域市",
  "光州广域市",
  "大田广域市",
  "蔚山广域市",
  "世宗特别自治市",
  "京畿道",
  "江原特别自治道",
  "忠清北道",
  "忠清南道",
  "全北特别自治道",
  "全罗南道",
  "庆尚北道",
  "庆尚南道",
  "济州特别自治道",
] as const;

const ownershipOptions = [
  ["national", "国立"],
  ["private", "私立"],
  ["public", "公立"],
] as const;

const disciplineOptions = [
  ["humanities_social", "人文社会"],
  ["science", "理科"],
  ["natural_sciences", "自然"],
  ["medicine", "医学"],
] as const;

const tuitionOptions = [
  ["20000-40000", "2万—4万", 20_000, 40_000],
  ["40000-60000", "4万—6万", 40_000, 60_000],
  ["60000-80000", "6万—8万", 60_000, 80_000],
  ["80000-100000", "8万—10万", 80_000, 100_000],
] as const;

const qsOptions = [
  ["top50", "前 50", 50],
  ["top100", "前 100", 100],
  ["top300", "前 300", 300],
  ["top500", "前 500", 500],
  ["ranked", "已有排名", Number.POSITIVE_INFINITY],
] as const;

const joongangOptions = [
  ["top5", "前 5", 5],
  ["top10", "前 10", 10],
  ["top20", "前 20", 20],
  ["top30", "前 30", 30],
  ["ranked", "已有排名", Number.POSITIVE_INFINITY],
] as const;

const stageLabelMap = Object.fromEntries(stageOptions) as Record<string, string>;
const disciplineLabelMap = Object.fromEntries(disciplineOptions) as Record<string, string>;
const ownershipLabelMap = Object.fromEntries(ownershipOptions) as Record<string, string>;

const initialAssessmentState: UniversityAssessmentState = {
  status: "idle",
  message: "",
};

function formatWan(value: number) {
  const amount = value / 10_000;
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(1);
}

function formatKrw(value: number) {
  return `${(value / 1_000_000).toFixed(1)}百万`;
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="border-b pb-5 last:border-b-0 last:pb-0" style={{ borderColor: "var(--app-border-soft)" }}>
      {/* 每组筛选都有独立收缩按钮，长列表中也能快速定位。 */}
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)} className={`flex w-full items-center justify-between gap-3 text-left text-xs font-black ${expanded ? "mb-3" : ""}`}>
        <span>{title}</span>
        <ChevronDown className={`shrink-0 transition ${expanded ? "rotate-180" : ""}`} size={14} aria-hidden="true" />
      </button>
      {expanded && <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">{children}</div>}
    </section>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition hover:-translate-y-0.5"
      style={
        active
          ? {
              color: "var(--app-accent-strong)",
              borderColor: "var(--app-accent)",
              backgroundColor: "var(--app-accent-soft)",
            }
          : {
              color: "var(--app-muted)",
              borderColor: "var(--app-border-soft)",
              backgroundColor: "var(--app-card-bg)",
            }
      }
    >
      <span>{label}</span>
      {active && <Check size={12} aria-hidden="true" />}
    </button>
  );
}

function RankPanel({
  label,
  rank,
  year,
}: {
  label: string;
  rank: string | null;
  year: number | null;
}) {
  return (
    <div className="rounded-2xl border px-3 py-2.5" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-soft-bg)" }}>
      <p className="text-[10px] font-black app-muted-text">{year ? `${year} ${label}` : label}</p>
      <p className="mt-1 text-sm font-black">{rank ? `第 ${rank}` : "暂无"}</p>
    </div>
  );
}

function UniversityAssessmentDialog({ university }: { university: KoreanUniversity }) {
  const assessmentAction = saveUniversityAssessmentAction.bind(null, university.id);
  const [state, formAction, pending] = useActionState(
    assessmentAction,
    initialAssessmentState
  );

  const resultColor =
    state.resultLabel === "匹配度较高"
      ? "var(--app-success)"
      : state.resultLabel === "可以冲刺"
        ? "var(--app-warm)"
        : "var(--app-accent)";

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-black text-white transition hover:opacity-90"
        style={{ backgroundColor: "var(--app-secondary)" }}
      >
        <Sparkles size={13} aria-hidden="true" /> 在线评估
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">{university.name_zh} · 在线评估</DialogTitle>
          <DialogDescription>
            根据成绩、韩语、预算和学科方向生成初步匹配建议，结果会保存到你的评估记录。
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-black">
              申请阶段
              <select name="admissionStage" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" defaultValue={university.admission_stages[0]}>
                {university.admission_stages.map((stage) => (
                  <option key={stage} value={stage}>{stageLabelMap[stage] ?? stage}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black">
              学科方向
              <select name="disciplineGroup" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" defaultValue={university.discipline_groups[0]}>
                {disciplineOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black">
              平均成绩（百分制）
              <input name="academicScore" type="number" min="0" max="100" step="0.1" required defaultValue="85" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" />
            </label>
            <label className="text-xs font-black">
              韩语能力
              <select name="topikLevel" defaultValue="3" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none">
                <option value="0">暂未取得等级</option>
                {[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>韩国语能力考试 {level} 级</option>)}
              </select>
            </label>
          </div>
          <label className="block text-xs font-black">
            每年学费预算（人民币）
            <div className="relative mt-2">
              <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 app-muted-text" size={16} aria-hidden="true" />
              <input name="annualBudgetCny" type="number" min="20000" max="100000" step="1000" required defaultValue="60000" className="app-input w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none" />
            </div>
          </label>

          {state.message && (
            <div
              aria-live="polite"
              className="rounded-2xl border p-4"
              style={{
                color: state.status === "success" ? resultColor : "#dc2626",
                borderColor: state.status === "success" ? resultColor : "#fecaca",
                backgroundColor: state.status === "success" ? "var(--app-soft-bg)" : "#fef2f2",
              }}
            >
              {state.status === "success" && state.breakdown ? (
                <>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-black">初步结果</p>
                      <p className="mt-1 text-lg font-black">{state.resultLabel}</p>
                    </div>
                    <p className="text-2xl font-black">{state.score}<span className="text-xs"> 分</span></p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
                    {[
                      ["学业基础", state.breakdown.academic],
                      ["韩语能力", state.breakdown.language],
                      ["预算适配", state.breakdown.budget],
                      ["学科适配", state.breakdown.discipline],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white/70 px-3 py-2">
                        <span>{label}</span><b className="float-right">{value}</b>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="mt-3 text-xs font-bold leading-5">{state.message}</p>
            </div>
          )}

          <button disabled={pending} type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white disabled:opacity-60" style={{ backgroundColor: "var(--app-accent)" }}>
            <ClipboardCheck size={16} aria-hidden="true" />
            {pending ? "正在评估…" : "生成并保存评估"}
          </button>
          <p className="text-xs leading-5 app-muted-text">
            评估仅用于初步选校参考，不构成录取承诺。最终条件请以大学当年招生简章与人工顾问复核为准。
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UniversityDetailsDialog({ university }: { university: KoreanUniversity }) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black transition hover:-translate-y-0.5"
        style={{ color: "var(--app-accent-strong)", borderColor: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}
      >
        学校介绍 <ArrowUpRight size={13} aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <SchoolCrest logoUrl={university.logo_url} name={university.name_zh} />
            <div>
              <DialogTitle className="text-xl font-black">{university.name_zh}</DialogTitle>
              <DialogDescription className="mt-1">{university.name_ko} · {university.city}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <section className="rounded-2xl border p-4" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-soft-bg)" }}>
          <h3 className="text-sm font-black">学校介绍</h3>
          <p className="mt-2 whitespace-pre-line leading-7 app-muted-text">{university.detailed_introduction || university.summary}</p>
        </section>
        <div className="grid gap-3 sm:grid-cols-3">
          <RankPanel label="世界大学排名" rank={university.qs_rank_display} year={university.qs_ranking_year} />
          <RankPanel label="韩国中央日报" rank={university.joongang_rank_display} year={university.joongang_ranking_year} />
          <div className="rounded-2xl border px-3 py-2.5" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-soft-bg)" }}>
            <p className="text-[10px] font-black app-muted-text">{university.tuition_reference_year} 年度学费参考</p>
            <p className="mt-1 text-sm font-black">{formatWan(university.tuition_min_cny)}万—{formatWan(university.tuition_max_cny)}万元</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="app-soft-card rounded-2xl border p-4">
            <h3 className="flex items-center gap-2 text-sm font-black"><BookOpen size={16} /> 申请阶段</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {university.admission_stages.map((stage) => <span key={stage} className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">{stageLabelMap[stage] ?? stage}</span>)}
            </div>
          </section>
          <section className="app-soft-card rounded-2xl border p-4">
            <h3 className="flex items-center gap-2 text-sm font-black"><GraduationCap size={16} /> 优势学科</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {university.discipline_groups.map((group) => <span key={group} className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">{disciplineLabelMap[group] ?? group}</span>)}
            </div>
          </section>
        </div>

        <section>
          <h3 className="text-sm font-black">院校亮点</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {university.highlights.map((highlight) => (
              <div key={highlight} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: "var(--app-border-soft)" }}>
                <Check size={13} style={{ color: "var(--app-success)" }} /> {highlight}
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-2xl p-4 text-xs leading-5" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}>
          学费按专业、学期和奖学金情况变化，人民币金额也受汇率影响；排名为标注年份的数据。申请前请由顾问在管理中心复核当年招生简章与缴费通知。
        </div>
        <div className="flex flex-wrap gap-2">
          {university.ranking_source_url && (
            <a href={university.ranking_source_url} target="_blank" rel="noreferrer" className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black">
              查看排名来源 <ExternalLink size={13} />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UniversityCard({
  university,
  isCompared,
  isTarget,
}: {
  university: KoreanUniversity;
  isCompared: boolean;
  isTarget: boolean;
}) {
  return (
    <article className="app-card group flex min-h-[530px] flex-col overflow-hidden rounded-3xl border transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-2" style={{ background: "linear-gradient(90deg, var(--app-accent), var(--app-secondary), var(--app-success))" }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <SchoolCrest logoUrl={university.logo_url} name={university.name_zh} />
          <div className="flex flex-wrap justify-end gap-1.5">
            {university.is_featured && <span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>重点院校</span>}
            <span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{ownershipLabelMap[university.ownership]}</span>
          </div>
        </div>

        <h3 className="mt-4 text-base font-black tracking-tight">{university.name_zh}</h3>
        <p className="mt-1 truncate text-xs font-bold app-muted-text">{university.name_ko}</p>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-bold app-muted-text"><MapPin size={13} style={{ color: "var(--app-accent)" }} /> {university.province} · {university.city}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <RankPanel label="世界大学排名" rank={university.qs_rank_display} year={university.qs_ranking_year} />
          <RankPanel label="中央日报" rank={university.joongang_rank_display} year={university.joongang_ranking_year} />
        </div>

        <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-warm-soft)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black app-muted-text">{university.tuition_reference_year} 每年学费参考</p>
            <CircleDollarSign size={13} style={{ color: "var(--app-warm)" }} />
          </div>
          <p className="mt-1 text-sm font-black">{formatWan(university.tuition_min_cny)}万—{formatWan(university.tuition_max_cny)}万元</p>
          <p className="mt-1 text-[10px] app-muted-text">约 {formatKrw(university.tuition_min_krw)}—{formatKrw(university.tuition_max_krw)}韩元</p>
        </div>

        <div className="mt-3 flex min-h-12 flex-wrap content-start gap-1.5">
          {university.discipline_groups.slice(0, 3).map((group) => (
            <span key={group} className="rounded-full border px-2 py-1 text-[10px] font-bold app-muted-text" style={{ borderColor: "var(--app-border-soft)" }}>{disciplineLabelMap[group] ?? group}</span>
          ))}
          {university.discipline_groups.length > 3 && <span className="rounded-full border px-2 py-1 text-[10px] font-bold app-muted-text" style={{ borderColor: "var(--app-border-soft)" }}>+{university.discipline_groups.length - 3}</span>}
        </div>

        <div className="mt-auto space-y-2 pt-4">
          <form action={addLibraryUniversityTargetAction.bind(null, university.id)} data-permission="university_target" className="flex gap-2">
            <select name="admissionTrack" disabled={isTarget} defaultValue={university.admission_stages[0]} aria-label={`${university.name_zh}的申请阶段`} className="app-input min-w-0 flex-1 rounded-xl border px-2 py-2.5 text-xs font-bold outline-none disabled:opacity-60">
              {university.admission_stages.map((stage) => <option key={stage} value={stage}>{stageLabelMap[stage] ?? stage}</option>)}
            </select>
            <button disabled={isTarget} type="submit" className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-black text-white disabled:cursor-default" style={{ backgroundColor: isTarget ? "var(--app-success)" : "var(--app-accent)" }}>
              {isTarget ? <Check size={12} /> : <Target size={12} />}{isTarget ? "已是目标" : "加入目标"}
            </button>
          </form>
          <div className="flex gap-2">
            <form action={toggleUniversityComparisonAction.bind(null, university.id)} data-permission="university_comparison" className="flex-1">
              <button type="submit" className="app-soft-card inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-black transition hover:opacity-80" style={isCompared ? { color: "var(--app-accent-strong)", borderColor: "var(--app-accent)" } : undefined}>
                {isCompared ? <X size={13} /> : <Scale size={13} />}{isCompared ? "移出对比" : "加入对比"}
              </button>
            </form>
            <UniversityAssessmentDialog university={university} />
          </div>
          <UniversityDetailsDialog university={university} />
          <Link href={`/dashboard/universities/library/${university.id}`} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>进入学校页面 <ArrowUpRight size={13}/></Link>
        </div>
      </div>
    </article>
  );
}

export function UniversityLibrary({ universities, comparedIds, targetIds }: UniversityLibraryProps) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [region, setRegion] = useState("");
  const [ownership, setOwnership] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [tuition, setTuition] = useState("");
  const [qsRank, setQsRank] = useState("");
  const [joongangRank, setJoongangRank] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);

  const activeFilterCount = [stage, region, ownership, discipline, tuition, qsRank, joongangRank].filter(Boolean).length;
  const comparedSet = useMemo(() => new Set(comparedIds), [comparedIds]);
  const targetSet = useMemo(() => new Set(targetIds), [targetIds]);
  const comparedUniversities = universities.filter((university) => comparedSet.has(university.id));

  // 所有筛选均在浏览器即时完成，切换条件时无需刷新整页。
  const filteredUniversities = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("zh-CN");
    const selectedTuition = tuitionOptions.find(([value]) => value === tuition);
    const selectedQs = qsOptions.find(([value]) => value === qsRank);
    const selectedJoongang = joongangOptions.find(([value]) => value === joongangRank);

    return universities.filter((university) => {
      const searchableText = [university.name_zh, university.name_ko, university.name_en, university.province, university.city, university.summary].join(" ").toLocaleLowerCase("zh-CN");
      if (normalizedSearch && !searchableText.includes(normalizedSearch)) return false;
      if (stage && !university.admission_stages.includes(stage)) return false;
      if (region && university.province !== region) return false;
      if (ownership && university.ownership !== ownership) return false;
      if (discipline && !university.discipline_groups.includes(discipline)) return false;
      if (selectedTuition && !(university.tuition_min_cny <= selectedTuition[3] && university.tuition_max_cny >= selectedTuition[2])) return false;
      if (selectedQs && (university.qs_rank_sort === null || university.qs_rank_sort > selectedQs[2])) return false;
      if (selectedJoongang && (university.joongang_rank_sort === null || university.joongang_rank_sort > selectedJoongang[2])) return false;
      return true;
    });
  }, [discipline, joongangRank, ownership, qsRank, region, search, stage, tuition, universities]);
  const visibleUniversities = filteredUniversities.slice(0, visibleCount);

  function toggleFilter(current: string, value: string, setter: (nextValue: string) => void) {
    setter(current === value ? "" : value);
    setVisibleCount(24);
  }

  function resetFilters() {
    setSearch("");
    setStage("");
    setRegion("");
    setOwnership("");
    setDiscipline("");
    setTuition("");
    setQsRank("");
    setJoongangRank("");
    setVisibleCount(24);
  }

  return (
    <section className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="app-card rounded-3xl border p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Filter size={17} style={{ color: "var(--app-accent)" }} /><h2 className="text-sm font-black">选校导航</h2></div>
          {activeFilterCount > 0 && <span className="rounded-full px-2 py-1 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>{activeFilterCount} 项</span>}
        </div>
        <button type="button" onClick={resetFilters} className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black app-muted-text" style={{ borderColor: "var(--app-border-soft)" }}><RotateCcw size={12} /> 重置全部筛选</button>

        <div className="mt-5 space-y-5">
          <FilterSection title="申请阶段">
            {stageOptions.map(([value, label]) => <FilterButton key={value} label={label} active={stage === value} onClick={() => toggleFilter(stage, value, setStage)} />)}
          </FilterSection>
          <FilterSection title="地区分布（韩国 17 个行政区）">
            {regionOptions.map((value) => <FilterButton key={value} label={value} active={region === value} onClick={() => toggleFilter(region, value, setRegion)} />)}
          </FilterSection>
          <FilterSection title="学校性质">
            {ownershipOptions.map(([value, label]) => <FilterButton key={value} label={label} active={ownership === value} onClick={() => toggleFilter(ownership, value, setOwnership)} />)}
          </FilterSection>
          <FilterSection title="优势学科">
            {disciplineOptions.map(([value, label]) => <FilterButton key={value} label={label} active={discipline === value} onClick={() => toggleFilter(discipline, value, setDiscipline)} />)}
          </FilterSection>
          <FilterSection title="学费预算（人民币／每年）">
            {tuitionOptions.map(([value, label]) => <FilterButton key={value} label={label} active={tuition === value} onClick={() => toggleFilter(tuition, value, setTuition)} />)}
          </FilterSection>
          <FilterSection title="世界大学排名">
            {qsOptions.map(([value, label]) => <FilterButton key={value} label={label} active={qsRank === value} onClick={() => toggleFilter(qsRank, value, setQsRank)} />)}
          </FilterSection>
          <FilterSection title="韩国中央日报排名">
            {joongangOptions.map(([value, label]) => <FilterButton key={value} label={label} active={joongangRank === value} onClick={() => toggleFilter(joongangRank, value, setJoongangRank)} />)}
          </FilterSection>
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        <div className="app-card rounded-3xl border p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2"><Landmark size={18} style={{ color: "var(--app-secondary)" }} /><h2 className="text-lg font-black">韩国大学学校库</h2></div>
              <p className="mt-1 text-xs app-muted-text">找到 {filteredUniversities.length} 所符合条件的大学，当前显示 {visibleUniversities.length} 所，共收录 {universities.length} 所。</p>
            </div>
            <label className="relative block xl:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 app-muted-text" size={16} aria-hidden="true" />
              <span className="sr-only">搜索学校</span>
              <input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(24); }} placeholder="搜索大学、韩文名或地区" className="app-input w-full rounded-2xl border py-3 pl-10 pr-4 text-sm outline-none" />
            </label>
          </div>
        </div>

        <section className="app-card rounded-3xl border p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Scale size={18} /></span>
              <div><h3 className="text-sm font-black">四校对比</h3><p className="mt-0.5 text-xs app-muted-text">已选择 {comparedUniversities.length}／4 所，点击已选院校可直接移出。</p></div>
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => {
                const university = comparedUniversities[index];
                return university ? (
                  <form key={university.id} action={toggleUniversityComparisonAction.bind(null, university.id)} data-permission="university_comparison">
                    <button type="submit" className="group/compare flex min-h-20 w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-soft-bg)" }}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>{university.name_zh.slice(0, 1)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black">{university.name_zh}</span>
                        <span className="mt-1 block truncate text-[10px] font-bold app-muted-text">{ownershipLabelMap[university.ownership]} · {university.city}</span>
                        <span className="mt-0.5 block truncate text-[10px] font-bold app-muted-text">{formatWan(university.tuition_min_cny)}万—{formatWan(university.tuition_max_cny)}万元 · {university.qs_rank_display ? `世界第 ${university.qs_rank_display}` : "世界排名暂无"}</span>
                      </span>
                      <X className="shrink-0 opacity-0 transition group-hover/compare:opacity-100" size={12} aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <div key={`empty-${index}`} className="flex min-h-20 items-center justify-center rounded-xl border border-dashed px-3 py-2 text-xs font-bold app-muted-text" style={{ borderColor: "var(--app-border)" }}>待选择</div>
                );
              })}
            </div>
          </div>
        </section>

        {filteredUniversities.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleUniversities.map((university) => (
              <UniversityCard key={university.id} university={university} isCompared={comparedSet.has(university.id)} isTarget={targetSet.has(university.id)} />
            ))}
          </div>
        ) : (
          <div className="app-card flex min-h-80 flex-col items-center justify-center rounded-3xl border p-6 text-center">
            <BarChart3 size={30} style={{ color: "var(--app-secondary)" }} />
            <h3 className="mt-4 text-base font-black">暂时没有完全符合的大学</h3>
            <p className="mt-2 max-w-md text-xs leading-5 app-muted-text">可以减少一个排名或地区条件。学费区间会因专业不同而变化，筛选结果采用区间重叠方式计算。</p>
            <button type="button" onClick={resetFilters} className="mt-5 rounded-xl px-4 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>清除筛选</button>
          </div>
        )}

        {visibleCount < filteredUniversities.length && (
          <button type="button" onClick={() => setVisibleCount((current) => current + 24)} className="app-card inline-flex w-full items-center justify-center rounded-2xl border px-4 py-3 text-xs font-black transition hover:-translate-y-0.5" style={{ color: "var(--app-accent-strong)" }}>
            再显示 24 所大学
          </button>
        )}

        <div className="flex items-start gap-2 rounded-2xl border p-4 text-xs leading-5 app-muted-text" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-card-bg)" }}>
          <BookOpen className="mt-0.5 shrink-0" size={14} />
          <p>本页展示的学费为年度参考区间，人民币换算会受汇率影响；排名按卡片标注年份展示，没有可靠公开值时显示“暂无”。正式申请前请由顾问复核大学当年的招生简章与缴费通知。</p>
        </div>
      </div>
    </section>
  );
}
