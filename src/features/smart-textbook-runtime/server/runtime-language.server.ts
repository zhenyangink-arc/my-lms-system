import 'server-only';
import {z} from 'zod';
const inputSchema=z.strictObject({sessionRef:z.string().regex(/^learning-session-[0-9a-f-]{36}$/),locale:z.enum(['zh-CN','ko-KR'])});
type Ports={resolve:(input:{sessionRef:string})=>Promise<{manifest:{textbook:{id:string}}}>;admit:()=>Promise<{eligible:boolean}>;save:(input:{textbookId:string;locale:'zh-CN'|'ko-KR';supportMode:'bilingual'})=>Promise<{ok:boolean}>;revoke:(input:{sessionRef:string})=>Promise<unknown>};
/** Reauthorize existing scope, persist via the original preference service, then
 * invalidate the old session. Never mutate locale on an executing session. */
export async function changeRuntimeLanguage(input:unknown,p:Ports){
  const r=inputSchema.parse(input),a=await p.resolve({sessionRef:r.sessionRef});
  if(!(await p.admit()).eligible)throw Error('RUNTIME_ADMISSION_CLOSED');
  const saved=await p.save({textbookId:a.manifest.textbook.id,locale:r.locale,supportMode:'bilingual'});
  if(!saved.ok)throw Error('LANGUAGE_SAVE_FAILED');
  await p.revoke({sessionRef:r.sessionRef});
  return {reloadRequired:true as const};
}
