"""Full source copy, no production env. Fixture injection occurs in the private copy only."""
import json,pathlib,os,shutil,subprocess,sys,time
from staging import ROOT,load
d=pathlib.Path(sys.argv[2]);s=load(d);action=sys.argv[1];dest=d/'next';keys=json.loads((d/'status.json').read_text());ids=json.loads((d/'fixture.json').read_text());users=json.loads((d/'users.private.json').read_text())
if action=='prepare':
 dest.mkdir()
 for name in set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')):
  if not name or name.startswith('.next') or name.startswith('.env') or not (ROOT/name).is_file():continue
  if pathlib.Path(name).parts[0] in ['.agents','.codex','.ai','supabase','docs','assets']:continue
  target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,target)
 (dest/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
 (d/'control.json').write_text(json.dumps({'enabled':False,'providerDelayMs':100}))
 print(json.dumps({'nextCopy':'PASS','productionEnvCopied':False}));raise SystemExit
if action=='instrument':
 production=dest/'src/features/teaching-agent/server/transport/production.ts'
 content=production.read_text();content="import { r2Provider } from '../../../../../scripts/teaching-agent-r2/provider-fixture';\n"+content
 content=content.replace('repository: new SupabaseStudentTeachingReadRepository(auth.supabase),','provider: r2Provider(), repository: new SupabaseStudentTeachingReadRepository(auth.supabase),')
 production.write_text(content)
 page=dest/'src/app/r2-lesson/page.tsx';page.parent.mkdir(parents=True,exist_ok=True)
 page.write_text('''import {Suspense} from 'react';
import {getAuthContext} from '@/lib/auth';
import {loadStudentTeachingSlots} from '@/features/teaching-agent/server/page-projection/lesson-slots';
export default async function Page(){const auth=await getAuthContext();
const slots=auth.status==='active'&&auth.tenant?.role==='student'?await loadStudentTeachingSlots({supabase:auth.supabase,actorId:auth.user.id,tenantId:auth.tenant.id,lessonId:'''+json.dumps(ids['alesson'])+''',moduleIds:['''+json.dumps(ids['amodule'])+''']}):undefined;
return <main><h1>合成韩语测试课</h1><Suspense fallback={null}>{slots?.['''+json.dumps(ids['amodule'])+''']?.['zh-CN']}</Suspense></main>;}''')
 handler=dest/'src/features/teaching-agent/server/transport/student-handlers.ts'
 text=handler.read_text()
 text="import {appendFileSync} from 'node:fs';\n"+text
 text=text.replace("const metadata = { requestId: randomUUID(), receivedAt: new Date().toISOString() };", "const metadata = { requestId: randomUUID(), receivedAt: new Date().toISOString() }; appendFileSync(process.env.UPLY_R2_DIRECTORY!+'/request-events.jsonl',JSON.stringify(metadata)+'\\n');")
 handler.write_text(text)
 # Explicit SDK transport instrumentation survives Next's fetch patching.
 for name in ['server.ts','admin.ts']:
  client=dest/'src/lib/supabase'/name
  text="import {r2ObservedFetch} from '../../../scripts/teaching-agent-r2/observed-fetch';\n"+client.read_text()
  if name=='server.ts':text=text.replace('      cookies: {','      global: {fetch:r2ObservedFetch},\n      cookies: {')
  else:text=text.replace('    auth: {','    global: {fetch:r2ObservedFetch},\n    auth: {')
  client.write_text(text)
 # Process-owned rollout configuration watcher; never a client-controlled route.
 (dest/'src/instrumentation-r2-node.ts').write_text('''export async function register(){
const fs=await import('node:fs');const d=process.env.UPLY_R2_DIRECTORY!;
const sync=()=>{const c=JSON.parse(fs.readFileSync(d+'/control.json','utf8'));
process.env.TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED=c.enabled?'1':'0';
process.env.TEACHING_AGENT_ALLOWED_TENANTS=c.enabled?'''+json.dumps(ids['A'])+''':'';
process.env.TEACHING_AGENT_ALLOWED_COURSES=c.enabled?'''+json.dumps(ids['acourse'])+''':'';
process.env.TEACHING_AGENT_ALLOWED_USERS=c.enabled?'''+json.dumps(users['A1']['id'])+''':'';};sync();fs.watchFile(d+'/control.json',{interval:100},sync);
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
if(u.hostname!=='127.0.0.1'&&u.hostname!=='localhost')throw Error('R2_EXTERNAL_NETWORK_FORBIDDEN');
return original(input,init);};}''')
 (dest/'src/instrumentation.ts').write_text("export async function register(){if(process.env.NEXT_RUNTIME === 'nodejs'){await (await import('./instrumentation-r2-node')).register();}}")
 print(json.dumps({'providerOnlyFixture':True,'privateLessonHarness':True}));raise SystemExit
env={k:v for k,v in os.environ.items() if not any(x in k for x in ['SUPABASE','DEEPSEEK','OPENAI','ANTHROPIC','TEACHING_AGENT','NEXT_PUBLIC_'])}
env.update(NEXT_PUBLIC_SUPABASE_URL=s['url'],NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=keys['ANON_KEY'],SUPABASE_SERVICE_ROLE_KEY=keys['SERVICE_ROLE_KEY'],NEXT_TELEMETRY_DISABLED='1',UPLY_R2_DIRECTORY=str(d),TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED='0')
command=['node',str(ROOT/'node_modules/next/dist/bin/next')]
command+=['build','--webpack'] if action=='build' else ['dev','--webpack','-H','127.0.0.1','-p',str(s['ports']['next'])]
start=time.monotonic()
with (d/('next-'+action+'.private.log')).open('w') as output:
 p=subprocess.Popen(command,cwd=dest,env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
 if action=='start':
  (d/'next-process.json').write_text(json.dumps({'pid':p.pid,'directory':str(dest)}));print(json.dumps({'nextStarted':True,'port':s['ports']['next']}),flush=True)
  try:p.wait()
  except KeyboardInterrupt:
   import signal
   os.killpg(p.pid,signal.SIGTERM);p.wait(timeout=10)
  (d/'next-stopped.json').write_text(json.dumps({'stopped':True}))
 else:
  code=p.wait();result={'exit':code,'seconds':round(time.monotonic()-start,2),'stagingEnvOnly':True,'deployed':False};(d/'build-result.json').write_text(json.dumps(result));print(json.dumps(result))
