import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auditTeacherTurn } from './audit-teacher.server';
import { auditTtsOwner, auditTtsService, observeAuditTts } from './audit-tts.server';
import type { AuditSession } from './audit-session.server';
import type { AuditSource } from './audit-source.server';
import type { TeacherTurn } from '../core/teacher';
import type { TeacherRuntimeCue } from '../core/teacher-runtime';
import { projectTeacherCue } from './teacher-cue.server';
import type { TeacherAgentBackend, TeacherBackendFactory } from './teacher-backend.server';

const reference = z.string().regex(/^teacher-session-[0-9a-f-]{36}$/);
const cueReference = z.string().regex(/^teacher-cue-[0-9a-f-]{36}$/);
export const teacherSessionRequest = z.discriminatedUnion('operation', [
  z.strictObject({ session: reference, operation: z.literal('turn'), intent: z.enum(['start', 'ready', 'hint', 'example', 'answer']), answer: z.string().min(1).max(1000).optional() }),
  z.strictObject({ session: reference, operation: z.literal('cancel') }),
  z.strictObject({ session: reference, operation: z.enum(['current', 'pause', 'resume', 'close']) }),
  z.strictObject({ session: reference, operation: z.literal('issue-tts') }),
  z.strictObject({ session: reference, operation: z.literal('observe-tts'), grantId: z.string().uuid() }),
  z.strictObject({ session: reference, operation: z.literal('speech'), cue: cueReference, kind: z.enum(['speech', 'buffer']) }),
  z.strictObject({ session: reference, operation: z.literal('character'), cue: cueReference }),
]);

/** Deliberately no DB node/asset/version identifiers, raw resolver state, or
 * writable completion fields. A cue is an ephemeral handle, NOT a mediaRef. */
export type RuntimeTeacherCue = TeacherRuntimeCue;
export type TeacherAuthority = { actorId: string; role: 'platform_owner'|'learner'; tenantId?:string };
type Row = {
  audit: AuditSession; stepId: string; teachingRef: string; snapshot: string;
  sourceRevision: string; revision: string; locale: 'zh-CN' | 'ko-KR';
  allowedTargets: ReadonlySet<string>; abort: AbortController; cue: string | null;
  presentation?: Awaited<ReturnType<typeof projectTeacherCue>>; paused: boolean;
  backend?:TeacherAgentBackend;
};

/** Bounded ephemeral presentation/session boundary; NOT another Agent resolver.
 * Trusted composition selects audit or existing production Agent persistence.
 * Each browser operation reauthorizes; backend owns restore/turn/event semantics.
 * No student Route installs the production composition in Phase 4A. */
