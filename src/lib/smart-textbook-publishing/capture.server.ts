import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readChapterOneLegacySource } from '../smart-textbook-legacy-adapter/reader.server';
import { readChapterOneServiceEvidence } from '../smart-textbook-legacy-adapter/service-reader.server';
import type { PublicationScope } from './artifact.server';

export const dependencyTables = ['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','digital_textbook_nodes','digital_textbook_activities','digital_textbook_activity_secrets','digital_textbook_media_assets','digital_textbook_listening_tracks','learning_agent_lessons','learning_agent_profiles','learning_agent_profile_secrets','learning_agent_script_versions','learning_agent_script_nodes','learning_agent_node_interaction_secrets','learning_agent_script_audio_assets','chapter_tests'] as const;
// A private DB capture, never a Block props escape hatch or browser DTO.
const row=z.record(z.string(),z.json());
export const dependencyCaptureSchema=z.record(z.enum(dependencyTables),z.array(row));
export type DependencyCapture=z.infer<typeof dependencyCaptureSchema>;

/** Replay the EXISTING SELECT projection against ONE captured SQL snapshot.
 * No second database read can tear compilation across authoring revisions. */
export async function projectPublicationCapture(input:unknown){
  const dependencies=dependencyCaptureSchema.parse(input);
  const transport={from(table:string){
    if(!dependencyTables.includes(table as typeof dependencyTables[number]))throw Error('CAPTURE_TABLE');
    let rows=dependencies[table as keyof DependencyCapture],columns='';
    const result=()=>rows.map(row=>Object.fromEntries(columns.split(/,(?![^()]*\))/).map(field=>{
      if(field==='chapter_tests(id,slug)'){
        const test=dependencies.chapter_tests.find(t=>t.id===row.chapter_test_id);
        return ['chapter_tests',test?{id:test.id,slug:test.slug}:null];
      }
      return [field,row[field]];
    })));
    const q={select(c:string){columns=c;return q;},eq(key:string,value:unknown){rows=rows.filter(r=>r[key]===value);return q;},in(key:string,values:unknown[]){rows=rows.filter(r=>values.includes(r[key]));return q;},
      async single(){if(rows.length!==1)throw Error('CAPTURE_SINGLE');return {data:result()[0],error:null};},
      then(resolve:(v:{data:unknown[];error:null})=>unknown){return Promise.resolve({data:result(),error:null}).then(resolve);}};
    return q;
  }} as unknown as SupabaseClient;
  const source=await readChapterOneLegacySource(transport),evidence=await readChapterOneServiceEvidence(transport,source);
  if(source.activities.some(a=>dependencies.digital_textbook_activity_secrets.filter(s=>s.activity_id===a.id).length!==1))throw Error('CAPTURE_GRADER_SECRET_REQUIRED');
  if(source.teachingNodes.some(n=>n.reference_activity_id&&!source.activities.some(a=>a.id===n.reference_activity_id)))throw Error('CAPTURE_EXTERNAL_ACTIVITY_UNSUPPORTED');
  return {source,evidence,dependencies};
}
export async function captureChapterOnePublication(admin:SupabaseClient,actor:string,scope:PublicationScope){
  const r=await admin.rpc('capture_runtime_publication_v1',{p_actor:actor,p_scope:scope});
  if(r.error)throw Error('PUBLICATION_CAPTURE_UNAVAILABLE');
  return projectPublicationCapture(r.data);
}
