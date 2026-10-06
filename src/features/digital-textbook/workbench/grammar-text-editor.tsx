'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GrammarCardContent } from '../components/grammar-card-content';
import { grammarTextEditSchema, type GrammarTextEdit } from '@/lib/textbook-grammar-content';
import type { WorkbenchGrammarCard, WorkbenchResult } from './contracts';

export function GrammarTextEditor({ value, enabled, busy, onEditing, run, onSaved }: {
  value:WorkbenchGrammarCard; enabled:boolean; busy:boolean;
  onEditing:(value:boolean)=>void; run:(input:unknown)=>Promise<WorkbenchResult|null>; onSaved:()=>Promise<void>;
}) {
  const [draft,setDraft] = useState<GrammarTextEdit|null>(null);
  const [error,setError] = useState('');
  const field='w-full rounded-md border border-input bg-background p-3 text-sm';
  async function save() {
    if(busy||!draft)return;
    const parsed=grammarTextEditSchema.safeParse(draft);
    if(!parsed.success){setError('请填写语法形式，并检查双语文本长度。');return;}
    const result=await run({operation:'save-grammar',cardId:value.cardId,expected:value.expected,patch:parsed.data});
    if(result?.ok){setDraft(null);onEditing(false);await onSaved();}
    else setError(result&&!result.ok?result.message:'请求未完成，请刷新核对保存状态。');
  }
  return <div className="space-y-3">
    {!draft?<><GrammarCardContent card={value.card}/><Button variant="outline" disabled={!enabled||busy} onClick={()=>{setDraft({form:value.card.form,function:value.card.function,caution:value.card.caution,source:value.card.source});setError('');onEditing(true);}}>编辑语法文字</Button></>:<form className="space-y-4 rounded-xl border p-5" onSubmit={e=>{e.preventDefault();void save();}}>
      <p className="text-sm text-muted-foreground">修改形式、功能、注意事项和来源。规则、例句及媒体保持不变；本次不新增、删除或重排语法卡。</p>
      <label className="block space-y-2">语法形式<input className={field} required maxLength={12000} disabled={busy} value={draft.form} onChange={e=>setDraft({...draft,form:e.target.value})}/></label>
      {([['function','功能说明'],['caution','注意事项'],['source','来源']] as const).map(([key,title])=><fieldset key={key} className="grid gap-3 sm:grid-cols-2"><legend className="py-2 font-medium">{title}</legend>{(['zh-CN','ko-KR'] as const).map(locale=>{
        const label=`${title}（${locale==='zh-CN'?'中文':'韩文'}）`,id=`grammar-${value.cardId}-${key}-${locale}`;
        return <div key={locale} className="space-y-2 text-sm"><label htmlFor={id}>{label}</label><textarea id={id} className={field} maxLength={12000} disabled={busy} value={draft[key][locale]} onChange={e=>setDraft({...draft,[key]:{...draft[key],[locale]:e.target.value}})}/></div>;
      })}</fieldset>)}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3"><Button disabled={busy} type="submit">保存语法文字</Button><Button disabled={busy} variant="outline" type="button" onClick={()=>{setDraft(null);onEditing(false);}}>取消语法修改</Button></div>
    </form>}
  </div>;
}
