import 'server-only';
import type { PreviewState } from '../../../lib/learning-agent-preview-state';
import type { TeacherIntent, TeacherTurn } from '../core/teacher';
import type { AuditSession } from './audit-session.server';
import type { auditTtsService, observeAuditTts } from './audit-tts.server';

/** Both backends implement this PRIVATE contract. No backend selector or native
 * persistence identity is serialized to TeacherRuntimeServices. */
export interface TeacherAgentBackend {
  authoredAutoContinue: boolean;
  restore(): Promise<PreviewState>;
  turn(intent:TeacherIntent,answer:string|undefined):Promise<{state:PreviewState;turn:TeacherTurn}>;
  observe(grantId:string):Promise<Awaited<ReturnType<typeof observeAuditTts>>>;
  dispose():Promise<void>;
}
export type TeacherBackendContext={
  session:string; audit:AuditSession; teachingRef:string;
  mount:{stepId:string;generation:number;locale:'zh-CN'|'ko-KR';scopeRef?:string};
  authority:{actorId:string;role:'platform_owner'|'learner';tenantId?:string};
  grantService:()=>ReturnType<typeof auditTtsService>;
};
export type TeacherBackendFactory=(context:TeacherBackendContext)=>Promise<TeacherAgentBackend>;
