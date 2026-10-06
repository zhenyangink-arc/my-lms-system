import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireActiveUser} from '../auth';
import {createAdminClient} from '../supabase/admin';
import {chapterOnePublicationScope} from './loader.server';

async function owner(){
 const a=await requireActiveUser();
 if(a.profile?.global_role!=='platform_owner')throw Error('PUBLICATION_OWNER_ONLY');
 return a.user.id;
}
/** Retains every durable record; revokes only this textbook's test locators.
 * A draining result is NOT permission to edit. Retry once all real requests end.
 * There is no forced expiry or "clear all" operation. */
export async function beginChapterOneEditing(){
 const actor=await owner();
 const r=await createAdminClient().rpc('begin_runtime_textbook_edit_v1',{p_actor:actor,p_textbook:chapterOnePublicationScope.textbookId});
 if(r.error)throw Error('PUBLICATION_EDIT_WINDOW_UNAVAILABLE');
 return z.strictObject({state:z.enum(['draining','editing']),inflight:z.number().int().nonnegative(),revision:z.number().int().positive()}).parse(r.data);
}
const edit=z.strictObject({activityId:z.string().uuid(),prompt:z.strictObject({'zh-CN':z.string().trim().min(1),'ko-KR':z.string().optional()}),answerIndex:z.number().int().nonnegative()});
/** Minimal existing-domain authoring operation, not a new grader. Grading
 * still consumes the original activity secret through the existing service. */
export async function editChapterOneActivity(input:unknown){
 const actor=await owner(),value=edit.parse(input);
 const r=await createAdminClient().rpc('edit_runtime_chapter_activity_v1',{p_actor:actor,p_scope:chapterOnePublicationScope,
  p_activity:value.activityId,p_prompt:value.prompt,p_answer:{kind:'index',value:value.answerIndex}});
 if(r.error)throw Error('PUBLICATION_EDIT_REJECTED');
 return z.strictObject({saved:z.literal(true)}).parse(r.data);
}
/** DB-owned request lifetime across separate REST/domain transactions. Keep the
 * lease until the actual promise settles, even if the browser disconnects. A
 * failed finish leaves editing blocked, never assumes the worker stopped. */
export async function withChapterOneRuntimeRequest<T>(operation:()=>Promise<T>):Promise<T>{
 const a=await requireActiveUser();if(!a.tenant)throw Error('RUNTIME_REQUEST_AUTH');
 const admin=createAdminClient(),id=randomUUID();
 const args={p_actor:a.user.id,p_tenant:a.tenant.id,p_textbook:chapterOnePublicationScope.textbookId,p_request:id};
 const entered=await admin.rpc('runtime_publication_request_v1',{...args,p_operation:'enter'});
 if(entered.error||entered.data?.ok!==true)throw Error('TEXTBOOK_TEST_RUN_STOPPED');
 try{return await operation();}
 finally{
  const finished=await admin.rpc('runtime_publication_request_v1',{...args,p_operation:'leave'});
  if(finished.error||finished.data?.ok!==true)throw Error('RUNTIME_REQUEST_FINISH_FAILED');
 }
}
