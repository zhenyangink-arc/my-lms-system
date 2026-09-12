"use client";

import { useMemo, useState } from "react";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { institutionSignals, formatHours, type InsightMode, type InsightReport, type Metrics } from "./model";

const TITLES = { grades: "机构成绩对比", records: "机构学习情况", conversation: "会话与课堂对比" };
const SKILLS = ["听力理解", "口语表达", "阅读理解", "书面表达", "语法运用", "词汇运用"];
const number = (value: number | null, suffix = "") => value === null ? "暂无数据" : `${value.toFixed(1)}${suffix}`;
type Column = { key: keyof Metrics; title: string; format?: (value: number | null) => string };
const COLUMNS: Record<InsightMode, Column[]> = {
  grades: [{ key: "samples", title: "有效成绩" }, { key: "average", title: "平均分", format: value => number(value) }, { key: "passRate", title: "通过率", format: value => number(value, "%") }],
  records: [{ key: "students", title: "当前授权" }, { key: "participants", title: "活跃学生" }, { key: "seconds", title: "学习小时", format: value => formatHours(value ?? 0) }, { key: "completed", title: "完成课时人次" }, { key: "inactive", title: "本期未活跃" }, { key: "attention", title: "当前关注学生" }],
  conversation: [{ key: "participants", title: "练习学生" }, { key: "practices", title: "练习记录" }, { key: "completed", title: "完成场景人次" }, { key: "classes", title: "本期开课" }, { key: "activeClasses", title: "当前未结束课堂" }],
};
function difference(current: number | null, previous: number | null, suffix = "") {
  if (current === null || previous === null) return "前期数据不足，暂不比较";
  const delta = current - previous;
  return `较前期 ${delta > 0 ? "+" : ""}${delta.toFixed(1)}${suffix}`;
}

