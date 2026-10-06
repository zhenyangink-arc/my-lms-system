import { CardTitleWithHint } from '@/components/ui/card-title-with-hint';
import type { TextbookGrammarCard } from '@/lib/textbook-grammar-content';

export function GrammarCardContent({ card }: { card: TextbookGrammarCard }) {
  const bilingual = (value: { 'zh-CN': string; 'ko-KR': string }) => <><p>{value['zh-CN']}</p><p lang="ko" className="text-muted-foreground">{value['ko-KR']}</p></>;
  return <article className="space-y-4 rounded-xl border border-border p-4 text-sm leading-6">
    <CardTitleWithHint title={card.form} description={card.function['zh-CN']} headingLevel={3}/>
    <p lang="ko">{card.function['ko-KR']}</p>
    <ul className="list-inside list-disc">{card.rules.map((r,i)=><li key={i}>{r}</li>)}</ul>
    <section aria-label="语法例句" className="space-y-2">{card.examples.map((e,i)=><div key={i}><p lang="ko">{e.ko}</p><p>{e.zh}</p></div>)}</section>
    <section><h4 className="font-semibold">注意事项</h4>{bilingual(card.caution)}</section>
    {card.comparison&&<section><h4 className="font-semibold">对比说明</h4>{bilingual(card.comparison)}</section>}
    <section><h4 className="font-semibold">来源</h4>{bilingual(card.source)}</section>
  </article>;
}
