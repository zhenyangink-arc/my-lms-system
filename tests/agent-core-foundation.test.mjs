import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const { fixture, fixtureFetch, planningEvents, finalEvents, sse, streamResponse } = await import('./fixtures/agent-core/foundation.mjs');
const { agentRequestSchema } = await import('../src/features/agent-core/contracts/public.ts');
const { isTerminalRunStatus, assertRunTransition } = await import('../src/features/agent-core/runtime/run-state.ts');
const { assertExecution, createDeadlineSignal } = await import('../src/features/agent-core/runtime/deadline.ts');
const { consumeBudget } = await import('../src/features/agent-core/runtime/run-budget.ts');
const { CoreError } = await import('../src/features/agent-core/runtime/errors.ts');
const { coordinateRun } = await import('../src/features/agent-core/runtime/run-coordinator.ts');
const { createSkillRegistry, requireSkill, productionSkillRegistry } = await import('../src/features/agent-core/skills/registry.ts');
const { createToolRegistry, productionToolRegistry } = await import('../src/features/agent-core/tools/registry.ts');
const { executeAllowedTool } = await import('../src/features/agent-core/tools/executor.ts');
const { resolveAllowedToolDefinitions } = await import('../src/features/agent-core/permissions/tool-policy.ts');
const { denyAllPolicy } = await import('../src/features/agent-core/permissions/permission-policy.ts');
const { DeepSeekProviderAdapter } = await import('../src/features/agent-core/providers/deepseek/adapter.ts');
const { DEEPSEEK_BASELINE } = await import('../src/features/agent-core/providers/deepseek/capabilities.ts');
const { createEventFactory, projectTrace } = await import('../src/features/agent-core/observability/events.ts');
const { parseIntake, requestDigest, resolveConversationId } = await import('../src/features/agent-core/conversation/scope.ts');
const collect=async(iter)=>{const out=[];for await(const e of iter)out.push(e);return out;};
const code=(c)=>(e)=>e instanceof CoreError&&e.code===c;
const execution=()=>({runId:'run_test',modelCallId:'model_test',signal:new AbortController().signal,deadlineAt:new Date(Date.now()+10000).toISOString()});
const request=()=>({model:DEEPSEEK_BASELINE,messages:[{role:'user',text:'synthetic'}],tools:[{name:'echo_test',description:'synthetic',inputSchema:{type:'object'}}],toolChoice:'auto',maxOutputTokens:128});
const adapter=(fetchImpl)=>new DeepSeekProviderAdapter({readApiKey:()=> 'synthetic-not-a-credential',fetchImpl});
const toolContext=(f)=>({...execution(),authority:f.authority,callId:'test_call_001',skillRunId:'test_skill'});

