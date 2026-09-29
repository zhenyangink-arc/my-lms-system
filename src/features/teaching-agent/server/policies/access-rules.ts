import 'server-only';
import { canUseStudentFeature, normalizeMembershipTier } from '../../../../lib/student-permissions.ts';

export function validEnrollment(row: { status: unknown; starts_at: unknown; ends_at: unknown }, now: number): boolean {
  const start = row.starts_at === null ? -Infinity : typeof row.starts_at === 'string' ? Date.parse(row.starts_at) : NaN;
  const end = row.ends_at === null ? Infinity : typeof row.ends_at === 'string' ? Date.parse(row.ends_at) : NaN;
  return row.status === 'active' && start <= now && end > now;
}
export function visibleInTenant(row: { content_scope?: unknown; tenant_id?: unknown }, tenantId: string): boolean {
  return row.content_scope === 'platform' ? row.tenant_id === null
    : row.content_scope === 'tenant' && row.tenant_id === tenantId;
}
/** MVP does not query grades to infer prerequisite completion. Unsupported rules deny. */
export function independentlyUnlocked(row: Record<string, unknown>, now: number): boolean {
  if (row.is_manually_locked !== false) return false;
  if (row.unlock_mode === 'immediate' || row.unlock_mode === 'manual') return true;
  return row.unlock_mode === 'scheduled' && typeof row.available_from === 'string'
    && Date.parse(row.available_from) <= now;
}
export function studentTeachingFeatureAllowed(tier: unknown, feature: unknown): boolean {
  // Deliberately limited to the audited Korean Student MVP, not every future profile.
  return feature === 'korean_course' && typeof tier === 'string'
    && canUseStudentFeature('student', normalizeMembershipTier(tier), 'korean_course');
}
