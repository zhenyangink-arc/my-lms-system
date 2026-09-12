import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {legacySourceSchema,type LegacyChapterOneSource} from './source.server.ts';
/** Caller supplies an authorized server client. Fixed chapter SELECTs only; no env loading,
 * user progress/recording reads, secrets, RPC, storage calls or database writes.
 * Multiple SELECTs are a capture, not a transactionally pinned production publication. */
export async function readChapterOneLegacySource(s:SupabaseClient):Promise<LegacyChapterOneSource> {
async function q(t:string,c:string,k:string,v:string|string[]){const r=await s.from(t).select(c)[Array.isArray(v)?'in':'eq'](k,v);if(r.error)throw Error(t+': '+r.error.message);return z.array(z.object({id:z.string().optional(),status:z.string().optional()}).passthrough()).parse(r.data ?? []);}
function rowIds(rows:Array<{id?:string}>):string[]{return rows.map(r=>z.string().min(1).parse(r.id));}
const textbook=(await q('digital_textbooks','id,slug,title,status,student_app_id','id','7100ab2b-72b0-478e-8847-4df9b4485109'))[0];
const version=(await q('digital_textbook_versions','id,textbook_id,version_number,status','id','939ad4f7-3238-425e-91e9-d456c130ca68'))[0];
const chapter=(await q('digital_textbook_chapters','id,version_id,slug,chapter_number,title,scenario,goal,status','id','cda24fb8-c93b-4a19-9577-4418350ff708'))[0];
const modules=await q('digital_textbook_modules','id,chapter_id,module_code,sort_order,title,description,accent_role','chapter_id',z.string().parse(chapter?.id));
const nodes=await q('digital_textbook_nodes','id,module_id,node_code,node_type,sort_order,estimated_minutes,title,content','module_id',rowIds(modules));
const activities=await q('digital_textbook_activities','id,node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config,max_attempts,counts_toward_completion','node_id',rowIds(nodes));
const media=await q('digital_textbook_media_assets','id,node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata','node_id',rowIds(nodes));
const tracks=await q('digital_textbook_listening_tracks','activity_id,page_index,audio_object_key,audio_status','activity_id',rowIds(activities));
const lessons=await q('learning_agent_lessons','id,module_id','module_id',rowIds(modules));
const teachingVersions=(await q('learning_agent_script_versions','id,lesson_id,version_number,status','lesson_id',rowIds(lessons))).filter(v=>v.status==='published');
const teachingNodes=await q('learning_agent_script_nodes','id,script_version_id,node_key,node_type,sort_order,title,teacher_script,configuration,reference_activity_id,action_type,next_node_key,remediation_node_key,is_required','script_version_id',rowIds(teachingVersions));
const speech=await q('learning_agent_script_audio_assets','id,script_node_id,locale,segment_index,content_hash,duration_ms,production_status','script_node_id',rowIds(teachingNodes));
return legacySourceSchema.parse({textbook,version,chapter,modules,nodes,activities,media,tracks,lessons,teachingVersions,teachingNodes,speech});
}