test('strict public request rejects authority, endpoint, tool registry and nested extra fields',()=>{
 const f=fixture();assert.equal(agentRequestSchema.safeParse(f.request).success,true);
 for(const k of ['userId','tenantId','role','permissions','allowedTools','systemPrompt','apiKey','endpoint','authority','toolRegistry'])assert.equal(agentRequestSchema.safeParse({...f.request,[k]:'forged'}).success,false,k);
 assert.equal(agentRequestSchema.safeParse({...f.request,clientContext:{tenantId:'forged'}}).success,false);
 assert.throws(()=>parseIntake(f.request,{...f.authority,tenantId:''}),code('FORBIDDEN'));
 assert.throws(()=>parseIntake({...f.request,scope:{kind:'course',courseId:f.authority.actorId}},f.authority),code('FORBIDDEN'));
});
test('client hints remain untrusted and normalized digest is stable',()=>{
 const f=fixture();const r=parseIntake({...f.request,clientContext:{selectedText:'fake'}},f.authority);
 assert.equal(r.clientContext.selectedText,'fake');assert.equal(r.clientContext.provenance,undefined);
 assert.equal(requestDigest(r),requestDigest({...r,message:r.message}));
 assert.equal(resolveConversationId(r,f.authority),resolveConversationId(r,f.authority));
 assert.notEqual(resolveConversationId(r,f.authority),resolveConversationId(r,{...f.authority,tenantId:'different'}));
});
test('state transitions and all terminal states immutable',()=>{
 for(const [a,b] of [['created','running'],['running','waiting_tool'],['waiting_tool','running'],['running','completed'],['waiting_tool','cancelled']])assert.doesNotThrow(()=>assertRunTransition(a,b));
 for(const end of ['completed','failed','cancelled']){assert.equal(isTerminalRunStatus(end),true);for(const next of ['running',end,'created'])assert.throws(()=>assertRunTransition(end,next));}
 assert.throws(()=>assertRunTransition('running','waiting_confirmation'));
});
test('deadline/abort reject new actions; deadline signal cancels pending work',async()=>{
 const c=new AbortController();c.abort();assert.throws(()=>assertExecution(c.signal,new Date(Date.now()+10000).toISOString()),code('RUN_CANCELLED'));
 assert.throws(()=>assertExecution(new AbortController().signal,'invalid'),code('DEADLINE_EXCEEDED'));
 const d=createDeadlineSignal(new AbortController().signal,new Date(Date.now()+20).toISOString());
 await new Promise(r=>setTimeout(r,30));assert.equal(d.signal.aborted,true);d.dispose();
});
test('budget fails closed and does not mutate original counts',()=>{
 const b={...fixture().profile.budget,usedModelCalls:0,usedToolExecutions:0,deadlineAt:'test'};assert.equal(consumeBudget(b,'model').usedModelCalls,1);assert.equal(b.usedModelCalls,0);
 assert.throws(()=>consumeBudget({...b,usedModelCalls:2},'model'),code('BUDGET_UNAVAILABLE'));
 assert.throws(()=>consumeBudget({...b,reservedTokens:0},'model'),code('BUDGET_UNAVAILABLE'));
});
test('exact skill versions; disabled and missing versions rejected; production registries empty',()=>{
 const f=fixture();assert.equal(requireSkill(f.skills,f.skill).version,'1.0.0');
 assert.throws(()=>requireSkill(f.skills,{name:f.skill.name,version:'latest'}));
 assert.throws(()=>requireSkill(createSkillRegistry([{...f.skill,status:'disabled'}]),f.skill));
 assert.equal(productionToolRegistry.get(f.tool.definition),undefined);assert.equal(productionSkillRegistry.get(f.skill),undefined);
});
test('visible tool intersection is profile A/B ∩ skill B ∩ permission B/C',async()=>{
 const f=fixture();const tools=['A','B','C'].map(name=>({...f.tool,definition:{...f.tool.definition,name}}));
 const refs=tools.map(t=>({name:t.definition.name,version:'1.0.0'}));
 const policy={async evaluate(a,action){return ['B','C'].includes(action.ref.name)?f.policy.evaluate(a):{effect:'deny',code:'test'};}};
 const visible=await resolveAllowedToolDefinitions({...f.profile,allowedToolRefs:refs.slice(0,2)},{...f.skill,allowedTools:[refs[1]]},f.authority,createToolRegistry(tools),policy);
 assert.deepEqual(visible.map(t=>t.name),['B']);assert.deepEqual(await resolveAllowedToolDefinitions(f.profile,f.skill,f.authority,f.tools,denyAllPolicy),[]);
});
for(const [label,modify,visible,args,expected] of [
 ['unknown',t=>t,[], '{"value":"test"}','TOOL_NOT_ALLOWED'],
 ['disabled',t=>({...t,definition:{...t.definition,status:'disabled'}}),null,'{"value":"test"}','TOOL_NOT_ALLOWED'],
 ['high risk',t=>({...t,definition:{...t.definition,riskLevel:2}}),null,'{"value":"test"}','TOOL_NOT_ALLOWED'],
 ['invalid JSON',t=>t,null,'{','TOOL_INVALID_INPUT'],
 ['wrong schema',t=>t,null,'{"value":7}','TOOL_INVALID_INPUT'],
 ['extra argument',t=>t,null,'{"value":"test","tenantId":"bad"}','TOOL_INVALID_INPUT'],
])test(`executor rejects ${label} before side effects`,async()=>{
 const f=fixture();const t=modify(f.tool);await assert.rejects(()=>executeAllowedTool({id:'test_call',name:'echo_test',arguments:args},visible??[t.definition],createToolRegistry([t]),f.policy,toolContext(f)),code(expected));assert.equal(f.executed(),0);
});
test('executor rechecks permission, abort and deadline immediately before execution',async()=>{
 const f=fixture();const call={id:'c',name:'echo_test',arguments:'{"value":"test"}'};
 await assert.rejects(()=>executeAllowedTool(call,[f.tool.definition],f.tools,denyAllPolicy,toolContext(f)),code('TOOL_NOT_ALLOWED'));
 const c=new AbortController();c.abort();await assert.rejects(()=>executeAllowedTool(call,[f.tool.definition],f.tools,f.policy,{...toolContext(f),signal:c.signal}),code('RUN_CANCELLED'));
 await assert.rejects(()=>executeAllowedTool(call,[f.tool.definition],f.tools,f.policy,{...toolContext(f),deadlineAt:new Date(0).toISOString()}),code('DEADLINE_EXCEEDED'));assert.equal(f.executed(),0);
});
for(const fragments of [['{"value":"verification"}'],['{','"value"',':','"veri','fication"','}']])test(`Provider assembles ${fragments.length} arguments fragments across arbitrary byte splits`,async()=>{
 const a=adapter(async()=>streamResponse(sse(planningEvents(fragments)),1));const out=await collect(a.stream(request(),execution()));
 assert.equal(out.at(-1).type,'done');assert.equal(out.at(-1).response.finishReason,'tool_calls');assert.equal(out.at(-1).response.toolCalls[0].id,'test_call_001');
 assert.deepEqual(JSON.parse(out.at(-1).response.toolCalls[0].arguments),{value:'verification'});assert.equal(out.find(e=>e.type==='usage').usage.totalTokens,342);
});
test('Provider text, late usage and DONE; internal reasoning omitted',async()=>{
 const out=await collect(adapter(async()=>streamResponse(sse(finalEvents))).stream(request(),execution()));
 assert.equal(out.filter(e=>e.type==='text_delta').map(e=>e.text).join(''),'verification');assert.equal(out.at(-1).response.usage.status,'reported');assert.doesNotMatch(JSON.stringify(out),/reasoning|DO NOT PERSIST/);
});
test('malformed partial JSON and truncated stream never complete a tool',async()=>{
 for(const body of [sse(planningEvents(['{"value":'])),sse(planningEvents()).replace('data: [DONE]\r\n\r\n',''),'data: {bad}\n\n']){
 const out=await collect(adapter(async()=>streamResponse(body)).stream(request(),execution()));assert.equal(out.at(-1).type,'error');assert.equal(out.some(e=>e.type==='tool_call_complete'),false);assert.equal(out.some(e=>e.type==='done'),false);
 }
});
test('Provider abort before call and expired deadline cause zero fetches',async()=>{
 let calls=0;const a=adapter(async()=>{calls++;throw Error('should not call');});
 const c=new AbortController();c.abort();let out=await collect(a.stream(request(),{...execution(),signal:c.signal}));assert.equal(out.at(-1).code,'RUN_CANCELLED');
 out=await collect(a.stream(request(),{...execution(),deadlineAt:new Date(0).toISOString()}));assert.equal(out.at(-1).code,'DEADLINE_EXCEEDED');assert.equal(calls,0);
});
test('Provider mid-stream cancellation records unknown usage, never zero',async()=>{
 const c=new AbortController();const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(sse([{choices:[{delta:{content:'a'},finish_reason:null}]}])));}});
 const out=[];for await(const e of adapter(async()=>new Response(body,{headers:{'content-type':'text/event-stream'}})).stream(request(),{...execution(),signal:c.signal})){out.push(e);if(e.type==='text_delta')c.abort();}
 assert.deepEqual(out.find(e=>e.type==='usage').usage,{status:'unknown'});assert.equal(out.at(-1).code,'RUN_CANCELLED');
});
test('normalized Provider errors omit raw response; no retries; capabilities exact',async()=>{
 let count=0;const a=adapter(async()=>{count++;return new Response('fake private upstream detail',{status:429});});
 const out=await collect(a.stream(request(),execution()));assert.equal(out.at(-1).code,'PROVIDER_UNAVAILABLE');assert.equal(count,1);assert.doesNotMatch(JSON.stringify(out),/upstream|credential/);
 assert.equal(a.getCapabilities({...DEEPSEEK_BASELINE,model:'unverified'}).supportsTools,'unverified');
 assert.equal(a.getCapabilities(DEEPSEEK_BASELINE).supportsStructuredOutput,'unverified');
});
test('public seq and trace projection cannot spread private data',()=>{
 const factory=createEventFactory('run');const trace={kind:'tool.started',runId:'run',toolCallId:'test-call',tenantId:'private-tenant',toolArgs:{secret:'private-args'},permission:{detail:'private-permission'},at:'test'};
 const a=factory({...projectTrace(trace),...{privateExtra:'hidden'}});const b=factory({type:'answer.delta',text:'safe'});
 assert.deepEqual([a.seq,b.seq],[1,2]);assert.doesNotMatch(JSON.stringify(a),/private|hidden|toolArgs|tenantId/);assert.equal(projectTrace({...trace,kind:'permission.checked'}),null);
});
test('synthetic full Run: admission → exact skill → DeepSeek fixtures → echo → final → usage → terminal',async()=>{
 const f=fixture();const wire=fixtureFetch();const events=[];const result=await coordinateRun({...f,provider:adapter(wire.fetchImpl)},{request:f.request,authority:f.authority,profile:f.profile,skillRef:f.skill,signal:new AbortController().signal,emit:e=>events.push(e)});
 assert.equal(result.run.status,'completed');assert.equal(f.executed(),1);assert.equal(wire.calls.length,2);
 for(const call of wire.calls)assert.deepEqual(call.thinking,{type:'disabled'});
 const toolMessage=wire.calls[1].messages.find(m=>m.role==='tool');assert.equal(toolMessage.tool_call_id,'test_call_001');assert.match(toolMessage.content,/verification/);
 assert.equal(f.persistence.usage.length,2);assert.notEqual(f.persistence.usage[0].modelCallId,f.persistence.usage[1].modelCallId);
 assert.deepEqual(events.map(e=>e.seq),events.map((_,i)=>i+1));assert.equal(events.at(-1).type,'run.completed');assert.equal(f.persistence.messages.at(-1).content,'verification');
 const replay=await coordinateRun({...f,provider:adapter(wire.fetchImpl)},{request:f.request,authority:f.authority,profile:f.profile,skillRef:f.skill,signal:new AbortController().signal,emit(){}});
 assert.equal(replay.replayed,true);assert.equal(replay.run.id,result.run.id);assert.equal(wire.calls.length,2);
});
test('coordinator persists cancelled unknown usage and terminal after disconnect',async()=>{
 const f=fixture();const c=new AbortController();const provider={providerId:'test',getCapabilities(){throw Error('unused');},async *stream(){yield {type:'text_delta',text:'partial'};c.abort();yield {type:'usage',usage:{status:'unknown'}};yield {type:'error',code:'RUN_CANCELLED'};}};
 const out=await coordinateRun({...f,provider},{request:f.request,authority:f.authority,profile:f.profile,skillRef:f.skill,signal:c.signal,emit(){throw Error('transport gone');}});
 assert.equal(out.run.status,'cancelled');assert.deepEqual(f.persistence.usage[0].usage,{status:'unknown'});
});
test('memory port contract: idempotency conflict, active concurrency, terminal CAS and tenant rejection',async()=>{
 const f=fixture();const budget={...f.profile.budget,usedModelCalls:0,usedToolExecutions:0,deadlineAt:new Date(Date.now()+10000).toISOString()};
 const input={request:f.request,authority:f.authority,conversationId:resolveConversationId(f.request,f.authority),digest:requestDigest(f.request),profile:f.profile,skillRef:f.skill,budget};
 const [a,b]=await Promise.all([f.persistence.admitRun(input),f.persistence.admitRun(input)]);assert.equal(a.run.id,b.run.id);
 await assert.rejects(()=>f.persistence.admitRun({...input,digest:'different'}),code('IDEMPOTENCY_CONFLICT'));
 await assert.rejects(()=>f.persistence.admitRun({...input,request:{...f.request,idempotencyKey:'other-key'}}),code('CONVERSATION_BUSY'));
 const r=await f.persistence.transitionRun({run:a.run,to:'running',budget});
 const race=await Promise.allSettled([f.persistence.transitionRun({run:r,to:'completed',budget,finalText:'ok'}),f.persistence.transitionRun({run:r,to:'cancelled',budget})]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(()=>f.persistence.admitRun({...input,authority:{...f.authority,tenantId:'bad'}}),code('FORBIDDEN'));
});
test('public barrel + every server implementation retain server-only boundary; no business dependency',()=>{
 const root=resolve('src/features/agent-core');const files=readdirSync(root,{recursive:true}).filter(f=>f.endsWith('.ts'));
 for(const file of files){const text=readFileSync(resolve(root,file),'utf8');if(!['index.ts','contracts/public.ts','contracts/transport.ts'].includes(file))assert.match(text,/^import 'server-only';/,file);assert.doesNotMatch(text,/KoreanLevelOne|learning-agent\/respond|learning_agent_sessions|from ['"]react['"]/,file);}
 const barrel=readFileSync(resolve(root,'index.ts'),'utf8');assert.doesNotMatch(barrel,/RunAuthority|ToolExecutionContext|providers|persistence|contracts\/server/);
 assert.doesNotMatch(readFileSync(resolve(root,'contracts/public.ts'),'utf8'),/import .*server|import .*provider/);
});

test('UTF-8 split boundaries are decoded without corruption',async()=>{
 const events=[{choices:[{delta:{content:'저는 학생입니다.'},finish_reason:null}]},{choices:[{delta:{},finish_reason:'stop'}]},'[DONE]'];
 const out=await collect(adapter(async()=>streamResponse(sse(events),1)).stream(request(),execution()));assert.equal(out.at(-1).response.text,'저는 학생입니다.');assert.deepEqual(out.at(-1).response.usage,{status:'unknown'});
});
test('conflicting tool ID and multiple-choice outputs reject protocol',async()=>{
 const bad=planningEvents(['{','}']);bad[1].choices[0].delta.tool_calls[0].id='different-id';
 for(const events of [bad,[{choices:[{delta:{content:'x'}},{delta:{content:'y'}}]},'[DONE]']]){
  const out=await collect(adapter(async()=>streamResponse(sse(events))).stream(request(),execution()));assert.equal(out.at(-1).code,'PROVIDER_PROTOCOL_ERROR');
 }
});
test('pending Provider body stops on deadline and yields unknown usage',async()=>{
 const body=new ReadableStream({start(){}});const out=await collect(adapter(async()=>new Response(body,{headers:{'content-type':'text/event-stream'}})).stream(request(),{...execution(),deadlineAt:new Date(Date.now()+25).toISOString()}));
 assert.equal(out.at(-1).code,'DEADLINE_EXCEEDED');assert.deepEqual(out.find(e=>e.type==='usage').usage,{status:'unknown'});
});
test('no Tool execution after a Provider asks for an unexposed function',async()=>{
 const f=fixture();const events=planningEvents();events[0].choices[0].delta.tool_calls[0].function.name='unregistered_write';
 const result=await coordinateRun({...f,provider:adapter(async()=>streamResponse(sse(events)))},{request:f.request,authority:f.authority,profile:f.profile,skillRef:f.skill,signal:new AbortController().signal,emit(){}});
 assert.equal(result.run.status,'failed');assert.equal(f.executed(),0);assert.equal(f.persistence.usage.length,1);
});
test('Supabase repository binds tenant/actor and rejects forged returned ownership',async()=>{
 const {SupabaseAgentRepositories}=await import('../src/features/agent-core/persistence/supabase/repositories.ts');
 const f=fixture();let invoked=0;const client={async rpc(){invoked++;return {data:null,error:{message:'raw SQL credential must never escape'}};}};
 const repo=new SupabaseAgentRepositories(client,f.authority);
 const r={id:f.authority.actorId,conversationId:f.authority.actorId,inputMessageId:f.authority.actorId,actorId:f.authority.actorId,tenantId:f.authority.tenantId,
  agentCode:'test-agent',scopeRef:f.authority.scopeRef,definitionVersion:f.profile.definitionVersion,skillRef:f.profile.allowedSkillRefs[0],status:'created',stateVersion:1,fencingToken:f.authority.actorId,executionAttempt:1,
  leaseExpiresAt:f.authority.expiresAt,deadlineAt:f.authority.expiresAt,budget:{...f.profile.budget,usedModelCalls:0,usedToolExecutions:0,deadlineAt:f.authority.expiresAt},createdAt:f.authority.issuedAt};
 await assert.rejects(()=>repo.transitionRun({run:{...r,tenantId:'00000000-0000-4000-a000-000000000009'},to:'running',budget:r.budget}),code('FORBIDDEN'));assert.equal(invoked,0);
 await assert.rejects(()=>repo.transitionRun({run:r,to:'running',budget:r.budget}),e=>e.code==='PERSISTENCE_FAILED'&&!JSON.stringify(e).includes('credential'));assert.equal(invoked,1);
});
test('public error projection replaces unrecognized private codes and messages',()=>{
 const factory=createEventFactory('run');const out=factory(projectTrace({kind:'run.failed',runId:'run',at:'test',errorCode:'fake SQL credential detail'}));
 assert.equal(out.code,'PERSISTENCE_FAILED');assert.doesNotMatch(JSON.stringify(out),/SQL|credential/);
});
