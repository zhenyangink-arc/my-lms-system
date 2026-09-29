import {build} from 'esbuild';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export const uid=randomUUID;
// Local deterministic transport substitutions only. Never imports .env or accepts
// a current-DB endpoint. Positive production-wire specimens remain TEST evidence.
export async function serverModule(path,overrides={}){
 const result=await build({entryPoints:[path],bundle:true,write:false,platform:'node',format:'esm',packages:'external',logLevel:'silent',banner:{js:`import {createRequire as __cr} from 'node:module'; const require=__cr(${JSON.stringify(resolve('package.json'))});`},plugins:[{name:'isolated-boundaries',setup(b){
  b.onResolve({filter:/.*/},args=>{if(args.path==='server-only')return {path:'server-only',namespace:'isolated'};const code=overrides[args.path]??overrides[args.path.replace(/\.ts$/,'')];if(code!==undefined)return {path:args.path,namespace:'isolated',pluginData:code};if(args.path.startsWith('@/')){const base=resolve('src',args.path.slice(2));return {path:[base,base+'.ts',base+'.tsx',base+'/index.ts'].find(existsSync)??base};}});
  b.onLoad({filter:/.*/,namespace:'isolated'},args=>({contents:args.path==='server-only'?'':args.pluginData,loader:'ts',resolveDir:process.cwd()}));
 }}]});
 // Convert external bare imports to absolute file URLs for data: ESM loading.
 const code=result.outputFiles[0].text.replace(/from "([^".][^"]*)"/g,(match,p)=>p.startsWith('node:')?match:`from ${JSON.stringify('file://'+require.resolve(p))}`);
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
export const localized=t=>({'zh-CN':t,'ko-KR':t});
export function nativeCapture(count=1){
 const id=Object.fromEntries(['textbook','version','chapter','module','catalogLesson','app','profile','teachingLesson','script'].map(k=>[k,uid()]));
 const c=Object.fromEntries(['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','digital_textbook_nodes','digital_textbook_activities','digital_textbook_activity_secrets','digital_textbook_media_assets','digital_textbook_listening_tracks','learning_agent_lessons','learning_agent_profiles','learning_agent_profile_secrets','learning_agent_script_versions','learning_agent_script_nodes','learning_agent_node_interaction_secrets','learning_agent_script_audio_assets','chapter_tests'].map(k=>[k,[]]));
 c.digital_textbooks=[{id:id.textbook,lesson_id:id.catalogLesson,student_app_id:id.app,agent_profile_id:id.profile,slug:'isolated-native',title:localized('隔离教学'),status:'published'}];
 c.digital_textbook_versions=[{id:id.version,textbook_id:id.textbook,version_number:9,status:'published'}];
 c.digital_textbook_chapters=[{id:id.chapter,version_id:id.version,slug:'chapter-fixture',chapter_number:4,title:localized('章'),scenario:localized('情境'),goal:localized('目标'),status:'published',chapter_test_id:null}];
 c.digital_textbook_modules=[{id:id.module,chapter_id:id.chapter,sort_order:1}];
 c.learning_agent_profiles=[{id:id.profile,status:'published'}];
 c.learning_agent_lessons=[{id:id.teachingLesson,module_id:id.module,agent_profile_id:id.profile,status:'published'}];
 c.learning_agent_script_versions=[{id:id.script,lesson_id:id.teachingLesson,version_number:7,status:'published'}];
 for(let i=0;i<count;i++){const node=uid(),a=uid(),t=uid();
  c.digital_textbook_nodes.push({id:node,module_id:id.module,sort_order:i+1,node_type:'practice',content:{}});
  c.digital_textbook_activities.push({id:a,node_id:node,activity_key:`activity-${i}`,activity_type:'single_choice',prompt:localized('问题'),instruction:localized('选择'),options:['甲','乙','丙','丁'],public_config:{},max_attempts:5,counts_toward_completion:true});
  c.digital_textbook_activity_secrets.push({activity_id:a,answer_key:{kind:'index',value:2}});
  c.learning_agent_script_nodes.push({id:t,script_version_id:id.script,sort_order:i+1,node_key:`teaching-${i}`,node_type:'explanation',is_required:true,title:localized('教学'),teacher_script:localized('你好。'),reference_activity_id:a,configuration:{},action_type:'focus_activity',next_node_key:i<count-1?`teaching-${i+1}`:null,remediation_node_key:null,segments:[],video_mode:'legacy'});
 }
 return {id,c,scope:{textbookId:id.textbook,versionId:id.version,chapterId:id.chapter}};
}