export function InsightBoard({ report, mode, days, skillsAvailable = true, courseSelected = false }: { report: InsightReport; mode: InsightMode; days: number; skillsAvailable?: boolean; courseSelected?: boolean }) {
  const [search, setSearch] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [sort, setSort] = useState<keyof Metrics | "name">("name");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => report.rows.filter(row => (!onlyAttention || institutionSignals(row, mode).length > 0)).filter(row => row.tenant.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a, b) => {
    if (sort === "name") return a.tenant.name.localeCompare(b.tenant.name, "zh-CN") * (descending ? -1 : 1);
    const left = a.current[sort], right = b.current[sort];
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return (Number(left) - Number(right)) * (descending ? -1 : 1) || a.tenant.name.localeCompare(b.tenant.name, "zh-CN");
  }), [report.rows, search, sort, descending, onlyAttention, mode]);
  const pages = Math.max(1, Math.ceil(rows.length / 15));
  const activePage = Math.min(page, pages);
  const detail = report.rows.find(row => row.tenant.id === selected);
  const { current, previous } = report;
  const cards = mode === "grades" ? [
    { title: "有效成绩", value: String(current.samples), hint: "每名学生在同一考核中取本期最近一次有效成绩；不把重考重复计入总样本。" },
    { title: "平均分", value: number(current.average), hint: "每份成绩先换算为百分制，再按有效成绩等权平均。", change: difference(current.average, previous.average, " 分") },
    { title: "通过率", value: number(current.passRate, "%"), hint: "章节测试采用记录中的通过结果；作业与考试按百分制 60 分统计。", change: difference(current.passRate, previous.passRate, " 个百分点") },
  ] : mode === "records" ? [
    { title: "活跃学生", value: String(current.participants), hint: "本期有学习活动的去重学生人数；跨机构按各机构授权身份计数，不包含老师批改事件。", change: difference(current.participants, previous.participants, " 人") },
    { title: "有效学习小时", value: formatHours(current.seconds), hint: "先汇总有效学习秒数，再换算为小时；小于 0.05 小时会显示为 0.0。", change: difference(current.seconds / 3600, previous.seconds / 3600, " 小时") },
    { title: "本期未活跃", value: String(current.inactive), hint: "当前有授权、但所选时间内没有学习活动的学生，包含新开通但尚未开始的学生。" },
    { title: "当前关注学生", value: String(current.attention), hint: "当前仍有效的人工关注备注涉及的去重学生人数，包含早于本期的未归档关注。" },
  ] : [
    { title: "练习学生", value: String(current.participants), hint: "同一机构内按学生去重；练习多个场景仍只计一人。", change: difference(current.participants, previous.participants, " 人") },
    { title: "练习记录", value: String(current.practices), hint: "本期活动账本中记录的会话练习事件数；历史补录不代表完整历史练习次数。", change: difference(current.practices, previous.practices, " 条") },
    { title: "本期开课", value: String(current.classes), hint: "在所选时间内创建的实时伴学课堂，包括一对一和小组课堂。" },
    { title: "当前未结束课堂", value: String(current.activeClasses), hint: "课堂记录仍标记为未结束，包含本期之前创建的课堂；不等同于师生当前在线。" },
  ];
  const maxTrend = Math.max(1, ...report.trend.map(row => row.value));
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => <section key={card.title} className="app-card border p-4">
        <CardTitleWithHint headingLevel={2} title={card.title} description={card.hint} hintLabel={`${card.title}统计说明`} titleClassName="text-sm font-medium" />
        <p className="mt-1 text-3xl font-semibold tabular-nums">{card.value}</p>
        {"change" in card && <p className="app-muted-text mt-2 text-xs">{card.change}</p>}
      </section>)}
    </div>
    <div className={`grid gap-4 ${mode === "grades" ? "xl:grid-cols-2" : ""}`}>
      <section className="app-card min-w-0 border p-4">
        <CardTitleWithHint headingLevel={2} title={mode === "grades" ? "成绩变化" : mode === "records" ? "学习时长变化" : "会话练习变化"} description={`最近 ${days} 天按 ${Math.max(1, Math.ceil(days / 12))} 天分组，日期为韩国时间的分组起点。成绩按每组最近一次有效结果计算；无成绩显示“暂无”，不按零分处理。`} titleClassName="text-sm font-semibold" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-sm"><caption className="sr-only">本期分段趋势</caption><thead><tr className="app-muted-text text-left"><th scope="col" className="py-2 font-medium">起始日期</th><th scope="col" className="py-2 font-medium">{mode === "grades" ? "平均分" : mode === "records" ? "学习小时" : "练习记录"}</th></tr></thead><tbody>
            {report.trend.map(row => <tr key={row.date} className="border-t"><th scope="row" className="w-20 py-2 text-left font-normal">{row.date}</th><td className="py-2"><div className="flex items-center gap-3"><span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded bg-[var(--surface-soft)]"><span className="block h-full bg-[var(--primary)]" style={{ width: `${Math.max(0, row.value) / maxTrend * 100}%` }} /></span><span className="w-16 text-right tabular-nums">{row.value < 0 ? "暂无" : row.value.toFixed(mode === "conversation" ? 0 : 1)}</span></div></td></tr>)}
          </tbody></table>
        </div>
      </section>
      {mode === "grades" && <section className="app-card border p-4">
        <CardTitleWithHint headingLevel={2} title="成绩分布" description="按本期有效成绩的百分制分数分段。该分段与章节测试自身的通过标准可能不同。" titleClassName="text-sm font-semibold" />
        <dl className="mt-3 space-y-4">{["低于 60 分", "60–74 分", "75–89 分", "90–100 分"].map((label, index) => <div key={label} className="flex items-center justify-between border-b pb-3"><dt className="text-sm">{label}</dt><dd className="text-sm tabular-nums">{current.distribution[index]} 份</dd></div>)}</dl>
        <CardTitleWithHint className="mt-5" headingLevel={2} title="累计六维能力" description="所选机构全部作业与考试的累计能力证据；每个考核采用最近已批改结果，按题目分值加权。不随时间和成绩来源筛选变化，不包含章节测试。缺少证据的维度保持空缺。" titleClassName="text-sm font-semibold" />
        {courseSelected ? <p className="app-muted-text text-sm">现有累计能力数据未按课程拆分。请切换到全部课程查看，避免将全应用能力误作本课程表现。</p> : skillsAvailable ? <dl className="mt-2 grid grid-cols-2 gap-3">{report.skills.map((row, index) => <div key={row.skill} className="border p-3"><dt className="text-xs">{SKILLS[index]}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{number(row.value)}</dd><dd className="app-muted-text mt-1 text-xs">{row.evidenceCount} 道评分题目</dd></div>)}</dl> : <p role="status" className="app-muted-text text-sm">能力数据暂时无法读取。</p>}
      </section>}
    </div>
    {mode !== "conversation" && <section className="app-card border p-4">
      <CardTitleWithHint headingLevel={2} title="需要核对的机构" description="系统筛查规则：两期各至少 10 份成绩且平均分下降至少 10 分；或当前授权至少 5 人且本期未活跃比例至少 50%；或存在有效人工关注备注。仅供核对，不代表个人学习诊断，也不会自动发送消息。" titleClassName="text-sm font-semibold" />
      <p className="mt-1 text-sm">{report.rows.filter(row => institutionSignals(row, mode).length > 0).length} 家机构符合筛查条件</p>
      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={onlyAttention} onChange={event => { setOnlyAttention(event.target.checked); setPage(1); }} />下方只显示需要核对的机构</label>
    </section>}
    <section className="app-card min-w-0 border p-4">
      <CardTitleWithHint headingLevel={2} title={TITLES[mode]} description="点击列标题排序，点击机构名称展开汇总明细。表内搜索只影响机构列表；上方指标与图表由页面顶部筛选控制。" titleClassName="text-sm font-semibold" />
      <label className="mt-2 block max-w-sm text-sm">搜索机构<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="输入机构名称" className="app-input mt-1 h-11 w-full border px-3" /></label>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">{TITLES[mode]}</caption><thead><tr className="border-b bg-[var(--surface-soft)]">
        {[{ key: "name", title: "机构" }, ...COLUMNS[mode]].map(column => <th key={column.key} scope="col" aria-sort={sort === column.key ? descending ? "descending" : "ascending" : "none"}><button type="button" className="min-h-11 whitespace-nowrap px-3 text-left font-medium focus-visible:outline-2" onClick={() => { if (sort === column.key) setDescending(!descending); else { setSort(column.key as keyof Metrics | "name"); setDescending(column.key !== "name"); } setPage(1); }}>{column.title}{sort === column.key ? descending ? " ↓" : " ↑" : " ↕"}</button></th>)}
      </tr></thead><tbody>{rows.slice((activePage - 1) * 15, activePage * 15).map(row => <tr key={row.tenant.id} className="border-b last:border-0"><th scope="row" className="px-3 text-left font-medium"><button type="button" aria-expanded={selected === row.tenant.id} aria-controls="institution-insight-detail" onClick={() => setSelected(selected === row.tenant.id ? null : row.tenant.id)} className="min-h-11 text-[var(--primary)] underline underline-offset-4">{row.tenant.name}</button></th>{COLUMNS[mode].map(column => <td key={column.key} className="whitespace-nowrap px-3 py-3 tabular-nums">{column.format ? column.format(row.current[column.key] as number | null) : String(row.current[column.key])}</td>)}</tr>)}{!rows.length && <tr><td colSpan={COLUMNS[mode].length + 1} className="app-muted-text py-8 text-center">{search || onlyAttention ? "没有匹配的机构，请调整筛选条件。" : "当前范围没有已注册此应用的机构。"}</td></tr>}</tbody></table></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="app-muted-text">{rows.length} 家机构 · 第 {activePage} / {pages} 页</span><div className="flex gap-2"><button type="button" disabled={activePage === 1} onClick={() => setPage(activePage - 1)} className="min-h-11 border px-3 disabled:opacity-40">上一页</button><button type="button" disabled={activePage === pages} onClick={() => setPage(activePage + 1)} className="min-h-11 border px-3 disabled:opacity-40">下一页</button></div></div>
      <div id="institution-insight-detail" aria-live="polite">{detail && <div className="mt-4 border-t pt-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{detail.tenant.name} · 汇总明细</h3><button type="button" onClick={() => setSelected(null)} className="min-h-11 border px-3 text-sm">收起明细</button></div>{institutionSignals(detail, mode).map(signal => <div key={signal.key} className="mt-3 border-l-2 border-[var(--status-warning)] pl-3"><h4 className="text-sm font-semibold">{signal.title}</h4><p className="mt-1 text-sm">{signal.reason}</p><p className="app-muted-text mt-1 text-sm">{signal.nextAction}</p></div>)}<dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {COLUMNS[mode].map(column => <div key={column.key} className="border p-3"><dt className="app-muted-text text-xs">{column.title}</dt><dd className="mt-1 font-semibold">{column.format ? column.format(detail.current[column.key] as number | null) : String(detail.current[column.key])}</dd></div>)}
        {mode === "records" && <div className="border p-3"><dt className="app-muted-text text-xs">本期辅导备注</dt><dd className="mt-1">{detail.current.notes} 条</dd></div>}
        {mode === "conversation" && <><div className="border p-3"><dt className="app-muted-text text-xs">可用场景目录（已发布 / 全部）</dt><dd className="mt-1">{detail.current.publishedScenarios} / {detail.current.scenarios}</dd></div><div className="border p-3"><dt className="app-muted-text text-xs">本期开课中已结束</dt><dd className="mt-1">{detail.current.endedClasses} 节</dd></div></>}
      </dl></div>}</div>
    </section>
  </div>;
}
