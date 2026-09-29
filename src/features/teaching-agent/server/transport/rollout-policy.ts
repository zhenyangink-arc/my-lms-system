import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RunOwner } from './run-store.ts';
import { studentTransportEnabled } from './transport-config.ts';
import { withSignal } from '../../../agent-core/runtime/deadline.ts';

type RolloutConfig = {
 enabled?: string; tenants?: string; courses?: string; users?: string;
};
function identifiers(value: string | undefined): Set<string> {
 const parts = value?.trim().split(/[\s,]+/).filter(Boolean) ?? [];
 // Invalid configuration denies the whole list; no wildcards or partial parsing.
 if (parts.length > 256 || parts.some(id => !z.uuid().safeParse(id).success)) return new Set();
 return new Set(parts.map(id => id.toLowerCase()));
}
function configuration(): RolloutConfig {
 return { enabled: process.env.TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED,
  tenants: process.env.TEACHING_AGENT_ALLOWED_TENANTS,
  courses: process.env.TEACHING_AGENT_ALLOWED_COURSES,
  users: process.env.TEACHING_AGENT_ALLOWED_USERS };
}
/** Internal/pilot admission only. All three allowlists are mandatory and server-owned.
 * This narrows eligibility; it never replaces StudentTeachingPolicy or mints authority. */
export class TeachingAgentRolloutPolicy {
 private readonly readConfig: () => RolloutConfig;
 constructor(readConfig: () => RolloutConfig = configuration) { this.readConfig = readConfig; }
 allowsIdentity(owner: RunOwner): boolean {
  const config = this.readConfig();
  return studentTransportEnabled(config.enabled) && identifiers(config.tenants).has(owner.tenantId.toLowerCase())
   && identifiers(config.users).has(owner.actorId.toLowerCase());
 }
 allows(owner: RunOwner, courseId: string): boolean {
  const config = this.readConfig();
  return studentTransportEnabled(config.enabled) && identifiers(config.tenants).has(owner.tenantId.toLowerCase())
   && identifiers(config.users).has(owner.actorId.toLowerCase()) && identifiers(config.courses).has(courseId.toLowerCase());
 }
}
/** Only an authenticated user-scoped client may resolve the lesson's actual course.
 * The browser supplies a lesson locator, never the course/actor/tenant decision. */
export function createStudentRolloutAdmission(client: Pick<SupabaseClient, 'from'>, owner: RunOwner,
 policy = new TeachingAgentRolloutPolicy()) {
 return async (lessonId: string, signal: AbortSignal): Promise<boolean> => {
  if (!policy.allowsIdentity(owner) || !z.uuid().safeParse(lessonId).success) return false;
  const result = await withSignal(Promise.resolve(client.from('lessons').select('id,course_id')
   .eq('id', lessonId).abortSignal(signal).maybeSingle()), signal);
  return !result.error && result.data?.id === lessonId && typeof result.data.course_id === 'string'
   && policy.allows(owner, result.data.course_id);
 };
}
