import assert from "node:assert/strict";
import test, { beforeEach, after } from "node:test";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ids = { node: "11111111-1111-4111-8111-111111111111", version: "22222222-2222-4222-8222-222222222222",
  activity: "33333333-3333-4333-8333-333333333333", lesson: "44444444-4444-4444-8444-444444444444",
  module: "55555555-5555-4555-8555-555555555555", app: "66666666-6666-4666-8666-666666666666", chapter: "77777777-7777-4777-8777-777777777777" };
let state;
const mocks = new Map([
  ["server-only", "export {};"],
  ["next/cache", "export const revalidatePath = (...args) => globalThis.__pilotEvents.push(['revalidate',...args]);"],
  ["next/navigation", "export function notFound(){throw new Error('notFound')}"],
  ["next/server", "export const NextResponse = { json: (value, options) => Response.json(value, options) };"],
  ["@/lib/admin", "export const requirePlatformOwner = () => globalThis.__pilotOwner(); export const isPlatformOwnerRole = role => role === 'platform_owner';"],
  ["@/lib/auth", "export const getAuthContext = async () => ({status:'active',profile:{role:'platform_owner'}});"],
  ["@/lib/supabase/admin", "export const createAdminClient = () => globalThis.__pilotDB;"],
  ["@/lib/r2", "export const checkR2ObjectExists = key => globalThis.__pilotR2(key); export const listR2Objects = async () => ({objects:[],isTruncated:false}); export const createR2SignedObjectUrl = async () => {throw new Error('forbidden signed URL')};"],
  ["@/features/learning-agent-script-studio/selected-video-asset.server", "export const getSelectedVideoAssetInfo = () => globalThis.__pilotLocal();"],
  ["@/lib/learning-agent-script-runtime", "export const configuredText = () => {throw new Error('forbidden configuredText')}; export const virtualCharacterForScriptSegment = () => {throw new Error('forbidden character')}; export const headerJson = JSON.stringify; export const petAction = () => null; export const resolveScriptCharacter = () => {throw new Error('forbidden character')}; export const resolveScriptStep = () => {throw new Error('forbidden resolver')}; export class ScriptStepValidationError extends Error {}; export const scriptSegmentAutoContinues=()=>false; export const scriptSegmentLearningLayout=()=>''; export const taskEventKey=()=>''; export const teacherScriptSegments=()=>[]; export const upcomingScriptNodeBufferLine=()=>null; export const upcomingScriptNode=()=>null; export const resolveBufferLineSpeechAssetId=()=>null; export const visualCue=()=>null;"],
  ["@/lib/learning-agent-preview-state", "export const decodePreviewState=()=>{throw new Error('forbidden decode')}; export const encodePreviewState=()=>{throw new Error('forbidden encode')};"],
  ["@/lib/learning-agent-buffer-selection.server", "export const BUFFER_CANDIDATE_COLUMNS='id'; export const selectBufferSpeechIds=()=>{throw new Error('forbidden buffer')};"],
  ["@/lib/smart-digital-textbook", "export const loadSmartDigitalTextbook=()=>{throw new Error('forbidden textbook')};"],
  ["@/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/SmartTextbookShell", "export const SmartTextbookShell=()=>{throw new Error('forbidden shell')};"],
]);
globalThis.__pilotEvents = [];
globalThis.__pilotOwner = async () => { state.events.push("owner"); if (state.ownerError) throw new Error("denied"); return { user:{id:ids.node}, supabase: {rpc: rpc} }; };
globalThis.__pilotR2 = async (key) => { state.events.push("r2"); if (state.r2Error) throw new Error("private provider details"); return state.r2 ?? {exists:true,size:123,contentType:"video/mp4"}; };
globalThis.__pilotLocal = async () => { state.events.push("local"); if (state.localError) throw new Error("/private/local/path"); return {assetId:"course-video-sample01",videoDurationSeconds:30}; };
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (mocks.has(specifier)) return {url:`pilot-mock:${encodeURIComponent(specifier)}`,shortCircuit:true};
    if (specifier === "./service" && context.parentURL?.endsWith("release-check-actions.ts")) return {url:"pilot-service:studio",shortCircuit:true};
    if (specifier.startsWith("@/")) specifier = pathToFileURL(resolve(root,"src",specifier.slice(2))).href;
    if (specifier.startsWith("file:") || (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))) {
      const url = new URL(specifier, context.parentURL); const path=fileURLToPath(url);
      if (!existsSync(path)) for (const extension of [".ts",".tsx"]) if (existsSync(path+extension)) return {url:pathToFileURL(path+extension).href,shortCircuit:true};
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("pilot-mock:")) return {format:"module",source:mocks.get(decodeURIComponent(url.slice(11))),shortCircuit:true};
    if (url.startsWith("pilot-service:")) return {format:"module",source:"export const getTeachingScriptStudioData=async()=>globalThis.__pilotStudio;",shortCircuit:true};
    if (url.startsWith(pathToFileURL(resolve(root,"src")).href) && /\.tsx?$/.test(url)) return {format:"module",source:ts.transpileModule(readFileSync(fileURLToPath(url),"utf8"),{
      compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},fileName:fileURLToPath(url),
    }).outputText,shortCircuit:true};
    return next(url,context);
  },
});
after(()=>hooks.deregister());
const {createEmptyVideoPilotDraft}=await import("../src/features/learning-agent-script-studio/video-pilot-authoring.ts");
const {saveVideoPilotNode}=await import("../src/features/learning-agent-script-studio/video-pilot-save.server.ts");
const {saveTeachingScriptNodeAction,publishTeachingScriptAction}=await import("../src/app/dashboard/admin/teaching-scripts/actions.ts");
const {POST}=await import("../src/app/api/learning-agent/preview-respond/route.ts");
const {default:previewPage}=await import("../src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview/page.tsx");
const {inspectChapterRelease}=await import("../src/features/learning-agent-script-studio/release-check-actions.ts");

