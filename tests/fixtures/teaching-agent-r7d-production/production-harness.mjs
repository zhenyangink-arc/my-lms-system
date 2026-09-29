import {createHash} from 'node:crypto';
import {harness,execution} from '../teaching-agent/student-domain.mjs';
import {serverModule,nativeCapture,uid} from './published-fixture.mjs';
export const simulatedIdentity={database:'isolated-fixture',system_identifier:'fixture-only-never-current-db'};
export const identityHash='sha256:'+createHash('sha256').update(JSON.stringify(simulatedIdentity)).digest('hex');
const pgStub=`export class Client{
 constructor(options){this.state=globalThis.__r7dProductionTransport;if(options.connectionString!=='ISOLATED_TRANSPORT_STUB')throw Error('TEST_NETWORK_FORBIDDEN');this.id=++this.state.connections;}
 async connect(){this.state.queries.push([this.id,'CONNECT']);}
 async end(){this.state.queries.push([this.id,'END']);}
 async query(query,args){const s=this.state;const text=typeof query==='string'?query:query.text;s.queries.push([this.id,text]);if(s.fail)throw Error('private transport failure');
 if(text.includes('pg_control_system'))return {rows:[s.identity]};
 if(text.includes('read_runtime_publication_v1'))return {rows:[{result:{pointer:{snapshotId:s.bundle.snapshotId,generation:1},bundle:structuredClone(s.bundle)}}]};
 if(text.includes('assert_runtime_dependency_fence_v1'))return {rows:[{valid:s.fence}]};
 if(text.includes("AS facts"))return {rows:[{facts:s.filter(structuredClone(s.rows))}]};
 if(/^(BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY|SET LOCAL ROLE service_role; SET LOCAL request.jwt.claim.role='service_role'|COMMIT|ROLLBACK)$/.test(text))return {rows:[]};throw Error('UNEXPECTED_TEST_SQL');}}
`;
const native=await serverModule('src/lib/smart-textbook-publishing/native-publication.server.ts');
export const composition=await serverModule('src/features/teaching-agent/server/composition/create-production-lesson-execution-capabilities.ts',{pg:pgStub});
export const issuerModule=await serverModule('src/features/teaching-agent/server/domain-ports/production-lesson-facts-binding.server.ts',{pg:pgStub});
export const readModule=await serverModule('src/features/smart-textbook-runtime/server/published-native-activity-read.server.ts',{pg:pgStub});
export const profileModule=await serverModule('src/features/teaching-agent/profiles/student-ai-teacher.ts');
export async function setup(options={}){
 const h=harness();h.rows.learning_agent_script_nodes[0].configuration={};
 const run=execution(),locator=await h.pin({teachingSessionId:undefined});const checked=await h.runtime.selection.verify(locator,run);if(checked.status!=='ok')throw Error('TEST_ADMISSION');const binding=checked.data,s=binding.scope;
 const f=nativeCapture(),replacements={textbook:s.textbookId,version:s.textbookVersionId,chapter:s.chapterId,module:s.moduleId,catalogLesson:s.lessonId,app:s.appId,profile:s.agentProfileId,teachingLesson:s.teachingLessonId,script:s.scriptVersionId};
 let text=JSON.stringify(f.c);for(const [key,val]of Object.entries(replacements))text=text.replaceAll(f.id[key],val);text=text.replaceAll(f.c.learning_agent_script_nodes[0].id,s.nodeId);
 const capture=JSON.parse(text);capture.learning_agent_script_nodes[0].teacher_script=h.rows.learning_agent_script_nodes[0].teacher_script;
 const scope={textbookId:s.textbookId,versionId:s.textbookVersionId,chapterId:s.chapterId};
 const bundle=native.packageNativePublication(native.projectNativePublicationCapture(capture,scope),scope);
 const a=capture.digital_textbook_activities[0],past=new Date(Date.now()-10000).toISOString(),count=options.count??1;
 const rows={attempts:Array.from({length:count},(_,i)=>({id:uid(),activityId:a.id,attemptNumber:i+1,correct:i===count-1,score:i===count-1?100:0,createdAt:past})),progress:count?{tenant_id:s.tenantId,student_id:s.actorId,version_id:s.textbookVersionId,node_id:a.node_id,status:'completed',completion_percent:100,mastery_score:100,attempt_count:count,updated_at:past}:null};
 const transport={bundle,rows,identity:simulatedIdentity,fence:true,fail:false,queries:[],connections:0,filter:x=>x};globalThis.__r7dProductionTransport=transport;
 // Fixed production transport replaced at module boundary in this ISOLATED harness.
 // These wire specimens are not receipts of any actual current/published DB.
 process.env.NODE_ENV='production';process.env.UPLY_PUBLISHED_FACTS_DATABASE_URL='ISOLATED_TRANSPORT_STUB';process.env.UPLY_PUBLISHED_FACTS_DATABASE_IDENTITY=identityHash;
 const input={binding,domain:h.runtime,execution:run,skillRunId:uid(),profile:profileModule.createProductionStudentAiTeacherProfile()};
 if(options.edit)await options.edit(input,transport,h);
 const cap=options.noCompose?null:await composition.createProductionLessonExecutionCapabilities(input);
 const call=args=>({id:uid(),name:'get_current_lesson_execution_facts',arguments:JSON.stringify(args??{})});
 return {h,input,transport,cap,call,context:{...run,authority:binding.authority,skillRunId:input.skillRunId},submit:args=>cap.executeTool(call(args),uid())};
}
