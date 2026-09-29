import { notFound } from 'next/navigation';
import { requirePlatformOwner } from '@/lib/admin';
import { readAuditSource } from '@/features/smart-textbook-runtime/server/audit-source.server';
import { createRecordingAuditContinuation } from '@/features/smart-textbook-runtime/server/audit-session.server';
import { AuditRuntimeClient } from '@/features/smart-textbook-runtime/components/audit-client';
import { runtimeReadiness } from '@/features/smart-textbook-runtime/core/block-registry';
import {z} from 'zod';
import { publicationDiagnostics } from '@/lib/smart-textbook-publishing/diagnostics.server';
import { PublicationIssues } from '@/features/digital-textbook/workbench/publication-issues';

/** Isolated owner-only, tracking-disabled inspection; no student route import or switch. */
export default async function RuntimeAuditPage({params,searchParams}:{params:Promise<{space:string;appSlug:string}>;searchParams:Promise<{recordingAudit?:string|string[];locale?:string|string[]}>}){
  const {user}=await requirePlatformOwner();
  const {appSlug,space}=await params;
  if(appSlug!=='korean')notFound();
  const base=`/${encodeURIComponent(space)}/dashboard/admin/apps/korean`;
  const contentHref=`${base}/textbooks/workbench`,scriptsHref=`${base}/teaching-scripts`;
  let data:Awaited<ReturnType<typeof readAuditSource>>;
  try{data=await readAuditSource();}catch(error){
    return <main className="mx-auto max-w-7xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">已保存内容预览</h1>
      <p role="alert">当前内容未通过编译，未启动预览。学生已发布版本不会被本次预览替换。</p>
      <PublicationIssues diagnostics={publicationDiagnostics(error)} contentHref={contentHref} scriptsHref={scriptsHref}/>
      <a className="inline-flex min-h-11 items-center text-primary underline" href={contentHref}>返回第一章内容工作台</a>
      <p className="text-sm text-muted-foreground">若没有具体定位，请刷新重试；仍失败时联系维护人员核对读取权限和运行依赖。不要重复发布或删除素材。</p>
    </main>;
  }
  const manifest=data.result.manifest;
  const query=await searchParams;
  const locale=z.enum(['zh-CN','ko-KR']).parse(query.locale??'zh-CN');
  let sessionId:string;
  try{if(query.recordingAudit&&typeof query.recordingAudit!=='string')throw Error('INVALID_AUDIT');sessionId=createRecordingAuditContinuation(user.id,data,query.recordingAudit,locale);}catch{
    return <main className="p-4"><p role="alert">隔离录音会话已过期、源版本已变化或无权恢复。不会转移其他会话的录音。</p><a href={`/${encodeURIComponent(space)}/dashboard/admin/apps/korean/teaching-scripts/runtime-v1-preview`}>开始新的隔离审计</a></main>;
  }
  const readiness=runtimeReadiness(manifest,data.result.nonUiRuntimeReady);
  return <main className="mx-auto max-w-7xl space-y-4 p-4">
    <h1 className="text-2xl font-bold">已保存内容预览</h1>
    <p>使用与发布相同的编译与校验规则，显示打开本页时已保存的内容，不包含未保存表单。此预览不会发布，也不保存学生正式作答或学习进度。</p>
    <p>学生只会加载已经发布的版本；预览通过不代表已经发布。修改保存后请重新打开预览。</p>
    <a className="inline-flex min-h-11 items-center text-primary underline" href={contentHref}>返回第一章内容工作台</a>
    <a href={`/${encodeURIComponent(space)}/dashboard/admin/apps/korean/teaching-scripts/preview?scriptVersionId=${data.source.teachingVersions[0].id}`}>打开旧教材预览对照</a>
    <p>非 UI 就绪：{readiness.nonUiRuntimeReady?'是':'否'}；章节可执行：{readiness.runtimeReady?'是':'否'}</p>
    <AuditRuntimeClient manifest={manifest} context={{runtimeSessionId:sessionId,snapshotId:manifest.snapshot.id,sourceState:'draft',trackingDisabled:true,locale,supportMode:'bilingual'}}
      state={{snapshotId:manifest.snapshot.id,revision:data.result.report.sourceRevision,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]}}/>
  </main>;
}
