import 'server-only';
import { randomUUID } from 'node:crypto';
import type { ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { studentTransportEnabled } from '../transport/transport-config.ts';
import { createStudentRolloutAdmission } from '../transport/rollout-policy.ts';
import { SupabaseStudentTeachingReadRepository } from '../repositories/supabase-student-teaching-repository.ts';
import { projectStudentSelectionPins, type SegmentCandidate } from './selection-projection.ts';
import { StudentAiTeacherIntegration } from '../../components/StudentAiTeacherIntegration';
export type TeachingAgentSlots = Record<string, Partial<Record<'zh-CN' | 'ko-KR', ReactNode>>>;
/** Called by the authenticated lesson Server Component, never by a browser endpoint. */
export async function loadStudentTeachingSlots(input: { supabase: SupabaseClient; actorId: string; tenantId: string;
 lessonId: string; moduleIds?: string[] }): Promise<TeachingAgentSlots | undefined> {
 if (!studentTransportEnabled() || input.moduleIds?.length === 0) return undefined;
 const signal = AbortSignal.timeout(12000), execution = { signal, runId: randomUUID(), deadlineAt: new Date(Date.now()+12000).toISOString() };
 try {
  if (!await createStudentRolloutAdmission(input.supabase, { actorId: input.actorId, tenantId: input.tenantId })(input.lessonId, signal)) return undefined;
  // Legacy lesson readers have no database module model. Discover locators only,
  // after rollout, through the caller's RLS client; the same full Policy still
  // validates every candidate before any published text reaches the browser.
  let moduleIds = input.moduleIds;
  if (!moduleIds) {
   const textbooks = await input.supabase.from('digital_textbooks').select('id').eq('lesson_id',input.lessonId).eq('status','published').limit(2).abortSignal(signal);
   if (textbooks.error || textbooks.data?.length !== 1) return undefined;
   const versions = await input.supabase.from('digital_textbook_versions').select('id').eq('textbook_id',textbooks.data[0].id).eq('status','published').order('version_number',{ascending:false}).limit(1).abortSignal(signal);
   if (versions.error || !versions.data?.length) return undefined;
   const chapters = await input.supabase.from('digital_textbook_chapters').select('id').eq('version_id',versions.data[0].id).eq('status','published').order('chapter_number').limit(16).abortSignal(signal);
   if (chapters.error || !chapters.data?.length) return undefined;
   const modules = await input.supabase.from('digital_textbook_modules').select('id').in('chapter_id',chapters.data.map(c=>c.id)).order('sort_order').limit(16).abortSignal(signal);
   if (modules.error || !modules.data?.length) return undefined;
   moduleIds = modules.data.map(m=>m.id);
  }
  // Candidate IDs only, with user SSR client. Full policy runs before any text/pins leave server.
  const lessons = await input.supabase.from('learning_agent_lessons').select('id,module_id').in('module_id',moduleIds.slice(0,16)).eq('status','published').limit(16).abortSignal(signal);
  if (lessons.error || !lessons.data?.length) return undefined;
  const versions = await input.supabase.from('learning_agent_script_versions').select('id,lesson_id').in('lesson_id',lessons.data.map(r=>r.id)).eq('status','published').limit(32).abortSignal(signal);
  if (versions.error || !versions.data?.length) return undefined;
  const nodes = await input.supabase.from('student_learning_agent_script_nodes').select('id,script_version_id,sort_order').in('script_version_id',versions.data.map(r=>r.id)).order('sort_order').limit(32).abortSignal(signal);
  if (nodes.error || !nodes.data?.length) return undefined;
  const candidates: SegmentCandidate[] = [];
  for (const node of nodes.data) {
   const version=versions.data.find(v=>v.id===node.script_version_id), lesson=lessons.data.find(l=>l.id===version?.lesson_id);
   if (version && lesson) candidates.push({lessonId:input.lessonId,moduleId:lesson.module_id,scriptVersionId:version.id,nodeId:node.id});
  }
  const pins=await projectStudentSelectionPins({candidates,repository:new SupabaseStudentTeachingReadRepository(input.supabase),
   authenticate:async()=>({actorId:input.actorId,tenantId:input.tenantId}),execution});
  const slots: TeachingAgentSlots = {}, pageIdentity=randomUUID();
  for (const moduleId of moduleIds) {
   for(const locale of ['zh-CN','ko-KR'] as const) {
    const available=pins.filter(p=>p.moduleId===moduleId&&p.locale===locale); if(!available.length)continue;
    slots[moduleId] ??= {};
    slots[moduleId][locale]=<StudentAiTeacherIntegration key={`${pageIdentity}:${moduleId}:${locale}`} pins={available} />;
   }
  }
  return Object.keys(slots).length ? slots : undefined;
 } catch { return undefined; } // Optional read capability must not break or widen the classroom.
}

/** Lesson-level published excerpts, not the legacy reader's visual page state. */
export async function loadStudentTeachingLessonSlot(input: {
 supabase: SupabaseClient; actorId: string; tenantId: string; lessonId: string;
}): Promise<ReactNode> {
 const slots = await loadStudentTeachingSlots(input);
 const available = Object.values(slots ?? {}).map(locales=>locales['zh-CN']).filter(Boolean);
 return available.length ? <>{available}</> : undefined;
}