export function createRuntimeTeacherSessions(options: {
  authorize: () => Promise<TeacherAuthority>;
  readSpeech: (selection: { data: AuditSource; assetId: string; locale: 'zh-CN' | 'ko-KR'; signal: AbortSignal }) => Promise<Blob>;
  readCharacter?: (pose: NonNullable<TeacherTurn['character']>['pose'], signal: AbortSignal) => Promise<Blob>;
  now?: () => number; ttlMs?: number; capacity?: number;
  createBackend?:TeacherBackendFactory;
}) {
  const now = options.now ?? Date.now, ttl = options.ttlMs ?? 30 * 60_000, capacity = options.capacity ?? 32;
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 30 * 60_000 || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 32) throw Error('TEACHER_SESSION_LIMITS');
  const rows = new Map<string, Row>();
  const authority = async () => {
    const a = await options.authorize();
    if (!a?.actorId || (a.role !== 'platform_owner' && !(options.createBackend&&a.role==='learner'&&a.tenantId))) throw Error('TEACHER_AUTHORITY');
    return a;
  };
  const revoke = (id: string, row: Row) => {
    row.abort.abort();
    row.audit.revokedThrough = row.audit.generation;
    row.audit.tts?.revokeSession({ actorId: row.audit.ownerId, tenantId: row.audit.authorityTenantId??`owner-audit:${row.audit.ownerId}` }, id);
    rows.delete(id);
  };
  const assertActive = (id: string, row: Row) => {
    if (rows.get(id) !== row || row.abort.signal.aborted || now() >= row.audit.expiresAt) throw Error('TEACHER_SESSION_EXPIRED_OR_REVOKED');
    const data = row.audit.data;
    if (data.result.manifest.snapshot.id !== row.snapshot || data.result.report.sourceRevision !== row.sourceRevision ||
      row.audit.state.scriptVersionId !== row.revision) throw Error('TEACHER_REVISION');
  };
  const project = (row: Row): RuntimeTeacherCue => {
    const t = row.audit.lastTurn;
    if (!t || !row.cue || !row.presentation) throw Error('TEACHER_NO_CUE');
    return { ...structuredClone(row.presentation.presentation), cue: row.cue,
      task: t.task ? { source: `${row.audit.state.currentNodeKey}:studentTask`, target: t.task.target, instruction: t.task.instruction, playbackAvailable: !!auditTtsOwner(row.audit) } : null,
    };
  };
  return {
    /** Trusted composition supplies step/generation, never the browser. Reload
     * creates fresh opaque handles/grants; the backend either starts isolated
     * audit state or restores the existing persisted Agent state. */
    async open(data: AuditSource, mount: { stepId: string; generation: number; locale: 'zh-CN' | 'ko-KR';scopeRef?:string }) {
      const a = await authority();
      for (const [id, row] of rows) if (now() >= row.audit.expiresAt) {revoke(id, row);await row.backend?.dispose();}
      if (rows.size >= capacity) throw Error('TEACHER_SESSION_CAPACITY');
      if (!Number.isSafeInteger(mount.generation) || mount.generation < 0 || !['zh-CN', 'ko-KR'].includes(mount.locale)) throw Error('TEACHER_MOUNT');
      const m = data.result.manifest;
      const blocks = m.blocks.filter(b => b.type === 'compat.teacher.v1' && b.stepId === mount.stepId);
      if (blocks.length !== 1 || blocks[0].type !== 'compat.teacher.v1') throw Error('TEACHER_STEP_SCOPE');
      const teachingRef = blocks[0].props.teachingRef;
      const binding = data.result.bindings.teaching.find(t => t.ref === teachingRef);
      const publicRef = m.teachingRefs.find(t => t.id === teachingRef);
      if (!data.result.nonUiRuntimeReady || !binding || !publicRef || binding.scriptVersionId !== publicRef.revision) throw Error('TEACHER_BINDING');
      const id = `teacher-session-${randomUUID()}`;
      const row: Row = { audit: { ownerId: a.actorId, authorityTenantId:a.tenantId, expiresAt: now() + ttl, data, generation: mount.generation, revokedThrough: -1, busy: false,
        state: { scriptVersionId: binding.scriptVersionId, currentNodeKey: null, teachingState: {}, completedTaskEvents: [] } },
        stepId: mount.stepId, teachingRef, snapshot: m.snapshot.id, sourceRevision: data.result.report.sourceRevision,
        revision: binding.scriptVersionId, locale: mount.locale, cue: null, paused: false, abort: new AbortController(),
        allowedTargets: new Set(m.runtimeTargets.filter(t => t.stepId === mount.stepId).map(t => t.id)) };
      row.backend=options.createBackend?await options.createBackend({session:id,audit:row.audit,teachingRef,mount,authority:a,grantService:()=>auditTtsService(row.audit,id)}):{
        authoredAutoContinue:true,restore:async()=>row.audit.state,
        turn:(intent,answer)=>auditTeacherTurn(data,row.audit.state,teachingRef,intent,answer,mount.locale),
        observe:grantId=>observeAuditTts(row.audit,id,grantId),dispose:async()=>{},
      };
      try {
        row.audit.state=await row.backend.restore();
        if(row.audit.state.scriptVersionId!==row.revision)throw Error('TEACHER_RESTORE_REVISION');
      } catch(error) { row.abort.abort();await row.backend.dispose();throw error; }
      rows.set(id, row);
      return { session: id, expiresAt: row.audit.expiresAt };
    },
    async request(input: unknown): Promise<RuntimeTeacherCue | Blob | { cancelled: true } | { paused: boolean } |
      Awaited<ReturnType<ReturnType<typeof auditTtsService>['issue']>> | Awaited<ReturnType<typeof observeAuditTts>>> {
      const request = teacherSessionRequest.parse(input), a = await authority(), row = rows.get(request.session);
      if (!row || row.audit.ownerId !== a.actorId || row.audit.authorityTenantId!==a.tenantId) throw Error('TEACHER_SESSION_OWNER');
      // Cancellation may invalidate a pending async resolver/byte request; all
      // continuations recheck the exact server row before returning or committing.
      if (request.operation === 'cancel' || request.operation === 'close') { revoke(request.session, row);await row.backend?.dispose(); return { cancelled: true }; }
      assertActive(request.session, row);
      if (request.operation === 'pause' || request.operation === 'resume') { row.paused = request.operation === 'pause'; return { paused: row.paused }; }
      if (request.operation === 'current' && row.audit.lastTurn) return project(row);
      if (row.paused) throw Error('TEACHER_PAUSED');
      if (row.audit.busy) throw Error('TEACHER_SESSION_BUSY');
      row.audit.busy = true;
      try {
        if (request.operation === 'turn' || request.operation === 'current') {
          const intent = request.operation === 'turn' ? request.intent : 'start';
          const answer = request.operation === 'turn' ? request.answer : undefined;
          if (intent === 'answer' ? !row.audit.lastTurn?.awaitingAnswer || !row.audit.lastTurn.questionOptions.includes(answer ?? '') : answer !== undefined) throw Error('TEACHER_ANSWER_SCOPE');
          if (row.audit.lastTurn?.terminal) return project(row);
          const result = row.backend?await row.backend.turn(intent,answer):await auditTeacherTurn(row.audit.data, row.audit.state, row.teachingRef, intent, answer, row.locale);
          const presentation = await projectTeacherCue(row.audit.data, row.audit.state, result.state, result.turn, intent, row.locale);
          if(row.backend&&!row.backend.authoredAutoContinue)presentation.presentation.autoContinue=false;
          assertActive(request.session, row);
          // Only the existing projection's explicit pending-grant diagnostic is
          // resolved by this boundary. Never silently discard other omissions.
          if (result.turn.unsupported.some(reason => !reason.startsWith('播放任务仍需挂载'))) throw Error('TEACHER_UNSUPPORTED_CUE');
          for (const target of [result.turn.task?.target, result.turn.visualTarget, ...presentation.presentation.commands.map(c => c.target)]) if (target && !row.allowedTargets.has(target)) throw Error('TEACHER_TARGET_STEP_SCOPE');
          row.audit.state = result.state; row.audit.lastTurn = result.turn; row.presentation = presentation; row.cue = `teacher-cue-${randomUUID()}`;
          return project(row);
        }
        if (request.operation === 'issue-tts') {
          const grant = await auditTtsService(row.audit, request.session).issue({ actorId: a.actorId, tenantId: a.tenantId??`owner-audit:${a.actorId}` }, { sessionId: request.session });
          assertActive(request.session, row); return grant;
        }
        if (request.operation === 'observe-tts') {
          const observation = row.backend?await row.backend.observe(request.grantId):await observeAuditTts(row.audit, request.session, request.grantId);
          assertActive(request.session, row); return observation;
        }
        if (request.operation !== 'character' && request.operation !== 'speech') throw Error('TEACHER_OPERATION');
        if (request.cue !== row.cue || !row.audit.lastTurn) throw Error('TEACHER_CUE_SCOPE');
        if (request.operation === 'character') {
          const pose = row.audit.lastTurn.character?.pose;
          if (!pose || !options.readCharacter) throw Error('TEACHER_CHARACTER_UNAVAILABLE');
          const blob = await options.readCharacter(pose, row.abort.signal); assertActive(request.session, row);
          if (!blob.size || !['image/png','image/webp','image/jpeg'].includes(blob.type)) throw Error('TEACHER_CHARACTER_BYTES');
          return blob;
        }
        const assetId = request.kind === 'speech' ? row.audit.lastTurn.speechAssetId : row.presentation?.bufferAssetId;
        if (!assetId) throw Error('TEACHER_NO_AUTHORIZED_SPEECH');
        // This is an opaque-cue authorization boundary, NOT a replacement for
        // the existing speech Route's ownership/revision/status/byte checks.
        const blob = await options.readSpeech({ data: row.audit.data, assetId, locale: row.locale, signal: row.abort.signal });
        assertActive(request.session, row);
        if (!blob.size || !blob.type.startsWith('audio/')) throw Error('TEACHER_INVALID_AUDIO_BYTES');
        return blob;
      } finally { row.audit.busy = false; }
    },
  };
}
