import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { checkR2ObjectExists, createR2SignedObjectUrl, createR2SignedUploadUrl, deleteR2Object } from '@/lib/r2';
import { beforeRecordingWrite, EnvironmentRecordingProofKeyProvider, RecordingDomainError, supabaseRecordingRpc,
  type RecordingDomainRequest } from './recording-domain.server';
import { decodeRecordingEvidence, deleteRecordingV2, recordingDigest, runtimeRecordingMetadata,
  consumeSpeakingV2, completeRoleplayV2, type RecordingScope, type RecordingEvidenceRow, type ProofServices } from './recording-evidence-v2.server';

const bucket = 'digital-textbook-student-recordings';
export const RECORDING_EVIDENCE_FIELDS = 'id,tenant_id,student_id,activity_id,object_key,byte_size,mime_type,created_at,consumed_at,consumed_attempt_number,metadata';
const object = (v: unknown): { [key: string]: any } => v && typeof v === 'object' && !Array.isArray(v) ? v : {};

/** Trusted visible activity must be resolved by the caller using the user client. */
export async function recordingActivityBinding(admin: SupabaseClient, activityId: string) {
  const { data: a, error: ae } = await admin.from('digital_textbook_activities').select('id,node_id,activity_type,public_config').eq('id', activityId).single();
  if (ae || !a || a.activity_type !== 'speaking') throw new RecordingDomainError('invalid');
  const { data: n, error: ne } = await admin.from('digital_textbook_nodes')
    .select('id,content,digital_textbook_modules!inner(digital_textbook_chapters!inner(version_id))').eq('id', a.node_id).single();
  const versionId = object(object(n?.digital_textbook_modules).digital_textbook_chapters).version_id;
  if (ne || !n || !z.string().uuid().safeParse(versionId).success) throw new RecordingDomainError('invalid');
  return { activity: a, node: n, versionId: versionId as string,
    sourceRevision: recordingDigest({ versionId, activityId, config: a.public_config, content: n.content }) };
}
export type RecordingActivityBinding = Awaited<ReturnType<typeof recordingActivityBinding>>;
export function createRecordingGateway(admin: SupabaseClient, request: RecordingDomainRequest, binding: RecordingActivityBinding,
  runtime?: {snapshot:string;sourceRevision:string;activityRef:string}) {
  const { activity, versionId, sourceRevision } = binding;
  const ownerQuery = () => admin.from('digital_textbook_speaking_evidence').select(RECORDING_EVIDENCE_FIELDS)
    .eq('tenant_id', request.owner.tenantId).eq('student_id', request.owner.studentId).eq('activity_id', activity.id);
  const scopeFor = (row: RecordingEvidenceRow): RecordingScope => {
    const decoded = decodeRecordingEvidence(row);
    if (row.tenant_id !== request.owner.tenantId || row.student_id !== request.owner.studentId || row.activity_id !== activity.id)
      throw new RecordingDomainError('conflict');
    const expected = { snapshot: runtime?.snapshot ?? `recording-domain:${versionId}`, sourceRevision:runtime?.sourceRevision ?? sourceRevision, versionId,
      activityRef: runtime?.activityRef ?? activity.id, recordingKind: decoded.kind };
    if(runtime&&!row.metadata.runtimeBinding)throw new RecordingDomainError('conflict');
    if (row.metadata.runtimeBinding && recordingDigest(row.metadata.runtimeBinding) !== recordingDigest(expected))
      throw new RecordingDomainError('conflict');
    return { ...request.owner, activityId: activity.id, versionId, runtimeBinding: row.metadata.runtimeBinding ? expected : null };
  };
  const read = async (id: string) => {
    if (!z.string().uuid().safeParse(id).success) throw new RecordingDomainError('invalid');
    const { data, error } = await ownerQuery().eq('id', id).maybeSingle();
    if (error || !data) throw new RecordingDomainError('unavailable');
    const { row } = decodeRecordingEvidence(data);
    if (row.tenant_id !== request.owner.tenantId || row.student_id !== request.owner.studentId || row.activity_id !== activity.id)
      throw new RecordingDomainError('conflict');
    return row;
  };
  const headLegacy: ProofServices['headLegacy'] = async key => {
    const slash = key.lastIndexOf('/'), name = key.slice(slash + 1);
    const { data, error } = await admin.storage.from(bucket).list(key.slice(0, slash), { search: name, limit: 2 });
    const found = data?.find(o => o.name === name);
    if (error) throw new RecordingDomainError('unavailable');
    return { exists: Boolean(found), size: Number(found?.metadata?.size),
      contentType: found?.metadata?.mimetype ?? found?.metadata?.contentType };
  };
  const proofs = async (): Promise<ProofServices> => ({ ...await new EnvironmentRecordingProofKeyProvider().get(), headLegacy });
  const rpc: ReturnType<typeof supabaseRecordingRpc> = async (name, args) => {
    if (typeof args.p_evidence_id === 'string') await request.uploadState('assert-settled', args.p_evidence_id);
    if (Array.isArray(args.p_evidence_proofs)) for (const proof of args.p_evidence_proofs) {
      await request.uploadState('assert-settled', String(object(proof).evidenceId));
    }
    await request.beforeWrite(); return supabaseRecordingRpc(admin)(name, args);
  };
  const remove = async (id: string) => {
    const row = await read(id);
    return deleteRecordingV2(rpc, scopeFor(row), id, {
      r2: async key => { await request.beforeWrite(); await deleteR2Object(key); },
      legacy: async key => { await request.beforeWrite(); const { error } = await admin.storage.from(bucket).remove([key]); if (error) throw new RecordingDomainError('unavailable'); },
    });
  };
  const consumable = async (row: RecordingEvidenceRow) => {
    const { backend } = decodeRecordingEvidence(row); scopeFor(row);
    if (row.consumed_at || row.consumed_attempt_number !== null) throw new RecordingDomainError('consumed');
    if ((row.metadata.lifecycle ?? 'active') !== 'active') throw new RecordingDomainError('pending');
    if (Date.now() - Date.parse(row.created_at) > 86400000 || Date.parse(row.created_at) > Date.now()) throw new RecordingDomainError('invalid');
    const head = await (backend === 'r2' ? checkR2ObjectExists : headLegacy)(row.object_key);
    if (!head.exists || head.size !== row.byte_size || head.contentType?.split(';', 1)[0] !== row.mime_type) throw new RecordingDomainError('proof-invalid');
  };
  const completedRoleplay = async () => {
    if(runtime){
      const {data:rows,error}=await ownerQuery().contains('metadata',{runtimeBinding:{...runtime,versionId,recordingKind:'roleplay-turn'}});
      if(error)throw new RecordingDomainError('unavailable');
      if(!rows?.some(r=>r.consumed_at&&r.consumed_attempt_number!==null))return null;
    }
    const { data: attempt, error } = await admin.from('digital_textbook_attempts').select('attempt_number')
      .eq('tenant_id', request.owner.tenantId).eq('student_id', request.owner.studentId).eq('activity_id', activity.id)
      .eq('version_id', versionId).eq('meets_completion_requirements', true).order('attempt_number', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new RecordingDomainError('unavailable');
    if (!attempt) return null;
    const { data: progress, error: pe } = await admin.from('digital_textbook_node_progress').select('status,completion_percent')
      .eq('tenant_id', request.owner.tenantId).eq('student_id', request.owner.studentId).eq('node_id', activity.node_id).eq('version_id', versionId).maybeSingle();
    if (pe) throw new RecordingDomainError('unavailable');
    return { attempt_number: attempt.attempt_number, node_completed: progress?.status === 'completed',
      completion_percent: progress?.completion_percent ?? 0, already_completed: true };
  };
  return {
    read, remove, consumable,
    async speak(response: unknown, trustedActivity: { answerKey: unknown; publicConfig: unknown }, qualified: boolean) {
      const r = z.object({ recorded: z.literal(true), durationSeconds: z.number().positive(), turns: z.number().int().nonnegative().optional(),
        criteria: z.array(z.boolean()).optional(), recordingEvidenceId: z.string().uuid() }).strict().parse(response);
      const row = await read(r.recordingEvidenceId);
      if (qualified) return consumeSpeakingV2(rpc, scopeFor(row), row, response, trustedActivity, await proofs());
      await consumable(row);
      await request.uploadState('assert-settled', row.id);
      // Preserve original failed-checklist attempt: unscored, not completion,
      // not consumed. It still holds the same domain/epoch lease.
      return rpc('record_smart_textbook_attempt', { p_tenant_id: request.owner.tenantId, p_student_id: request.owner.studentId,
        p_activity_id: activity.id, p_version_id: versionId, p_response: r, p_is_correct: null, p_score: null, p_meets_completion_requirements: false });
    },
    async roleplay(sceneId: string, roleSide: 'left' | 'right') {
      const existing = await completedRoleplay(); if (existing) return existing;
      const scene = object(binding.node.content).dialogueScenes?.find((s: unknown) => object(s).id === sceneId);
      if (!scene || !Array.isArray(scene.lines)) throw new RecordingDomainError('invalid');
      let query=ownerQuery().contains('metadata', { sceneId, roleSide }).is('consumed_at', null);
      if(runtime)query=query.contains('metadata',{runtimeBinding:{...runtime,versionId,recordingKind:'roleplay-turn'}});
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error || !data) throw new RecordingDomainError('unavailable');
      const turns = new Set<number>();
      const rows = data.map(d => decodeRecordingEvidence(d).row).filter(row => {
        const m = row.metadata; if (!('turnIndex' in m) || (m.lifecycle ?? 'active') !== 'active' || turns.has(m.turnIndex)) return false;
        turns.add(m.turnIndex); return true;
      });
      if (!rows.length) throw new RecordingDomainError('invalid');
      const scope = scopeFor(rows[0]); rows.forEach(row => {
        if (recordingDigest(scopeFor(row).runtimeBinding) !== recordingDigest(scope.runtimeBinding)) throw new RecordingDomainError('conflict');
      });
      try { return await completeRoleplayV2(rpc, scope, rows, scene, roleSide, await proofs()); }
      catch (e) {
        if (e instanceof RecordingDomainError && e.code === 'duplicate') {
          const completed = await completedRoleplay(); if (completed) return completed;
        }
        throw e;
      }
    },
    async restore(query: URLSearchParams) {
      let q = ownerQuery();
      const practiceKey = query.get('practiceKey'), sceneId = query.get('sceneId');
      if (practiceKey) {
        const coords = z.object({ practiceKey: z.enum(['repeat-line','full-recall']), trackIndex: z.number().int().min(0).max(8), segmentIndex: z.number().int().min(0).max(100) })
          .parse({ practiceKey, trackIndex: Number(query.get('trackIndex')), segmentIndex: Number(query.get('segmentIndex')) });
        q = q.contains('metadata', coords);
      } else if (sceneId) {
        const coords = z.object({ sceneId: z.string().min(1).max(80), roleSide: z.enum(['left','right']), turnIndex: z.number().int().min(0).max(999) })
          .parse({ sceneId, roleSide: query.get('roleSide'), turnIndex: Number(query.get('turnIndex')) });
        q = q.contains('metadata', coords);
      } else if (activity.public_config?.presentation !== 'independent_output') throw new RecordingDomainError('invalid');
      else if(runtime)q=q.is('metadata->>practiceKey',null).is('metadata->>sceneId',null);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new RecordingDomainError('unavailable');
      if (!data) return null;
      const row = decodeRecordingEvidence(data).row;
      await request.uploadState('assert-settled', row.id);
      if (row.metadata.lifecycle === 'delete-pending') return null;
      return { evidenceId: row.id, byteSize: row.byte_size, mimeType: row.mime_type,
        playbackUrl: `/api/digital-textbook/recordings/${activity.id}?evidenceId=${row.id}` };
    },
    async playback(id: string, original: Request) {
      const row = await read(id), { backend } = decodeRecordingEvidence(row);
      await request.uploadState('assert-settled', id);
      if (row.metadata.lifecycle === 'delete-pending') throw new RecordingDomainError('pending');
      let url: string;
      if (backend === 'r2') url = await createR2SignedObjectUrl(row.object_key);
      else { const { data, error } = await admin.storage.from(bucket).createSignedUrl(row.object_key, 60);
        if (error || !data) throw new RecordingDomainError('unavailable'); url = data.signedUrl; }
      const upstream = await fetch(url, { cache: 'no-store', signal: original.signal,
        headers: original.headers.has('range') ? { Range: original.headers.get('range')! } : undefined });
      if (!upstream.ok) throw new RecordingDomainError('unavailable');
      const headers = new Headers({ 'Cache-Control': 'private, no-store', 'Cross-Origin-Resource-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff', 'Content-Type': row.mime_type });
      for (const name of ['content-length','content-range','accept-ranges']) { const value = upstream.headers.get(name); if (value) headers.set(name, value); }
      return new Response(upstream.body, { status: upstream.status, headers });
    },
    async upload(form: FormData) {
      const allowed = new Set(['recording','durationSeconds','sceneId','roleSide','turnIndex','transcript','practiceKey','trackIndex','segmentIndex']);
      for (const key of form.keys()) if (!allowed.has(key) || form.getAll(key).length !== 1) throw new RecordingDomainError('invalid');
      const file = form.get('recording'); if (!(file instanceof File)) throw new RecordingDomainError('invalid');
      const mime = z.enum(['audio/webm','audio/ogg','audio/mp4','audio/mpeg']).parse(file.type.toLowerCase().split(';',1)[0]);
      if (file.size < 2048 || file.size > 10485760) throw new RecordingDomainError('invalid');
      let metadata: object;
      if (activity.public_config?.practiceKind === 'dialogue_roleplay') {
        const sceneId = String(form.get('sceneId') ?? ''), roleSide = z.enum(['left','right']).parse(form.get('roleSide'));
        const turnIndex = Number(form.get('turnIndex'));
        const scene = object(binding.node.content).dialogueScenes?.find((s: unknown) => object(s).id === sceneId);
        if (!scene || !Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex >= scene.lines.length
          || turnIndex % 2 !== (roleSide === 'left' ? 0 : 1)) throw new RecordingDomainError('invalid');
        const transcript = String(form.get('transcript') ?? '').normalize('NFC').slice(0,500);
        metadata = { sceneId, roleSide, turnIndex, transcript: transcript || null, transcriptSource: transcript ? 'browser_speech_recognition' : null };
      } else if (form.has('practiceKey')) {
        metadata = { practiceKey: form.get('practiceKey'), trackIndex: Number(form.get('trackIndex')), segmentIndex: Number(form.get('segmentIndex')) };
      } else {
        const durationSeconds = Number(form.get('durationSeconds'));
        if (!Number.isFinite(durationSeconds) || durationSeconds < Number(activity.public_config?.minimumSeconds ?? 1)) throw new RecordingDomainError('invalid');
        metadata = { durationSeconds };
      }
      const kind = 'sceneId' in metadata ? 'roleplay-turn' : 'practiceKey' in metadata
        ? metadata.practiceKey === 'repeat-line' ? 'guided-repeat-line' : 'full-recall' : 'independent-output';
      const bound = runtimeRecordingMetadata(metadata, { snapshot: runtime?.snapshot ?? `recording-domain:${versionId}`, sourceRevision:runtime?.sourceRevision ?? sourceRevision, versionId, activityRef: runtime?.activityRef ?? activity.id, recordingKind: kind });
      const id = randomUUID(), ext = { 'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a','audio/mpeg':'mp3' }[mime];
      const key = `student-recordings/${request.owner.tenantId}/${request.owner.studentId}/${activity.id}/${id}.${ext}`;
      await request.uploadState('reserve', id);
      await beforeRecordingWrite();
      const { error, data: inserted } = await admin.from('digital_textbook_speaking_evidence').insert({ id,
        tenant_id: request.owner.tenantId, student_id: request.owner.studentId, activity_id: activity.id,
        object_key: key, byte_size: file.size, mime_type: mime, metadata: bound }).select('created_at').single();
      if (error || !inserted) { await request.uploadState('settle', id); throw new RecordingDomainError('unavailable'); }
      // Persist the exact identity BEFORE PUT. Failed PUT/HEAD compensation has
      // a real row to claim; failed DELETE remains durable delete-pending.
      let putStarted = false, putSettled = false;
      try {
        const url = await createR2SignedUploadUrl(key, mime, file.size);
        const bytes = await file.arrayBuffer(); await request.beforeWrite();
        putStarted = true;
        const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': mime }, body: bytes });
        putSettled = true;
        if (!response.ok) throw new RecordingDomainError('unavailable');
        const head = await checkR2ObjectExists(key);
        if (!head.exists || head.size !== file.size || head.contentType?.split(';',1)[0] !== mime) throw new RecordingDomainError('proof-invalid');
      } catch {
        // A network rejection is not proof that R2 has stopped receiving PUT.
        // Keep its shared reservation/lease: no blind DELETE or epoch cutover.
        if (putStarted && !putSettled) throw new RecordingDomainError('fenced');
        await request.uploadState('settle', id);
        await remove(id); throw new RecordingDomainError('unavailable');
      }
      await request.uploadState('settle', id);
      let previous = ownerQuery().neq('id', id).is('consumed_at', null).lt('created_at', inserted.created_at);
      if ('sceneId' in metadata) previous = previous.contains('metadata', { sceneId: object(metadata).sceneId, roleSide: object(metadata).roleSide, turnIndex: object(metadata).turnIndex });
      else if ('practiceKey' in metadata) previous = previous.contains('metadata', metadata);
      const { data: rows, error: re } = await previous;
      if (re) throw new RecordingDomainError('unavailable');
      // Completion may win this race: never delete a newly consumed row.
      for (const row of rows ?? []) {
        // New Runtime recordings must not delete historical/other-revision
        // evidence while replacing a recording in the current bound snapshot.
        if(runtime&&recordingDigest(row.metadata?.runtimeBinding??null)!==recordingDigest(bound.runtimeBinding??null))continue;
        try { await remove(row.id); }
        catch (e) { if (!(e instanceof RecordingDomainError && e.code === 'consumed')) throw e; }
      }
      return { evidenceId: id, byteSize: file.size, mimeType: mime };
    },
  };
}
