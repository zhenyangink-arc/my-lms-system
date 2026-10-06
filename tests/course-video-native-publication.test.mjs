import test from 'node:test';
import assert from 'node:assert/strict';
import { serverModule, nativeCapture, uid } from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
const native = await serverModule('src/lib/smart-textbook-publishing/native-video-publication.server.ts');
const artifact = await serverModule('src/lib/smart-textbook-publishing/artifact.server.ts');
const { digest } = await serverModule('src/lib/smart-textbook-legacy-adapter/identity.server.ts');
const { validateLessonManifestV1 } = await serverModule('src/lib/smart-textbook-runtime-v1/validator.ts');
// All cue times, IDs, author approvals and answers below are SYNTHETIC TEST ONLY.
export function videoFixture() {
 const f=nativeCapture(),t=f.c.learning_agent_script_nodes[0];
 t.sort_order=3;
 t.configuration={videoPilotPublication:{contract:'video-pilot-publication-source/1',mode:'video',state:'promoted',origin:{teachingNodeId:uid(),scriptVersionId:uid(),draftDigest:'a'.repeat(64)},approvedBy:uid(),approvedAt:'2026-10-05T00:00:00.000Z',
  media:{adapter:'fixed-selected-host/1',assetId:'course-video-sample01',sha256:'68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe',sizeBytes:5487747,mime:'video/mp4',videoDurationSeconds:30,containerDurationSeconds:30.016,revision:'media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe'},cue:{id:'pause-1',atSeconds:12.5,activityId:t.reference_activity_id},captions:null}};
 return f;
}
export function compileVideo(f=videoFixture()){return native.packageNativeVideoPublication(native.projectNativeVideoPublicationCapture(f.c,f.scope),f.scope);}
export function resign(b){
 const {snapshot,...semantic}=b.manifest;snapshot.contentDigest=`sha256:${digest(semantic)}`;b.manifestDigest=snapshot.contentDigest;
 b.privatePayload.result.manifest=structuredClone(b.manifest);b.privateDigest=digest(b.privatePayload);delete b.seal;b.seal=digest(b);return b;
}
test('video official certifier roundtrip uses actual script and node, without historical 5/7 fabrication',()=>{
 const b=compileVideo();assert.equal(artifact.assertPublishableSnapshot(b).revision,'publish-foundation/3');assert.equal(b.manifest.execution.scriptVersion,7);assert.equal(b.manifest.execution.sourceNodes.length,1);assert.equal(b.manifest.execution.sourceNodes[0].nodeNumber,3);assert.equal(b.manifest.execution.cues[0].triggerTime,12.5);assert.equal(b.manifest.steps.length,1);
 assert.throws(()=>artifact.requireLegacyPublication(b));assert.throws(()=>artifact.draftFromSnapshot(b),/NATIVE_VIDEO_RELEASE_REQUIRES_NEW_VERSION/);assert.equal(artifact.requireNativeVideoPublication(b).snapshotId,b.snapshotId);
 const publicText=JSON.stringify(b.manifest);for(const s of ['approvedBy','draftDigest','answer_key','teacher_script','5487747','/home/','videoPilotPublication'])assert.equal(publicText.includes(s),false,s);
});
const promoted=f=>f.c.learning_agent_script_nodes[0].configuration.videoPilotPublication;
for(const key of ['contract','mode','state','origin','approvedBy','approvedAt','media','cue','captions'])test('missing promoted '+key,()=>{const f=videoFixture();delete promoted(f)[key];assert.throws(()=>compileVideo(f));});
for(const [name,mutate] of [
 ['draft configuration',f=>{f.c.learning_agent_script_nodes[0].configuration={videoPilot:{}};}],
 ['unknown configuration',f=>{f.c.learning_agent_script_nodes[0].configuration.extra=true;}],
 ['unknown source',f=>{promoted(f).extra=true;}],['unknown origin',f=>{promoted(f).origin.secret='x';}],['unknown cue',f=>{promoted(f).cue.answer=1;}],['proof path',f=>{promoted(f).media.path='/tmp/a';}],
 ['wrong hash',f=>{promoted(f).media.sha256='b'.repeat(64);}],['wrong size',f=>{promoted(f).media.sizeBytes++;}],['wrong duration',f=>{promoted(f).media.videoDurationSeconds=31;}],
 ['end cue',f=>{promoted(f).cue.atSeconds=30;}],['negative cue',f=>{promoted(f).cue.atSeconds=-1;}],['nonfinite cue',f=>{promoted(f).cue.atSeconds=Infinity;}],['foreign activity cue',f=>{promoted(f).cue.activityId=uid();}],
 ['wrong activity graph',f=>{f.c.digital_textbook_activities[0].node_id=uid();}],['wrong module',f=>{f.c.learning_agent_lessons[0].module_id=uid();}],['wrong profile',f=>{f.c.learning_agent_lessons[0].agent_profile_id=uid();}],['wrong subject',f=>{f.c.learning_agent_profiles[0].subject='math';f.c.digital_textbooks[0].subject='korean';}],
 ['extra node',f=>{f.c.digital_textbook_nodes.push({...f.c.digital_textbook_nodes[0],id:uid()});}],['secret missing',f=>{f.c.digital_textbook_activity_secrets=[];}],['secret out of range',f=>{f.c.digital_textbook_activity_secrets[0].answer_key.value=4;}],['secret fraction',f=>{f.c.digital_textbook_activity_secrets[0].answer_key.value=1.5;}],['secret extra key',f=>{f.c.digital_textbook_activity_secrets[0].answer_key.extra=true;}],
 ['anonymous option',f=>{f.c.digital_textbook_activities[0].options[0]={};}],['unknown setting',f=>{f.c.digital_textbook_activities[0].public_config.answer=2;}],['uncounted',f=>{f.c.digital_textbook_activities[0].counts_toward_completion=false;}],['branch',f=>{f.c.learning_agent_script_nodes[0].next_node_key='next';}],
 ...['required_speech','required_listening','video_url','audio_asset_id','interaction','segments'].map(k=>[k,f=>{f.c.learning_agent_script_nodes[0][k]=k==='segments'?[{}]:'unsupported';}]),
])test('video capture rejects '+name,()=>{const f=videoFixture();mutate(f);assert.throws(()=>compileVideo(f));});
for(const [name,mutate] of [
 ['mixed execution',b=>{b.manifest.execution.contract='native-execution/1';}],['mixed compiler',b=>{b.compilerVersion='native-publication-1';}],['mixed private',b=>{b.privatePayload.contract='canonical-native-publication/1';}],
 ['cue',b=>{b.manifest.execution.cues[0].triggerTime=9;}],['title',b=>{b.manifest.steps[0].title={'zh-CN':'altered'};}],['prompt',b=>{b.manifest.activityRefs[0].publicPresentation.prompt={'zh-CN':'altered'};}],['instruction',b=>{b.manifest.activityRefs[0].publicPresentation.instruction={'zh-CN':'altered'};}],['option',b=>{b.manifest.activityRefs[0].publicPresentation.options[0].text={'zh-CN':'altered'};}],['setting',b=>{b.manifest.activityRefs[0].publicPresentation.settings.shuffle=true;}],['private binding',b=>{b.privatePayload.bindings[0].activityAlias='altered';}],['source',b=>{b.privatePayload.source.teachingNodes[0].title={'zh-CN':'altered'};}],['duration',b=>{b.manifest.execution.media[0].durationSeconds=31;}],['capability',b=>{b.manifest.requiredCapabilities.push('block.text');}],
])test('fully re-signed semantic tampering rejected: '+name,()=>{const b=compileVideo();mutate(b);assert.throws(()=>artifact.validateSnapshotBundle(resign(b)));});
test('private policies change private seal/source capture but never public digest',()=>{const f=videoFixture(),a=compileVideo(f);f.c.digital_textbook_activity_secrets[0].answer_key.value=1;const b=compileVideo(f);assert.equal(a.manifestDigest,b.manifestDigest);assert.notEqual(a.sourceRevision,b.sourceRevision);assert.notEqual(a.privateDigest,b.privateDigest);assert.notEqual(a.pins.captureDigest,b.pins.captureDigest);});
test('every public activity semantic input contributes to revision',()=>{const f=videoFixture(),a=compileVideo(f);f.c.digital_textbook_activities[0].max_attempts++;assert.notEqual(a.privatePayload.bindings[0].activityRevision,compileVideo(f).privatePayload.bindings[0].activityRevision);});
test('execution rejects end-of-video cue independently of envelope',()=>{const b=compileVideo();b.manifest.execution.cues[0].triggerTime=30;assert.equal(validateLessonManifestV1(b.manifest).success,false);});

