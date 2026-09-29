import { notFound } from 'next/navigation';
import { requirePlatformOwner } from '@/lib/admin';
import { readAuditSource } from '@/features/smart-textbook-runtime/server/audit-source.server';
import { createRecordingAuditContinuation } from '@/features/smart-textbook-runtime/server/audit-session.server';
import { AuditRuntimeClient } from '@/features/smart-textbook-runtime/components/audit-client';
import { runtimeReadiness } from '@/features/smart-textbook-runtime/core/block-registry';
import {z} from 'zod';

/** Isolated owner-only, tracking-disabled inspection; no student route import or switch. */
export default async function RuntimeAuditPage({params,searchParams}:{params:Promise<{space:string;appSlug:string}>;searchParams:Promise<{recordingAudit?:string|string[];locale?:string|string[]}>}){
  const {user}=await requirePlatformOwner();
  const {appSlug,space}=await params;
  if(appSlug!=='korean')notFound();
  const data=await readAuditSource(),manifest=data.result.manifest!;
  const query=await searchParams;
  const locale=z.enum(['zh-CN','ko-KR']).parse(query.locale??'zh-CN');
  let sessionId:string;
  try{if(query.recordingAudit&&typeof query.recordingAudit!=='string')throw Error('INVALID_AUDIT');sessionId=createRecordingAuditContinuation(user.id,data,query.recordingAudit,locale);}catch{
    return <main className="p-4"><p role="alert">隔离录音会话已过期、源版本已变化或无权恢复。不会转移其他会话的录音。</p><a href={`/${encodeURIComponent(space)}/dashboard/admin/apps/korean/teaching-scripts/runtime-v1-preview`}>开始新的隔离审计</a></main>;
  }
  const readiness=runtimeReadiness(manifest,data.result.nonUiRuntimeReady);
  return <main className="mx-auto max-w-7xl space-y-4 p-4">
    <h1 className="text-2xl font-bold">第一章 Runtime 组件对照</h1>
    <p>当前为平台负责人检查入口，不保存学生正式作答或学习进度。完整兼容执行器尚未通过验收。</p>
    <a href={`/${encodeURIComponent(space)}/dashboard/admin/apps/korean/teaching-scripts/preview?scriptVersionId=${data.source.teachingVersions[0].id}`}>打开旧教材预览对照</a>
    <p>非 UI 就绪：{readiness.nonUiRuntimeReady?'是':'否'}；章节可执行：{readiness.runtimeReady?'是':'否'}</p>
    <AuditRuntimeClient manifest={manifest} context={{runtimeSessionId:sessionId,snapshotId:manifest.snapshot.id,sourceState:'published',trackingDisabled:true,locale,supportMode:'bilingual'}}
      state={{snapshotId:manifest.snapshot.id,revision:data.result.report.sourceRevision,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]}}/>
  </main>;
}
