import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import type { PracticeSnapshotItem } from "@/lib/chapter-practice-binding";

const string = (value: unknown) => typeof value === "string" ? value : "";
function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === "object" && !Array.isArray(item)) : [];
}
export function ReferencedGrammarMaterials({ items }: { items: PracticeSnapshotItem[] }) {
  const grammar = items.filter(item => item.kind === "grammar" && string(item.value.title));
  if (!grammar.length) return null;
  return <section className="space-y-3">
    <CardTitleWithHint headingLevel={2} title="本章语法复习" description="先复习老师已确认的教材语法，再完成下方练习。阅读材料不计入正式题目成绩。" />
    {grammar.map((item, index) => <details key={`${item.nodeId}:${index}`} className="rounded-xl border border-[var(--border)] p-4">
      <summary className="cursor-pointer font-semibold">{string(item.value.title)}</summary>
      <div className="space-y-3 pt-3 text-sm leading-6">
        <p className="whitespace-pre-wrap">{string(item.value.meaning)}</p>
        {rows(item.value.cases).map((row, i) => <p key={`case:${i}`}>{string(row.batchim)}：{string(row.conjugation)}</p>)}
        {rows(item.value.rows).map((row, i) => <p key={`form:${i}`}>{string(row.form)}：{string(row.combination)}</p>)}
        {rows(item.value.examples).map((row, i) => <p key={`example:${i}`}><span lang="ko">{string(row.ko)}</span><br />{string(row.zh)}</p>)}
        {string(item.value.caution) && <p className="whitespace-pre-wrap">注意事项：{string(item.value.caution)}</p>}
      </div>
    </details>)}
  </section>;
}