test('publisher owner, real fixed boundary, one capture and original CAS',async()=>{
 const f=videoFixture();globalThis.__video17={f,owner:true,calls:[],failMedia:false};
 try{
 const p=await serverModule('src/lib/smart-textbook-publishing/publisher.server.ts',{
  '../auth':`export async function requireActiveUser(){const s=globalThis.__video17;s.calls.push('owner');return {profile:{global_role:s.owner?'platform_owner':'student'},user:{id:'owner-fixture'}};}`,
  '../supabase/admin':`export function createAdminClient(){return {async rpc(name,args){const s=globalThis.__video17;s.calls.push({name,args});if(name==='capture_runtime_publication_v1')return {data:s.f.c,error:null};if(name==='publish_runtime_snapshot_v2')return {data:{snapshotId:args.p_bundle.snapshotId,generation:8},error:null};throw Error('unexpected RPC');}};}`,
  './fixed-selected-media.server.ts':`export async function readFixedSelectedVideoSnapshot(){const s=globalThis.__video17;s.calls.push('media');if(s.failMedia)throw Error('FIXED_MEDIA_BYTES');return {};}`,
 });
 const state=globalThis.__video17;state.owner=false;await assert.rejects(p.compileNativeVideoPublication(f.scope),/OWNER/);assert.deepEqual(state.calls,['owner']);
 state.owner=true;state.failMedia=true;state.calls=[];await assert.rejects(p.compileNativeVideoPublication(f.scope),/FIXED_MEDIA_BYTES/);assert.deepEqual(state.calls,['owner','media']);
 state.failMedia=false;state.calls=[];const expected={snapshotId:'prior-fixture',generation:7};await p.publishNativeVideoPublication(f.scope,expected);
 assert.equal(state.calls.filter(x=>x.name==='capture_runtime_publication_v1').length,1);const write=state.calls.find(x=>x.name==='publish_runtime_snapshot_v2');assert.deepEqual(write.args.p_expected,expected);assert.equal(write.args.p_bundle.revision,'publish-foundation/3');assert.equal(state.calls[0],'owner');assert.equal(state.calls[1],'media');
 }finally{delete globalThis.__video17;}
});

