import 'server-only';
import { z } from 'zod';
import { createRuntimeTeacherSessions, type TeacherAuthority } from './teacher-session.server';
import type { AuditSource } from './audit-source.server';

const ref = z.string().regex(/^teacher-session-[0-9a-f-]{36}$/);
export const teacherBoundaryRequest = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('open'), scope: z.string().regex(/^learning-session-[0-9a-f-]{36}$/) }),
  z.strictObject({ operation: z.enum(['current','advance','cancel','pause','resume','close','issueTts']), session: ref }),
  z.strictObject({ operation: z.literal('answer'), session: ref, answer: z.string().min(1).max(300) }),
  z.strictObject({ operation: z.literal('observeTts'), session: ref, grantId: z.string().uuid() }),
  z.strictObject({ operation: z.enum(['speech','buffer','character']), session: ref, cue: z.string().regex(/^teacher-cue-[0-9a-f-]{36}$/) }),
]);
export type TeacherScope = { data: AuditSource; generation: number; stepId: string; locale: 'zh-CN' | 'ko-KR'; expiresAt: number;
  authority?:{actorId:string;tenantId:string}; };

/** One protocol for mounted Teacher. Scope is an existing authorized learning
 * session; the browser never chooses a database identity or server generation. */
export function createTeacherRuntimeBoundary(options: {
  authorize: () => Promise<TeacherAuthority>; resolveScope: (scope: string) => Promise<TeacherScope>;
  readSpeech: Parameters<typeof createRuntimeTeacherSessions>[0]['readSpeech'];
  readCharacter: NonNullable<Parameters<typeof createRuntimeTeacherSessions>[0]['readCharacter']>;
  createBackend?:Parameters<typeof createRuntimeTeacherSessions>[0]['createBackend'];
}) {
  const sessions = createRuntimeTeacherSessions(options);
  const bindings = new Map<string, { scope: string; owner: string; snapshot: string; source: string; revision: string; step: string; generation: number; expiresAt: number }>();
  const opening = new Set<string>();
  const checkScopeAuthority=(scope:TeacherScope,authority:TeacherAuthority)=>{
    if(options.createBackend&&(scope.authority?.actorId!==authority.actorId||scope.authority?.tenantId!==authority.tenantId))throw Error('TEACHER_LEARNING_SCOPE_AUTHORITY');
  };
  return {
    async dispatch(input: unknown) {
      const r = teacherBoundaryRequest.parse(input), authority = await options.authorize();
      if (!authority.actorId || (authority.role!=='platform_owner'&&!(options.createBackend&&authority.role==='learner'&&authority.tenantId))) throw Error('TEACHER_AUTHORITY');
      if (r.operation === 'open') {
        const lockKey=`${authority.tenantId??'audit'}:${authority.actorId}:${r.scope}`;
        if(opening.has(lockKey))throw Error('TEACHER_OPEN_BUSY');
        opening.add(lockKey);
        try {
        for (const [id,b] of bindings) if (b.expiresAt <= Date.now()) bindings.delete(id);
        const s = await options.resolveScope(r.scope);
        checkScopeAuthority(s,authority);
        if (s.expiresAt <= Date.now()) throw Error('TEACHER_SCOPE_EXPIRED');
        // Reload replaces only the opaque presentation owner. Drain a previous
        // persisted turn before restoring the SAME native Agent state.
        for(const [id,b] of bindings)if(b.scope===r.scope&&b.owner===authority.actorId){await sessions.request({session:id,operation:'close'});bindings.delete(id);}
        const opened = await sessions.open(s.data, { stepId: s.stepId, generation: s.generation, locale: s.locale,scopeRef:r.scope });
        try {
          const latest=await options.resolveScope(r.scope);
          checkScopeAuthority(latest,authority);
          if(latest.expiresAt<=Date.now()||latest.stepId!==s.stepId||latest.generation!==s.generation||
            latest.data.result.manifest.snapshot.id!==s.data.result.manifest.snapshot.id||
            latest.data.result.report.sourceRevision!==s.data.result.report.sourceRevision||
            latest.data.result.manifest.teachingRefs[0].revision!==s.data.result.manifest.teachingRefs[0].revision)throw Error('TEACHER_STALE_OPEN');
        } catch(error) { await sessions.request({session:opened.session,operation:'close'});throw error; }
        bindings.set(opened.session, { scope: r.scope, owner: authority.actorId, snapshot: s.data.result.manifest.snapshot.id,
          source: s.data.result.report.sourceRevision, revision: s.data.result.manifest.teachingRefs[0].revision,
          step: s.stepId, generation: s.generation, expiresAt: Math.min(opened.expiresAt, s.expiresAt) });
        return { session: opened.session }; // no snapshot/version/cue DB identity
        } finally { opening.delete(lockKey); }
      }
      const b = bindings.get(r.session);
      if (!b || b.owner !== authority.actorId || b.expiresAt <= Date.now()) throw Error('TEACHER_SESSION_SCOPE');
      if (r.operation === 'cancel' || r.operation === 'close') {
        bindings.delete(r.session); return sessions.request(r);
      }
      const s = await options.resolveScope(b.scope);
      checkScopeAuthority(s,authority);
      if (s.expiresAt <= Date.now() || s.stepId !== b.step || s.generation !== b.generation || s.data.result.manifest.snapshot.id !== b.snapshot ||
        s.data.result.report.sourceRevision !== b.source || s.data.result.manifest.teachingRefs[0].revision !== b.revision) {
        await sessions.request({ session: r.session, operation: 'cancel' }); bindings.delete(r.session); throw Error('TEACHER_STALE_MOUNT');
      }
      const operation = r.operation === 'issueTts' ? 'issue-tts' : r.operation === 'observeTts' ? 'observe-tts' : r.operation;
      const request = r.operation === 'advance' ? { session:r.session, operation:'turn', intent:'ready' } :
        r.operation === 'answer' ? { session:r.session, operation:'turn', intent:'answer', answer:r.answer } :
        r.operation === 'speech' || r.operation === 'buffer' ? { session:r.session, operation:'speech', cue:r.cue, kind:r.operation } : { ...r, operation };
      const result = await sessions.request(request);
      const latest = await options.resolveScope(b.scope);
      checkScopeAuthority(latest,authority);
      if (latest.expiresAt <= Date.now() || latest.generation !== b.generation || latest.stepId !== b.step || latest.data.result.manifest.snapshot.id !== b.snapshot ||
        latest.data.result.report.sourceRevision !== b.source || latest.data.result.manifest.teachingRefs[0].revision !== b.revision) {
        await sessions.request({session:r.session,operation:'cancel'}); bindings.delete(r.session); throw Error('TEACHER_STALE_RESPONSE');
      }
      return result;
    },
  };
}
