// Existing isolated PostgreSQL test mechanism; NO host DB endpoint/env/network.
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync,appendFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
const exec=promisify(execFile),image='public.ecr.aws/supabase/postgres:17.6.1.141';
export const literal=s=>`'${String(s).replaceAll("'","''")}'`;
export const json=v=>`${literal(JSON.stringify(v))}::jsonb`;
export function connectOwnedDatabase(name){
 if(!/^uply-r7c-isolated-[a-f0-9-]+$/.test(name))throw Error('NOT_OWNED_TEST_DB');
 const raw=sql=>new Promise((resolve,reject)=>{
  const p=spawn('docker',['exec','-i',name,'psql','-X','-h','/tmp','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';
  p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>code?reject(Error(`ISOLATED_SQL_FAILURE:${err}`)):resolve(out.trim()));p.stdin.on('error',()=>{});p.stdin.end(sql);
 });
 return {raw,async transaction(sql){const out=await raw(sql);const lines=out.split('\n').filter(l=>l.startsWith('{'));if(!lines.length)throw Error('TRANSACTION_RESULT_UNKNOWN');return JSON.parse(lines.at(-1));}};
}
export async function startDatabase(){
 const name=`uply-r7c-isolated-${randomUUID()}`;
 await exec('docker',['image','inspect',image,'--format','{{.Id}}']);
 await exec('docker',['run','-d','--pull=never','--name',name,'--label','uply.stage=r7c-isolated','--network','none','--read-only','--tmpfs','/tmp:rw,size=256m,mode=1777','--user','100:101','--entrypoint','/bin/sh',image,'-c',"initdb -D /tmp/r7cpg -A trust --no-locale >/tmp/init.log && exec postgres -D /tmp/r7cpg -k /tmp -c listen_addresses='' -c max_connections=20"]);
 const db=connectOwnedDatabase(name),stop=async()=>{
  try{
   const counts=JSON.parse(await db.raw(`BEGIN READ ONLY;SELECT json_build_object('executionNodes',(SELECT count(*) FROM public.digital_textbook_nodes),'activities',(SELECT count(*) FROM public.digital_textbook_activities),'privateAnswerRows',(SELECT count(*) FROM public.digital_textbook_activity_secrets),'attempts',(SELECT count(*) FROM public.digital_textbook_attempts),'nodeProgressRows',(SELECT count(*) FROM public.digital_textbook_node_progress),'rpcProgressUpdates',(SELECT coalesce(sum(attempt_count-1),0) FROM public.digital_textbook_node_progress));ROLLBACK;`));
   appendFileSync('/tmp/r7c-isolated-db-ledger.jsonl',JSON.stringify({databaseSafeHash:createHash('sha256').update(name).digest('hex'),observedAtUtc:new Date().toISOString(),...counts})+'\n');
  }finally{await exec('docker',['rm','-f',name]);}
 };
 try{
  let ready=false;for(let i=0;i<100;i++){try{await db.raw('select 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}if(!ready)throw Error('ISOLATED_STARTUP_TIMEOUT');
  const info=JSON.parse((await exec('docker',['inspect',name])).stdout)[0];if(info.HostConfig.NetworkMode!=='none'||!info.HostConfig.ReadonlyRootfs||info.HostConfig.Binds)throw Error('ISOLATION_FAILURE');
  await db.raw(readFileSync(new URL('./bootstrap.sql',import.meta.url),'utf8'));
  await db.raw(readFileSync(new URL('../../../supabase/migrations/202608180027_restore_objective_activity_recording.sql',import.meta.url),'utf8'));
  return {...db,name,stop};
 }catch(e){await stop();throw e;}
}
export async function seedFixture(db){
 const id=()=>randomUUID(),ids={tenantId:id(),actorId:id(),lessonId:id(),textbookId:id(),versionId:id(),chapterId:id(),moduleId:id(),nodeId:id(),activityId:id()};
 const q=literal,J=json;
 await db.raw(`BEGIN;
 INSERT INTO public.tenants VALUES(${q(ids.tenantId)}); INSERT INTO auth.users VALUES(${q(ids.actorId)}); INSERT INTO public.lessons VALUES(${q(ids.lessonId)});
 INSERT INTO public.digital_textbooks(id,lesson_id,slug,level_code,title) VALUES(${q(ids.textbookId)},${q(ids.lessonId)},${q('isolated-'+ids.textbookId)},'beginner','{"zh-CN":"韩文字母入门"}');
 INSERT INTO public.digital_textbook_versions(id,textbook_id,version_number) VALUES(${q(ids.versionId)},${q(ids.textbookId)},1);
 INSERT INTO public.digital_textbook_chapters(id,version_id,slug,chapter_number,title) VALUES(${q(ids.chapterId)},${q(ids.versionId)},'prelesson',0,'{"zh-CN":"韩文字母入门"}');
 INSERT INTO public.digital_textbook_modules(id,chapter_id,module_code,sort_order,accent_role,title) VALUES(${q(ids.moduleId)},${q(ids.chapterId)},'orientation',1,'jade','{"zh-CN":"课前导航"}');
 INSERT INTO public.digital_textbook_nodes(id,module_id,node_code,node_type,sort_order,title,content) VALUES(${q(ids.nodeId)},${q(ids.moduleId)},'hangul-prelesson-activity','practice',1,'{"zh-CN":"一起试一试"}','{"sourceAlias":"hangul-introduction","sourceNode":7,"question":1,"fixtureOnly":true}');
 INSERT INTO public.digital_textbook_activities(id,node_id,activity_key,activity_type,sort_order,prompt,instruction,options,max_attempts,counts_toward_completion) VALUES(${q(ids.activityId)},${q(ids.nodeId)},'hangul-introduction-vowel-recognition','single_choice',1,'{"zh-CN":"哪个是元音？"}','{"zh-CN":"请选择一个选项。"}',${J(['ㄱ','ㅏ','ㄴ'].map(x=>({'zh-CN':x})))},20,true);
 INSERT INTO public.digital_textbook_activity_secrets(activity_id,answer_key) VALUES(${q(ids.activityId)},'{"kind":"index","value":1}'); COMMIT;`);
 return ids;
}
export async function startService(db,ids,port=0){
 const {fork}=await import('node:child_process');
 const p=fork(new URL('./service-process.mjs',import.meta.url),[],{execArgv:['--experimental-strip-types'],stdio:['ignore','pipe','pipe','ipc']});
 // Never forward database data or private service output to browser/report logs.
 const wait=kind=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('ISOLATED_SERVICE_TIMEOUT'));},15000);function cleanup(){clearTimeout(timer);p.off('message',onMessage);p.off('exit',onExit);}function onMessage(m){if(m.kind==='failure'){cleanup();reject(Error(m.code));}else if(m.kind===kind){cleanup();resolve(m);}}function onExit(){cleanup();reject(Error('ISOLATED_SERVICE_EXIT'));}p.on('message',onMessage);p.on('exit',onExit);});
 p.stdout.resume();p.stderr.resume();
 try{const ready=wait('ready');p.send({kind:'start',database:db.name,ids,port});const {url}=await ready;
  return {url,pid:p.pid,async mode(value){const done=wait('mode-set');p.send({kind:'mode',value});await done;},async metrics(){const done=wait('metrics');p.send({kind:'metrics'});return (await done).value;},stop(){return new Promise(resolve=>{if(p.exitCode!==null||p.signalCode)return resolve();p.once('exit',resolve);p.kill('SIGTERM');});}};
 }catch(e){p.kill('SIGTERM');throw e;}
}