test('fixed selected bytes are verified from one bounded descriptor, never caller paths',async()=>{
 const {constants}=await import('node:fs');
 globalThis.__fixed17={mode:'symlink',opened:0,closed:0};
 try {
 const fixed=await serverModule('src/lib/smart-textbook-publishing/fixed-selected-media.server.ts',{
  'node:fs/promises':`export async function realpath(p){return globalThis.__fixed17.mode==='symlink'?'/tmp/other':p;}
   export async function open(path,flags){const s=globalThis.__fixed17;s.opened++;s.flags=flags;s.path=path;return {
    async stat(){return {isFile:()=>s.mode!=='directory',size:s.mode==='size'?1:5487747,mtimeMs:1,ctimeMs:1};},
    async read(buffer,offset,length,position){if(s.mode==='truncated')return {bytesRead:0};if(position===5487747)return {bytesRead:s.mode==='extra'?1:0};buffer.fill(0,offset,offset+length);if(s.mode==='abort')s.abort.abort();return {bytesRead:length};},
    async close(){s.closed++;}
   };}`,
 });
 const s=globalThis.__fixed17;
 await assert.rejects(fixed.readFixedSelectedVideoSnapshot(),/FIXED_MEDIA_PATH/);assert.equal(s.opened,0);
 for(const [mode,error] of [['directory','SIZE'],['size','SIZE'],['truncated','TRUNCATED'],['extra','BYTES'],['same-size-wrong-hash','BYTES']]){
  s.mode=mode;const closed=s.closed;await assert.rejects(fixed.readFixedSelectedVideoSnapshot(),new RegExp('FIXED_MEDIA_'+error));assert.equal(s.closed,closed+1);assert.ok(s.flags&constants.O_NOFOLLOW);
 }
 s.mode='abort';s.abort=new AbortController();const closed=s.closed;await assert.rejects(fixed.readFixedSelectedVideoSnapshot(s.abort.signal),{name:'AbortError'});assert.equal(s.closed,closed+1);
 const opened=s.opened;await assert.rejects(fixed.readFixedSelectedVideoSnapshot(s.abort.signal),{name:'AbortError'});assert.equal(s.opened,opened);
 }finally{delete globalThis.__fixed17;}
});

