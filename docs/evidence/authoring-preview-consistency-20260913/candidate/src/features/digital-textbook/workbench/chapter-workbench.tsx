'use client';
import Link from 'next/link';
import { startTransition, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardTitleWithHint } from '@/components/ui/card-title-with-hint';
import { chapterWorkbenchAction } from './actions';
import { GrammarTextEditor } from './grammar-text-editor';
import { PublicationIssues } from './publication-issues';
import type { PublicationDiagnostic } from '@/lib/smart-textbook-publishing/diagnostics';
import type { ChapterWorkbenchData, PublicationCheck, WorkbenchActivity, WorkbenchResult } from './contracts';

type Props = { initial: ChapterWorkbenchData; previewHref: string; contentHref: string; scriptsHref: string };
const surface = 'rounded-xl border border-border bg-card p-5';
const linkStyle = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const field = 'w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-2 focus-visible:outline-primary';

export function ChapterWorkbench({ initial, previewHref, contentHref, scriptsHref }: Props) {
  const [data, setData] = useState(initial);
  const [active, setActive] = useState(initial.steps[0]?.id);
  const [state, setState] = useState<'locked'|'draining'|'editing'>('locked');
  const [check, setCheck] = useState<PublicationCheck|null>(null);
  const [message, setMessage] = useState('先查看内容；需要修改时进入编辑。');
  const [failed, setFailed] = useState(false);
  const [diagnostics,setDiagnostics]=useState<PublicationDiagnostic[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [editor, setEditor] = useState<WorkbenchActivity|null>(null);
  const [grammarEditing,setGrammarEditing] = useState(false);
  const editing = !!editor || grammarEditing;
  const [section, setSection] = useState<'activities'|'teaching'|'publish'>('activities');
  const step = data.steps.find(s=>s.id===active);
  async function run(input: unknown): Promise<WorkbenchResult|null> {
    if(lock.current) return null;
    lock.current=true; setBusy(true); setFailed(false); setDiagnostics([]);
    try {
      const result = await new Promise<WorkbenchResult>((resolve,reject)=>{
        startTransition(async()=>{try{resolve(await chapterWorkbenchAction(input));}catch(error){reject(error);}});
      });
      if(!result.ok) { setMessage(result.message); setFailed(true); setCheck(null); setDiagnostics(result.diagnostics??[]); }
      return result;
    } catch { setFailed(true); setMessage('请求未完成，状态可能已改变。请刷新核对，不要重复盲目提交。'); setCheck(null); return null; }
    finally {lock.current=false;setBusy(false);}
  }
  async function begin() {
    if(state!=='draining' && !window.confirm('进入编辑会停止该教材的测试运行，并使旧测试会话失效。作答、进度和录音不会删除；完成后需重新校验发布。确定继续？'))return;
    setCheck(null);
    const r=await run({operation:'begin'});
    if(r?.ok&&r.kind==='begin') {setState(r.state);setMessage(r.state==='editing'?'已进入编辑。保存后请校验并发布；即使未修改，也需要重新发布才能恢复测试。':`仍有 ${r.inflight} 个学习请求未结束。请稍后重新检查，不会强制清理。`);}
  }
  async function refresh() {
    if(editing&&!window.confirm('刷新会放弃当前表单中未保存的修改，确定继续？'))return;
    const r=await run({operation:'read'});
    if(r?.ok&&r.kind==='read') {setData(r.data);setEditor(null);setCheck(null);setState('locked');setMessage('内容已刷新。保存权限仍由服务器编辑窗口决定；需要编辑时重新确认进入编辑。');}
  }
  async function validate() {
    const r=await run({operation:'check'});
    if(r?.ok&&r.kind==='check'){setCheck(r.check);setMessage('校验通过。发布将再次检查内容和当前发布版本。');}
  }
  async function publish() {
    if(!check||!window.confirm('确认发布刚刚校验的内容？测试账号重新进入后将加载本次发布。'))return;
    const r=await run({operation:'publish',expected:check.expected,digest:check.digest});
    if(r?.ok&&r.kind==='publish'){setData({...data,pointer:r.pointer});setState('locked');setCheck(null);setMessage('发布成功。测试账号请返回课程后重新进入；本操作不扩大 Runtime 开放范围。');}
  }
  async function save() {
    if(!editor||editor.answerIndex===null)return;
    const r=await run({operation:'save',activityId:editor.id,prompt:editor.prompt,koreanPrompt:editor.koreanPrompt,answerIndex:editor.answerIndex});
    if(r?.ok&&r.kind==='save'){
      setData({...data,steps:data.steps.map(s=>({...s,nodes:s.nodes.map(n=>({...n,activities:n.activities.map(a=>a.id===editor.id?editor:a)}))}))});
      setEditor(null);setCheck(null);setMessage('题干和正确选项已一并保存，尚未发布。');
    }
  }
  async function grammarSaved() {
    setCheck(null);
    const read=await run({operation:'read'});
    if(read?.ok&&read.kind==='read'){setData(read.data);setMessage('语法文字和稳定身份映射已保存，尚未发布。请重新校验并发布。');}
  }
  return <div className="overflow-hidden rounded-2xl border border-border bg-card" aria-busy={busy}>
    <header className="space-y-5 border-b border-border p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-muted-foreground">第一章内容工作台</p>
          <CardTitleWithHint title={data.title} headingLevel={1} description="查看学习步骤与活动。支持的单选题可在进入编辑后修改，保存后需要校验并发布。" titleClassName="text-2xl font-semibold tracking-tight"/>
          <p className="text-sm text-muted-foreground">{data.steps.length} 个学习步骤 · {data.steps.reduce((sum,s)=>sum+s.nodes.reduce((n,node)=>n+node.activities.length,0),0)} 个活动 · 第 {data.version} 版</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={previewHref} target="_blank" rel="noopener noreferrer" className={linkStyle}>预览已保存内容（新窗口）</Link>
          <Button className="min-h-11" disabled={busy||editing||state==='editing'} onClick={begin}>{state==='draining'?'重新检查编辑条件':state==='editing'?'已进入编辑':'进入编辑'}</Button>
        </div>
      </div>
      <nav aria-label="工作台功能" className="flex flex-wrap gap-1">
        {([['activities','活动内容'],['teaching','教学脚本'],['publish','校验发布']] as const).map(([key,label])=><button key={key} type="button" onClick={()=>setSection(key)} disabled={busy||editing} aria-current={section===key?'page':undefined} className={`min-h-11 rounded-lg px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${section===key?'bg-primary/10 text-primary':'text-muted-foreground hover:bg-muted'}`}>{label}</button>)}
      </nav>
      <p role={failed?'alert':'status'} aria-live="polite" className={`rounded-lg px-4 py-3 text-sm leading-6 ${failed?'bg-destructive/10 text-destructive':state==='editing'?'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200':'bg-muted/60 text-muted-foreground'}`}>{busy?'正在处理，请勿重复操作…':message}</p>
      <PublicationIssues diagnostics={diagnostics} contentHref={contentHref} scriptsHref={scriptsHref} autoFocus
        onLocate={editing?undefined:id=>{if(data.steps.some(s=>s.id===id)){setActive(id);setSection('activities');}}}/>
    </header>
    {section==='publish'?<div className="grid items-start gap-5 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-5">
        <section className={`${surface} space-y-4`}>
          <CardTitleWithHint headingLevel={2} title="检查待发布内容" description="校验已保存的题目、资源和教学依赖；发布时仍会再次检查，防止校验后内容被改动。" titleClassName="text-lg font-semibold"/>
          <p className="text-sm leading-6 text-muted-foreground">{check?`校验通过：${check.steps} 个步骤、${check.activities} 个活动。`:'先保存全部修改，再进行发布检查。'}</p>
          <Button variant="outline" className="min-h-11" disabled={busy||editing} onClick={validate}>校验待发布内容</Button>
        </section>
        <section className={`${surface} space-y-4`}>
          <h2 className="text-lg font-semibold">确认发布</h2>
          <p className="text-sm leading-6 text-muted-foreground">发布成功后，测试账号返回课程并重新进入，加载本次内容。此操作不会扩大测试账号范围。</p>
          <Button className="min-h-11" disabled={busy||editing||!check} onClick={publish}>发布校验版本</Button>
          {!check&&<p className="text-sm text-muted-foreground">完成上方校验后可发布。</p>}
        </section>
      </div>
      <aside className={`${surface} space-y-4`}>
        <h2 className="font-semibold">发布记录</h2>
        <p className="text-sm">{data.pointer?`最近发布：第 ${data.pointer.generation} 次`:'尚无发布记录'}</p>
        <p className="text-sm leading-6 text-muted-foreground">进入编辑会暂停教材测试运行。即使没有修改，也要重新校验发布才能恢复。</p>
        <Button variant="outline" className="min-h-11" disabled={busy} onClick={refresh}>刷新内容</Button>
        <details className="border-t border-border pt-3"><summary className="cursor-pointer py-2 text-sm text-muted-foreground">查看发布详情</summary><div className="space-y-3 break-all pt-3 text-xs leading-6 text-muted-foreground">{data.pointer&&<p>发布标识：{data.pointer.snapshotId}</p>}{check&&<p>内容摘要：{check.digest}</p>}{!data.pointer&&!check&&<p>暂无详情</p>}</div></details>
      </aside>
    </div>:<div className="grid min-w-0 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-border bg-muted/20 p-3 lg:border-b-0 lg:border-r">
        <h2 className="px-3 py-3 text-sm font-semibold">学习步骤</h2>
        <nav aria-label="章节学习步骤" className="max-h-64 space-y-1 overflow-y-auto lg:max-h-[70vh]">
          {data.steps.map((s,i)=><button key={s.id} type="button" aria-current={active===s.id?'step':undefined} disabled={busy||editing}
            className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${active===s.id?'bg-primary/10 text-primary':'hover:bg-muted'}`}
            onClick={()=>setActive(s.id)}><span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-xs tabular-nums">{i+1}</span><span className="min-w-0"><span className="block font-medium">{s.title}</span><span className="mt-1 block text-xs text-muted-foreground">{s.nodes.reduce((sum,n)=>sum+n.activities.length,0)} 个活动</span></span></button>)}
        </nav>
      </aside>
      {step&&<div className="min-w-0 space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <CardTitleWithHint title={step.title} description={step.description} headingLevel={2} titleClassName="text-xl font-semibold"/>
          <Link href={section==='teaching'?scriptsHref:contentHref} className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">{section==='teaching'?'前往教学脚本管理':'词汇与语法编辑入口'}</Link>
        </div>
        {section==='teaching'?<>
          <p className="text-sm text-muted-foreground">本页展示已发布台词，修改请前往教学脚本管理。</p>
          {step.teaching.map((t,i)=><section key={`${t.title}-${i}`} className={`${surface} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{t.title}</h3><span className="text-xs text-muted-foreground">已发布 v{t.version}</span></div><p className="whitespace-pre-wrap text-sm leading-7">{t.script||'此节点没有教学台词。'}</p></section>)}
          {!step.teaching.length&&<p className="rounded-lg bg-muted/40 p-5 text-sm text-muted-foreground">当前步骤没有可展示的教学脚本。</p>}
        </>:<>
          <p className="text-sm text-muted-foreground">{editor?'正在编辑题目，保存或取消后可切换步骤。':state==='editing'?'选择题目进行修改，保存后到“校验发布”完成发布。':'当前为查看模式，点击顶部“进入编辑”后可修改支持的题目。'}</p>
          {step.nodes.map(node=><section key={node.id} className="space-y-3">
            {(node.grammarCards??[]).map(card=><GrammarTextEditor key={card.cardId} value={card} enabled={state==='editing'&&!editing} busy={busy} onEditing={setGrammarEditing} run={run} onSaved={grammarSaved}/>)}
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-muted-foreground">{node.title}</h3><span className="text-xs text-muted-foreground">{node.activities.length} 个活动</span></div>
            {node.activities.map((a,index)=><article key={a.id} className={`${surface} space-y-3`}>
              <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">题目 {index+1}</span><span className="text-xs text-muted-foreground">{a.editable?'可编辑题干与答案':'当前只读'}</span></div>
                          {editor?.id===a.id?<form className="space-y-4" onSubmit={e=>{e.preventDefault();void save();}}>
              <div className="space-y-2 text-sm"><label htmlFor="workbench-prompt-zh">中文题干</label><textarea id="workbench-prompt-zh" required maxLength={4000} disabled={busy} className={field} value={editor.prompt} onChange={e=>setEditor({...editor,prompt:e.target.value})}/></div>
              <div className="space-y-2 text-sm"><label htmlFor="workbench-prompt-ko">韩文题干</label><textarea id="workbench-prompt-ko" required maxLength={4000} disabled={busy} className={field} value={editor.koreanPrompt} onChange={e=>setEditor({...editor,koreanPrompt:e.target.value})}/></div>
              <div className="space-y-2 text-sm"><label htmlFor="workbench-answer">正确选项（仅负责人可见）</label><select id="workbench-answer" disabled={busy} className={field} value={editor.answerIndex??''} onChange={e=>setEditor({...editor,answerIndex:Number(e.target.value)})}>{editor.options.map((o,i)=><option key={i} value={i}>{i+1}. {o}</option>)}</select></div>
              <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>保存题目</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setEditor(null)}>取消修改</Button></div>
            </form>:<>
              <CardTitleWithHint title={a.prompt||'未填写题干'} description={a.instruction} headingLevel={4}/>
              {a.koreanPrompt&&a.koreanPrompt!==a.prompt&&<p lang="ko" className="text-sm leading-6 text-muted-foreground">{a.koreanPrompt}</p>}
              {a.options.length>0&&<ol className="my-3 grid list-inside list-decimal gap-2 text-sm xl:grid-cols-2">{a.options.map((o,i)=><li key={i} className={`rounded-lg px-3 py-2 ${a.answerIndex===i?'bg-primary/5 text-foreground':'bg-muted/40'}`}>{o}{a.answerIndex===i?'（正确选项）':''}</li>)}</ol>}
              {a.editable?<Button variant="outline" className="mt-3" disabled={busy||editing||state!=='editing'} onClick={()=>{setEditor({...a});setCheck(null);}}>编辑题干与答案</Button>:<p className="mt-3 text-sm text-muted-foreground">当前只读 · 复杂活动仍使用原服务与完成规则</p>}
            </>}
            </article>)}
            {!node.activities.length&&<p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">此节点没有独立题目，可通过顶部预览查看学习内容。</p>}
          </section>)}
        </>}
      </div>}
    </div>}
  </div>;
}
