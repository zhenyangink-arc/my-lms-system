import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LegacyChapterOneSource } from './source.server.ts';
import { serviceEvidenceSchema } from './readiness-contracts.server.ts';
/** Supplemental SELECTs only. Caller must authorize before supplying this server client. */
export async function readChapterOneServiceEvidence(client:SupabaseClient, source:LegacyChapterOneSource) {
  const chapter=await client.from('digital_textbook_chapters')
    .select('id,version_id,chapter_test_id,chapter_tests(id,slug)').eq('id',source.chapter.id).single();
  if(chapter.error)throw new Error('Chapter navigation evidence unavailable');
  const speech=await client.from('learning_agent_script_audio_assets')
    .select('id,script_node_id,locale,segment_index,content_hash,duration_ms,production_status,cue_timeline')
    .in('script_node_id',source.teachingNodes.map(n=>n.id));
  if(speech.error)throw new Error('Speech evidence unavailable');
  return serviceEvidenceSchema.parse({chapter:chapter.data,speech:speech.data});
}