function defaultNode() { return {id:ids.node,script_version_id:ids.version,node_key:"first",node_type:"opening",title:{"zh-CN":"原标题"},teacher_script:{"zh-CN":"原台词"},
  configuration:{teacherVideo:{mode:"legacy"},virtualCharacter:{kind:"old"},scriptPerformances:[{pose:"greeting"}],display:{kind:"overview"},custom:{preserved:true}},
  reference_activity_id:null,action_type:"none",next_node_key:"next",remediation_node_key:null,is_required:false,updated_at:"original-token",
  learning_agent_script_versions:{lesson_id:ids.lesson,status:"draft"}}; }
function result(table) {
  state.events.push(table);
  if (state.queryError === table) return {data:null,error:{message:"query failed"}};
  if (table === "learning_agent_script_nodes") {
    const data = state.nodeSequence?.shift() ?? state.nodes ?? state.current;
    return {data,error:null,count:state.nodeCount ?? (Array.isArray(data) ? data.length : 1)};
  }
  if (table === "learning_agent_node_interaction_secrets") return {data:state.secrets,error:null};
  if (table === "learning_agent_lessons") return {data:state.lesson ?? {module_id:ids.module},error:null};
  if (table === "digital_textbook_activities") return {data:state.activity === undefined ? {node_id:ids.node,activity_type:"single_choice"}:state.activity,error:null};
  if (table === "digital_textbook_nodes") return {data:state.sourceNode === undefined ? {module_id:ids.module}:state.sourceNode,error:null};
  if (table === "learning_agent_script_versions") return {data:{id:ids.version},error:null};
  if (table === "learning_agent_publish_logs") return {data:null,error:null};
  throw new Error(`unexpected mock table ${table}`);
}
globalThis.__pilotDB = {from(table) { const query={}; for(const key of ["select","eq","order","limit","insert","or","not"])
  query[key]=(...args)=>{state.queryCalls.push({table,key,args});return query;};
  query.maybeSingle=async()=>result(table); query.then=(fulfilled,rejected)=>Promise.resolve(result(table)).then(fulfilled,rejected);return query; }};
