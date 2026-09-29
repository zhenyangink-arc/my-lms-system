import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { koreanHarness, requestFixture } from './fixtures/teaching-agent/student-runtime.mjs';
import { publicBody, eventsOf } from './fixtures/teaching-agent/student-transport.mjs';
const { parseStudentRunStream } = await import('../src/features/teaching-agent/client/ndjson-parser.ts');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('real isolated Next App Router: frames arrive before final; status, cancel and replay use real HTTP',
 {skip:process.env.RUN_TEACHING_AGENT_NEXT_TESTS!=='1',timeout:120000},async t=>{
 const cwd=resolve('.'),dir=mkdtempSync('/tmp/uply-stage1d-next-'),socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
 symlinkSync(join(cwd,'node_modules'),join(dir,'node_modules'),'dir');
 writeFileSync(join(dir,'package.json'),JSON.stringify({private:true,scripts:{},dependencies:{next:JSON.parse(readFileSync(join(cwd,'node_modules/next/package.json'),'utf8')).version,react:JSON.parse(readFileSync(join(cwd,'node_modules/react/package.json'),'utf8')).version,'react-dom':JSON.parse(readFileSync(join(cwd,'node_modules/react-dom/package.json'),'utf8')).version}}));
 writeFileSync(join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2020',module:'esnext',moduleResolution:'bundler',esModuleInterop:true,allowImportingTsExtensions:true,skipLibCheck:true,strict:true,noEmit:true,jsx:'react-jsx'},include:['**/*.ts']}));
 writeFileSync(join(dir,'next.config.mjs'),`export default {compress:false,devIndicators:false,experimental:{externalDir:true}};`);
 const composition=join(cwd,'tests/fixtures/teaching-agent/next-transport-composition.ts');
 for(const suffix of ['route.ts','[runId]/route.ts','[runId]/cancel/route.ts']){
  const path=join(dir,'app/api/teaching-agent/runs',suffix);mkdirSync(join(path,'..'),{recursive:true});
  // Exact production route module, with only its trusted server composition replaced.
  writeFileSync(path,readFileSync(join(cwd,'src/app/api/teaching-agent/runs',suffix),'utf8').replace('@/features/teaching-agent/server/transport/production',composition));
 }
 const log=[];const child=spawn(process.execPath,[join(cwd,'node_modules/next/dist/bin/next'),'dev','--webpack','-H','127.0.0.1','-p',String(port)],{cwd:dir,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>log.push(String(b)));child.stderr.on('data',b=>log.push(String(b)));
 const origin=`http://127.0.0.1:${port}`,endpoint=origin+'/api/teaching-agent/runs';
 try{
  let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(endpoint);if(r.status===405){ready=true;break;}}catch{}if(child.exitCode!==null)break;await delay(250);}assert.ok(ready,log.join(''));
  const b=publicBody(await requestFixture(koreanHarness()));const post=body=>fetch(endpoint,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
  const response=await post(b);assert.equal(response.status,200,await(response.status!==200?response.text():Promise.resolve('')));assert.equal(response.headers.get('content-encoding'),null);
  const frames=[];const started=performance.now();for await(const event of parseStudentRunStream(response.body))frames.push({type:event.type,atMs:Math.round(performance.now()-started),event});
  assert.equal(frames[0].type,'run.started');const final=frames.find(f=>f.type==='answer.final');assert.ok(final.atMs-frames.find(f=>f.type==='tool.status').atMs>=100,JSON.stringify(frames));assert.ok(final.atMs-frames[0].atMs>=300);
  const id=frames[0].event.runId,status=await(await fetch(endpoint+'/'+id)).json();assert.equal(status.status,'completed');assert.equal(status.finalAnswer,final.event.text);
  const replay=await eventsOf(await post(b));assert.equal(replay[0].runId,id);assert.equal(replay[0].replayed,true);assert.equal(replay.length,3);
  const active=await post({...b,idempotencyKey:crypto.randomUUID()}),it=parseStudentRunStream(active.body);const first=(await it.next()).value;const startCancel=performance.now();
  const cancelled=await fetch(endpoint+'/'+first.runId+'/cancel',{method:'POST',headers:{origin}});assert.equal(cancelled.status,200,await(cancelled.status!==200?cancelled.text():Promise.resolve('')));
  const rest=[];for await(const e of it)rest.push(e);assert.equal(rest.at(-1).type,'run.cancelled');const cancelMs=Math.round(performance.now()-startCancel);
  assert.equal((await(await fetch(endpoint+'/'+first.runId)).json()).status,'cancelled');
  writeFileSync('/tmp/uply-stage1d-next-results.json',JSON.stringify({realNext:true,frames:frames.map(({type,atMs})=>({type,atMs})),cancelMs,liveProviderRequests:0,tempDirectory:dir},null,2));
  t.diagnostic(`Next frames: ${frames.map(f=>f.type+'@'+f.atMs+'ms').join(', ')}; cancel ${cancelMs}ms`);
 }finally{child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(5000)]);if(child.exitCode===null)child.kill('SIGKILL');writeFileSync(join(dir,'next-test.log'),log.join(''));}
});