// Shared TEST-ONLY domain matrix; authoritative validators never import test fixtures.
export const approvalTimestampValid = [
 '0001-01-01T00:00:00.000Z', '0004-02-29T00:00:00.001Z',
 '1900-02-28T23:59:59.999Z', '2000-02-29T12:34:56.789Z',
 '2024-02-29T12:34:56.000Z', '2026-04-30T23:59:59.999Z',
 '2026-10-05T00:00:00.000Z', '9999-12-31T23:59:59.999Z',
];
export const approvalTimestampInvalid = [
 ['minutes only','2026-10-05T00:00Z'], ['no fraction','2026-10-05T00:00:00Z'],
 ['one fraction digit','2026-10-05T00:00:00.0Z'], ['two fraction digits','2026-10-05T00:00:00.00Z'], ['four fraction digits','2026-10-05T00:00:00.0000Z'],
 ['year zero','0000-01-01T00:00:00.000Z'], ['early nonleap year','0001-02-29T00:00:00.000Z'],
 ['nonleap century 1900','1900-02-29T00:00:00.000Z'], ['nonleap century 2100','2100-02-29T00:00:00.000Z'],
 ['nonleap year','2026-02-29T00:00:00.000Z'], ['February day 30','2024-02-30T00:00:00.000Z'], ['April day 31','2026-04-31T00:00:00.000Z'],
 ['month zero','2026-00-05T00:00:00.000Z'], ['month 13','2026-13-05T00:00:00.000Z'], ['day zero','2026-10-00T00:00:00.000Z'],
 ['hour 24','2026-10-05T24:00:00.000Z'], ['minute 60','2026-10-05T00:60:00.000Z'], ['second 60','2026-10-05T00:00:60.000Z'],
 ['UTC offset','2026-10-05T00:00:00.000+00:00'], ['lowercase t','2026-10-05t00:00:00.000Z'], ['lowercase z','2026-10-05T00:00:00.000z'],
 ['space separator','2026-10-05 00:00:00.000Z'], ['leading space',' 2026-10-05T00:00:00.000Z'], ['trailing space','2026-10-05T00:00:00.000Z '], ['terminal newline','2026-10-05T00:00:00.000Z\n'],
 ['signed year','+002026-10-05T00:00:00.000Z'], ['extended year','10000-10-05T00:00:00.000Z'], ['non-ASCII digit','２０26-10-05T00:00:00.000Z'],
 ['null',null], ['number',1791158400000], ['missing',undefined],
];
const {nativeVideoSourceSchema}=await serverModule('src/lib/smart-textbook-publishing/native-video-source.server.ts');
for(const value of approvalTimestampValid)test('approvedAt exact schema/compiler/certifier roundtrip '+value,()=>{
 const f=videoFixture();promoted(f).approvedAt=value;
 assert.equal(nativeVideoSourceSchema.parse(promoted(f)).approvedAt,value);
 const b=compileVideo(f),certified=artifact.requireNativeVideoPublication(b);
 for(const candidate of [b,certified]){
  assert.equal(candidate.privatePayload.source.teachingNodes[0].configuration.videoPilotPublication.approvedAt,value);
  assert.equal(candidate.privatePayload.dependencies.learning_agent_script_nodes[0].configuration.videoPilotPublication.approvedAt,value);
 }
});
for(const [name,value] of approvalTimestampInvalid)test('approvedAt rejects '+name+' in schema/compiler and re-signed certifier',()=>{
 const f=videoFixture(),b=compileVideo(f),replace=s=>{if(value===undefined)delete s.approvedAt;else s.approvedAt=value;};
 replace(promoted(f));
 const dateError=e=>e.issues?.some(issue=>issue.path.includes('approvedAt'))===true;
 assert.throws(()=>nativeVideoSourceSchema.parse(promoted(f)),dateError);
 assert.throws(()=>compileVideo(f),dateError);
 replace(b.privatePayload.dependencies.learning_agent_script_nodes[0].configuration.videoPilotPublication);
 replace(b.privatePayload.source.teachingNodes[0].configuration.videoPilotPublication);
 assert.throws(()=>artifact.validateSnapshotBundle(resign(b)),dateError);
});