async function rpc(name,args) {
  state.events.push(name); state.rpcCalls.push({name,args});
  if (name === "teaching_script_publish_snapshot") return {data:{token:"snapshot-token",nodes:state.nodes},error:null};
  if (name === "save_teaching_script_node_atomic") {
    if(state.rpcError)return {error:state.rpcError};
    state.saved=JSON.parse(JSON.stringify(args));return {error:null};
  }
  if (name === "publish_teaching_script_checked") return {error:null};
  throw new Error(`unexpected RPC ${name}`);
}
beforeEach(()=> { state={current:defaultNode(),secrets:[],events:[],rpcCalls:[],queryCalls:[]}; globalThis.__pilotEvents=[]; });
function form(draft=createEmptyVideoPilotDraft(),intent="enable") { const form=new FormData();form.set("node_id",ids.node);form.set("node_updated_at","original-token");
  form.set("return_to","/platform/dashboard/admin/apps/korean/teaching-scripts");form.set("video_pilot_intent",intent);form.set("video_pilot_json",JSON.stringify(draft));return form; }
const dependencies=()=>({db:globalThis.__pilotDB,inspectLocal:globalThis.__pilotLocal,checkR2:globalThis.__pilotR2,saveAtomic:args=>rpc("save_teaching_script_node_atomic",args)});
const save=(posted)=>saveVideoPilotNode(posted,dependencies());
const local=()=>({...createEmptyVideoPilotDraft(),media:{kind:"selected-local",assetId:"course-video-sample01",state:"pending-ingestion"}});
const full=()=>({...local(),cue:{id:"pause-1",atSeconds:12.5,activityId:ids.activity}});
const assertRejected=async(posted)=>{const value=await save(posted);assert.equal(value.status,"error");assert.equal(state.rpcCalls.length,0);return value;};

