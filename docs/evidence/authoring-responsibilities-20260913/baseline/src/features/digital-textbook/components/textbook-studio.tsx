"use client";
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { BookOpen, BookText, ChevronRight, Search, Settings2 } from 'lucide-react';
import { CardTitleWithHint } from '@/components/ui/card-title-with-hint';
import { DigitalTextbookCellAction } from './digital-textbook-table/cell-action';
import type { DigitalTextbookDisplayRow } from './digital-textbook-table/columns';
import { chapterWorkbenchHref, WORKBENCH_CHAPTER_ID } from './textbook-navigation';

const ContentEditor = dynamic(() => import('./digital-textbook-action-dialogs').then(m => m.DigitalTextbookContentDialog), {
  loading: () => <p role="status" className="p-4">正在打开内容编辑器…</p>,
});
const buttonStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
function chapterLabel(row: DigitalTextbookDisplayRow) {
  return row.chapterNumber === 0 ? '课程导览' : `第 ${row.chapterNumber} 章`;
}

export function TextbookStudio({ rows, initialChapterId, canManage, canPublish, workbenchHref, courseStructureRoute }: {
  rows: DigitalTextbookDisplayRow[]; initialChapterId?: string; canManage: boolean; canPublish: boolean;
  workbenchHref?: string; courseStructureRoute?: string;
}) {
  const [selectedId, setSelectedId] = useState(initialChapterId ?? rows.find(r => r.chapterId === WORKBENCH_CHAPTER_ID)?.chapterId ?? rows[0]?.chapterId);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'content' | 'publish' | 'settings'>('content');
  const [editor, setEditor] = useState<'vocabulary' | 'grammar' | null>(null);
  const selected = rows.find(r => r.chapterId === selectedId);
  const groups = [...new Set(rows.map(r => r.textbookId))];
  const href = selected && canManage ? chapterWorkbenchHref(selected.chapterId, workbenchHref) : undefined;
  const filter = query.trim().toLocaleLowerCase();
  const visible = rows.filter(r => `${chapterLabel(r)} ${r.chapterTitle ?? ''} ${r.chapterSlug} ${r.textbookTitle}`.toLocaleLowerCase().includes(filter));
  function select(id: string) {
    setSelectedId(id); setTab('content'); setEditor(null);
    const url = new URL(window.location.href); url.searchParams.set('chapter', id);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return <section aria-label="教材制作工作区" className="overflow-hidden rounded-2xl border border-border bg-card">
    <div className="grid min-w-0 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-border bg-muted/20 lg:border-b-0 lg:border-r" aria-label="教材章节目录">
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between"><h2 className="text-base font-semibold">教材目录</h2><span className="text-xs text-muted-foreground">{rows.filter(r=>r.chapterNumber>0).length} 个章节</span></div>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input aria-label="搜索章节" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索章节" className="w-full min-w-0 bg-transparent text-sm outline-none" />
          </label>
        </div>
        <nav aria-label="选择教材章节" className="max-h-60 overflow-y-auto px-3 pb-4 lg:max-h-[68vh]">
          {groups.map(id=>{
            const group = visible.filter(r=>r.textbookId===id); if(!group.length)return null;
            return <div key={id} className="mb-3">
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">{group[0].textbookTitle}</p>
              {group.map(row=><button key={row.chapterId} type="button" onClick={()=>select(row.chapterId)} aria-current={selectedId===row.chapterId?'page':undefined}
                className={`mb-1 flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedId===row.chapterId?'bg-primary/10 text-primary':'hover:bg-muted'}`}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-xs font-semibold tabular-nums">{row.chapterNumber===0?<BookOpen className="size-4" aria-hidden="true"/>:String(row.chapterNumber).padStart(2,'0')}</span>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{row.chapterTitle || chapterLabel(row)}</span><span className="block text-xs text-muted-foreground">{chapterLabel(row)} · 第 {row.versionNumber} 版</span></span>
                {selectedId===row.chapterId&&<ChevronRight className="size-4 shrink-0" aria-hidden="true"/>}
              </button>)}
            </div>;
          })}
          {!visible.length&&<p role="status" className="p-3 text-sm text-muted-foreground">没有匹配章节，请换个关键词。</p>}
        </nav>
      </aside>
      <div className="min-w-0">
        {!selected ? <p role="status" className="p-8">{initialChapterId?'该章节不存在或不在可查看范围内，请从目录选择。':'暂无可查看的教材章节。'}</p> : <>
          <header className="space-y-5 border-b border-border p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-2"><p className="text-sm text-muted-foreground">{selected.textbookTitle} / {chapterLabel(selected)}</p><h2 className="break-words text-2xl font-semibold tracking-tight">{selected.chapterTitle || chapterLabel(selected)}</h2></div>
              {href&&<Link href={href} className={`${buttonStyle} border-transparent bg-primary text-primary-foreground hover:bg-primary/90`}>打开内容工作台<ChevronRight className="size-4" aria-hidden="true"/></Link>}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"><span>第 {selected.versionNumber} 版</span><span>词汇 {selected.vocabularyCount}</span><span>语法条目 {selected.grammarCount}</span>{!canManage&&<span>只读查看</span>}</div>
            {selected.grammarNodes.some(n=>n.items.length>0)&&<p className="text-sm text-muted-foreground">语法来源：教材卡 {selected.grammarNodes.reduce((sum,n)=>sum+(n.cards?.length??0),0)} 张；旧格式 {selected.grammarNodes.reduce((sum,n)=>sum+n.items.length,0)} 条。分别保留，不自动去重或覆盖。</p>}
            <nav aria-label="当前章节制作功能" className="flex flex-wrap gap-1">
              {([['content','内容制作'],['publish','检查与发布'],['settings','教材设置']] as const).map(([key,label])=><button key={key} type="button" aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)} className={`min-h-11 rounded-lg px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab===key?'bg-muted text-foreground':'text-muted-foreground hover:bg-muted/60'}`}>{label}</button>)}
            </nav>
          </header>
          <div className="space-y-6 p-5 sm:p-7" key={selected.chapterId}>
            {tab==='content'&&<>
              {href&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5"><div><h3 className="font-semibold">学习步骤与互动题目</h3><p className="mt-2 text-sm text-muted-foreground">在第一章工作台查看完整内容，并完成校验与发布。</p></div><span className="text-sm font-medium text-primary">第一章已接入</span></div>}
              <div className="grid gap-4 xl:grid-cols-2">
                {([{key:'vocabulary',title:'章节词汇',count:selected.vocabularyCount,unit:'个词汇',examples:selected.vocabularyNodes.flatMap(n=>n.vocabulary).map(w=>`${w.ko}　${w.zh}`)}, {key:'grammar',title:'章节语法',count:selected.grammarCount,unit:'个条目',examples:selected.grammarNodes.flatMap(n=>[...n.items.map(g=>g.title),...(n.cards??[]).map(g=>g.form)])}] as const).map(item=><section key={item.key} className="flex min-w-0 flex-col rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between gap-3"><CardTitleWithHint headingLevel={3} title={item.title} description={item.key==='vocabulary'?'编辑本章现有词汇及释义，保存后仍需按章节发布流程发布。':'统计本章语法卡和旧格式语法，二者保持各自来源。第一章语法卡文字在工作台修改并重新发布。'} titleClassName="text-base font-semibold"/><BookText className="size-5 text-muted-foreground" aria-hidden="true"/></div>
                  <p className="mt-4 text-sm text-muted-foreground">{item.count} {item.unit}</p>
                  <ul className="my-4 flex-1 space-y-2 text-sm">{item.examples.slice(0,3).map((text,i)=><li key={i} className="break-words border-b border-border/60 pb-2">{text}</li>)}{!item.examples.length&&<li className="py-4 text-muted-foreground">当前编辑器暂无可展示条目</li>}</ul>
                  {canManage&&<button type="button" onClick={()=>setEditor(item.key)} className={`${buttonStyle} self-start`}>{item.key==='vocabulary'?'编辑词汇':'查看语法内容'}</button>}
                </section>)}
              </div>
              {courseStructureRoute&&<Link href={`${courseStructureRoute}?chapter=${encodeURIComponent(selected.chapterId)}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">查看本章课程结构<ChevronRight className="size-4" aria-hidden="true"/></Link>}
            </>}
            {tab==='publish'&&<>
              {href&&<section className="space-y-4 rounded-xl border border-border p-5"><h3 className="text-base font-semibold">新教材内容发布</h3><p className="max-w-2xl text-sm leading-6 text-muted-foreground">打开工作台，按“进入编辑 → 保存内容 → 校验 → 发布”完成。进入编辑会暂停本教材测试运行，重新发布后恢复。</p><Link href={href} className={buttonStyle}>前往校验与发布</Link></section>}
              <section className="space-y-4 rounded-xl border border-border p-5"><CardTitleWithHint headingLevel={3} title="章节与关联测试" description="沿用现有章节发布服务，同时发布关联测试，不发布教学脚本，不更新新教材快照。" titleClassName="text-base font-semibold"/><p className="text-sm text-muted-foreground">章节状态：{selected.chapterStatus==='published'?'已发布':selected.chapterStatus==='draft'?'草稿':'已归档'}</p><DigitalTextbookCellAction row={selected} canManage={false} canPublishChapter={canPublish}/></section>
            </>}
            {tab==='settings'&&<section className="space-y-4 rounded-xl border border-border p-5"><div className="flex items-center gap-2"><Settings2 className="size-5" aria-hidden="true"/><h3 className="font-semibold">整本教材设置</h3></div><p className="text-sm text-muted-foreground">{selected.textbookTitle} · 操作影响这本教材的全部章节。</p><dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">教材标识</dt><dd className="break-all">{selected.textbookSlug}</dd></div><div><dt className="text-muted-foreground">章节标识</dt><dd className="break-all">{selected.chapterSlug}</dd></div></dl><DigitalTextbookCellAction row={selected} canManage={canManage} canPublishChapter={false} settingsOnly/></section>}
          </div>
          {editor&&canManage&&<ContentEditor open onOpenChange={open=>{if(!open)setEditor(null);}} panel={editor} row={selected}/>}</>}
      </div>
    </div>
  </section>;
}
