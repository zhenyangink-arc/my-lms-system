import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

const coordinate = z.object({ id: z.uuid(), created_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/) });
type Cursor = z.infer<typeof coordinate>;
// Preserve PostgreSQL microseconds, rather than rounding to JavaScript milliseconds.
function key(c: Cursor) {
  const [whole, fraction = ''] = c.created_at.replace(/(?:Z|\+00:00)$/, '').split('.');
  return `${whole}.${fraction.padEnd(6, '0')}/${c.id}`;
}
function boundary(c: Cursor, direction: 'after' | 'through') {
  const op = direction === 'after' ? 'gt' : 'lt';
  const idOp = direction === 'after' ? 'gt' : 'lte';
  // Both values have been parsed, so no PostgREST filter syntax can be injected.
  return `created_at.${op}.${c.created_at},and(created_at.eq.${c.created_at},id.${idOp}.${c.id})`;
}

/** A bounded keyset scan of append-only attempts, fenced at its initial maximum
 * (created_at,id). Later inserts above that fence are restored on next refresh.
 * Fenced counts before/after reject late commits below the cursor, including a
 * transaction whose now() predates this scan. This is NOT an MVCC snapshot for
 * privileged updates/deletes; the domain's immutable attempt rows are required. */
export async function readAttemptHistory(input: {
  db: SupabaseClient; tenantId: string; actorId: string; versionId: string;
  activityIds: string[]; signal: AbortSignal; pageSize?: number; totalCap?: number;
}): Promise<unknown[]> {
  const pageSize = input.pageSize ?? 250, totalCap = input.totalCap ?? 20000;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000 || !Number.isInteger(totalCap) || totalCap < pageSize) throw Error('HISTORY_PAGINATION_LIMIT');
  const query = (columns: string, countOnly = false) => input.db.from('digital_textbook_attempts').select(columns, countOnly ? { count: 'exact', head: true } : undefined)
    .eq('tenant_id', input.tenantId).eq('student_id', input.actorId)
    .eq('version_id', input.versionId).in('activity_id', input.activityIds).abortSignal(input.signal);
  input.signal.throwIfAborted();
  const head = await query('id,created_at').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1);
  if (head.error) throw Error('HISTORY_READ_UNAVAILABLE');
  if (!head.data?.length) return [];
  const ceiling = coordinate.parse(head.data[0]);
  const count = async () => {
    const result = await query('id', true).or(boundary(ceiling, 'through'));
    input.signal.throwIfAborted();
    if (result.error || result.count === null || !Number.isInteger(result.count) || result.count < 0) throw Error('HISTORY_COUNT_UNAVAILABLE');
    if (result.count > totalCap) throw Error('HISTORY_TOTAL_CAP_EXCEEDED');
    return result.count;
  };
  const expectedCount = await count();
  let cursor: Cursor | undefined;
  const rows: unknown[] = [], seen = new Set<string>();
  while (true) {
    input.signal.throwIfAborted();
    let page = query('id,activity_id,response,attempt_number,is_correct,score,meets_completion_requirements,created_at')
      .or(boundary(ceiling, 'through')).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(pageSize);
    if (cursor) page = page.or(boundary(cursor, 'after'));
    const result = await page;
    input.signal.throwIfAborted();
    if (result.error || !result.data || result.data.length > pageSize) throw Error('HISTORY_READ_UNAVAILABLE');
    for (const row of result.data) {
      const next = coordinate.parse(row);
      if (seen.has(next.id)) throw Error('HISTORY_DUPLICATE_ATTEMPT');
      if ((cursor && key(next) <= key(cursor)) || key(next) > key(ceiling)) throw Error('HISTORY_CURSOR_ORDER');
      seen.add(next.id); cursor = next; rows.push(row);
      if (rows.length > totalCap) throw Error('HISTORY_TOTAL_CAP_EXCEEDED');
    }
    if (result.data.length < pageSize) {
      if (rows.length !== expectedCount || await count() !== expectedCount) throw Error('HISTORY_CHANGED_DURING_SCAN');
      return rows;
    }
  }
}