test("actual action partial save preserves exact JSON, original columns, dormant fields and no answers",async()=>{
  const original=structuredClone(state.current);const posted=form();
  const value=await saveTeachingScriptNodeAction({status:"idle"},posted);assert.equal(value.status,"success");
  const saved=state.saved.p_node;assert.deepEqual(saved.configuration,{...original.configuration,videoPilot:createEmptyVideoPilotDraft()});
  for(const key of ["node_key","title","teacher_script","next_node_key","remediation_node_key","is_required"])assert.deepEqual(saved[key],original[key]);
  assert.equal(saved.reference_activity_id,null);assert.equal(saved.node_type,"explanation");assert.equal(saved.action_type,"none");assert.equal(state.saved.p_secret,null);
  assert.equal(state.saved.p_expected_updated_at,"original-token");assert.ok(globalThis.__pilotEvents.some(([event])=>event==="revalidate"));
  assert.deepEqual(state.queryCalls.find(call=>call.table==="learning_agent_node_interaction_secrets"&&call.key==="select").args,["node_id"]);
  assert.ok(!JSON.stringify(state.saved).includes("correct_option"));
});
test("full save synchronizes reference and mock JSON readback/reload",async()=>{
  assert.equal((await save(form(full()))).status,"success");
  const readback=JSON.parse(JSON.stringify(state.saved.p_node));assert.equal(readback.reference_activity_id,ids.activity);assert.equal(readback.node_type,"question");assert.equal(readback.action_type,"focus_activity");
  state.current={...state.current,...readback,updated_at:"new-token"};const posted=form(full(),"save");posted.set("node_updated_at","new-token");
  assert.equal((await save(posted)).status,"success");assert.deepEqual(state.saved.p_node.configuration.videoPilot,full());
});
test("explicit enable/save intent matrix never permits legacy bypass or reset",async()=>{
  for(const stored of [undefined,createEmptyVideoPilotDraft()])for(const intent of [undefined,"enable","save","legacy"]) {
    state.current=defaultNode();state.rpcCalls=[];if(stored!==undefined)state.current.configuration.videoPilot=stored;
    const posted=form();if(intent===undefined){posted.delete("video_pilot_intent");posted.delete("video_pilot_json");}else posted.set("video_pilot_intent",intent);
    const value=await save(posted);const allowed=stored===undefined?intent==="enable":intent==="save";
    if(stored===undefined&&intent===undefined)assert.equal(value,null);else assert.equal(value.status,allowed?"success":"error");
  }
});
test("every persisted malformed marker refuses actual action before legacy normalization",async()=>{
  for(const marker of [null,false,[],{},"encoded",{contract:"unknown"}]){state.current.configuration.videoPilot=marker;state.rpcCalls=[];
    const posted=form();posted.delete("video_pilot_intent");posted.delete("video_pilot_json");
    assert.equal((await saveTeachingScriptNodeAction({status:"idle"},posted)).status,"error");assert.equal(state.rpcCalls.length,0);}
});
test("duplicate, File, missing fields and forged metadata reject without RPC",async()=>{
  for(const name of ["node_id","node_updated_at","video_pilot_intent","video_pilot_json"]){
    const posted=form();posted.append(name,String(posted.get(name)));await assertRejected(posted);
    const file=form();file.set(name,new Blob(["bad"]),"bad.txt");await assertRejected(file);
    const missing=form();missing.delete(name);await assertRejected(missing);
  }
  for(const key of ["duration","sha256","activityRevision","answers","receipt"]){await assertRejected(form({...full(),[key]:"forged"}));}
});
test("stale token and non-draft fail before media and late CAS fails truthfully",async()=>{
  state.current.updated_at="changed";await assertRejected(form(full()));assert.ok(!state.events.includes("local"));
  state.current.updated_at="original-token";state.current.learning_agent_script_versions.status="published";await assertRejected(form(full()));assert.ok(!state.events.includes("local"));
  state.current.learning_agent_script_versions.status="draft";state.rpcError={code:"P0001",message:"CAS failed"};assert.equal((await save(form(full()))).status,"error");assert.equal(state.saved,undefined);
});
test("inline interaction/private secret/student task conversion rejects without deleting secret",async()=>{
  for(const config of [{interaction:{kind:"single_choice",options:["a","b"]}},{interaction:{kind:"unknown"}},{studentTask:{kind:"play_expression_audio"}},{studentTask:{kind:"unknown"}}]){
    state.current=defaultNode();Object.assign(state.current.configuration,config);await assertRejected(form(full()));}
  state.current=defaultNode();state.secrets=[{node_id:ids.node}];await assertRejected(form());assert.equal(state.secrets.length,1);
});
test("missing/wrong type/module/association/query error Activity fails before media/RPC",async()=>{
  for(const [property,value] of [["activity",null],["activity",{node_id:ids.node,activity_type:"multiple_choice"}],["sourceNode",null],["sourceNode",{module_id:"wrong"}],["lesson",{}]]){
    delete state.activity;delete state.sourceNode;delete state.lesson;state[property]=value;await assertRejected(form(full()));assert.ok(!state.events.includes("local"));}
  delete state.lesson;for(const table of ["learning_agent_script_nodes","learning_agent_node_interaction_secrets","learning_agent_lessons","digital_textbook_activities","digital_textbook_nodes"]){
    state.queryError=table;await assertRejected(form(full()));}
});
test("local hash availability and R2 HEAD rejection keep draft unverified",async()=>{
  state.localError=true;const error=await assertRejected(form(local()));assert.ok(!JSON.stringify(error).includes("/private"));
  const library={...createEmptyVideoPilotDraft(),media:{kind:"r2-library",objectKey:"teacher-video/demo.mp4",title:"素材",state:"unverified"}};
  for(const media of [{exists:false,size:12},{exists:true,size:0},{exists:true,size:12,contentType:"text/html"}]){state.r2=media;await assertRejected(form(library));}
  state.r2={exists:true,size:12,contentType:"application/octet-stream"};assert.equal((await save(form(library))).status,"success");assert.equal(state.saved.p_node.configuration.videoPilot.media.state,"unverified");
});
test("legacy helper returns original path and real legacy action reaches original atomic save",async()=>{
  const posted=form();posted.delete("video_pilot_intent");posted.delete("video_pilot_json");assert.equal(await save(posted),null);
  const fields={node_key:"first",node_type:"explanation",title_zh:"原标题",script_zh:"原台词",buffer_preset_id:"none",interaction_kind:"none",student_task_kind:"none",flow_mode:"sequence"};
  for(const [key,value]of Object.entries(fields))posted.set(key,value);
  const value=await saveTeachingScriptNodeAction({status:"idle"},posted);assert.equal(value.status,"success",JSON.stringify(value));assert.equal(state.rpcCalls.at(-1).name,"save_teaching_script_node_atomic");assert.equal(Object.hasOwn(state.saved.p_node.configuration,"videoPilot"),false);
});
test("legacy action rechecks marker after its early no-marker dispatch read",async()=>{
  const later=structuredClone(state.current);later.configuration.videoPilot=null;state.nodeSequence=[structuredClone(state.current),later];
  const posted=form();posted.delete("video_pilot_intent");posted.delete("video_pilot_json");
  for(const[key,value]of Object.entries({node_key:"first",node_type:"explanation",title_zh:"原标题",script_zh:"原台词",buffer_preset_id:"none",interaction_kind:"none",student_task_kind:"none",flow_mode:"sequence"}))posted.set(key,value);
  assert.equal((await saveTeachingScriptNodeAction({status:"idle"},posted)).status,"error");assert.equal(state.rpcCalls.length,0);
});
test("publication scans every snapshot node including malformed later marker before media/publish",async()=>{
  for(const marker of [null,{},createEmptyVideoPilotDraft()]){state.nodes=[{node_key:"first",configuration:{teacherVideo:{mode:"legacy"}}},{node_key:"later",configuration:{videoPilot:marker}}];state.rpcCalls=[];
    const posted=new FormData();posted.set("version_id",ids.version);posted.set("change_note","");const value=await publishTeachingScriptAction(posted);
    assert.equal(value.ok,false);assert.equal(value.nodeKey,"later");assert.deepEqual(state.rpcCalls.map(call=>call.name),["teaching_script_publish_snapshot"]);assert.ok(!state.events.includes("r2"));}
});
test("preview API blocks all nodes before decode/resolver despite legacy startNodeKey",async()=>{
  for(const marker of [null,{},createEmptyVideoPilotDraft()]){state.nodes=[{node_key:"first",configuration:{}},{node_key:"later",configuration:{videoPilot:marker}}];
    const response=await POST(new Request("http://fixture/preview",{method:"POST",body:JSON.stringify({scriptVersionId:ids.version,intent:"start",locale:"zh-CN",startNodeKey:"first",sessionToken:"forged"})}));
    assert.equal(response.status,409);assert.equal(response.headers.has("X-Learning-Agent-Character"),false);assert.equal(response.headers.has("X-Learning-Agent-Teacher-Video"),false);}
});
test("full preview page blocks before character/buffer/textbook/shell and fails closed on query error",async()=>{
  state.nodes=[{id:ids.node,configuration:{}},{id:ids.node,configuration:{videoPilot:null}}];
  const props={params:Promise.resolve({space:"platform",appSlug:"korean"}),searchParams:Promise.resolve({scriptVersionId:ids.version,startNodeKey:"first"})};
  const blocked=await previewPage(props);assert.match(JSON.stringify(blocked),/待正式接入/);assert.deepEqual(state.events,["owner","learning_agent_script_nodes"]);
  state.queryError="learning_agent_script_nodes";assert.match(JSON.stringify(await previewPage(props)),/无法完整读取/);
});
test("both preview entry points refuse truncated node results and API query errors",async()=>{
  state.nodes=[{node_key:"first",configuration:{}}];state.nodeCount=2;
  const request=()=>new Request("http://fixture/preview",{method:"POST",body:JSON.stringify({scriptVersionId:ids.version,intent:"start",locale:"zh-CN",startNodeKey:"first"})});
  assert.equal((await POST(request())).status,409);
  const props={params:Promise.resolve({space:"platform",appSlug:"korean"}),searchParams:Promise.resolve({scriptVersionId:ids.version,startNodeKey:"first"})};
  assert.match(JSON.stringify(await previewPage(props)),/无法完整读取/);
  state.queryError="learning_agent_script_nodes";assert.equal((await POST(request())).status,409);
});
test("release reports draft/published pilot blocked and never treats dormant legacy media as ready",async()=>{
  for(const status of ["draft","published"]){globalThis.__pilotStudio={modules:[{chapterId:ids.chapter,textbookStatus:"published",chapterStatus:"published",textbookVersion:{status:"published",number:1},practiceStatus:"linked",
    versions:[{status,sourceReviewStatus:"reviewed",nodes:[{configuration:{videoPilot:null,teacherVideo:{mode:"video"}},script:{}}]}]}]};
    const report=await inspectChapterRelease({appId:ids.app,chapterId:ids.chapter});assert.ok(report.checks.some(check=>check.label==="视频暂停题接入"&&check.state==="blocked"));assert.ok(!state.events.includes("r2"));
    assert.ok(!report.checks.some(check=>check.label==="视频文件读取"&&check.state==="ready"));}
});
