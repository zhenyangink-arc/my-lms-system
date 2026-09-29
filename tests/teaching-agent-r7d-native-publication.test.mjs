import test from 'node:test';import assert from 'node:assert/strict';
import {serverModule,nativeCapture,uid} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
const native=await serverModule('src/lib/smart-textbook-publishing/native-publication.server.ts');
const artifact=await serverModule('src/lib/smart-textbook-publishing/artifact.server.ts');
const {digest}=await serverModule('src/lib/smart-textbook-legacy-adapter/identity.server.ts');
function compile(f=nativeCapture()){return native.packageNativePublication(native.projectNativePublicationCapture(f.c,f.scope),f.scope);}
const reseal=b=>{b.privateDigest=digest(b.privatePayload);delete b.seal;b.seal=digest(b);return b;};
for(const [name,modify]of [
 ['missing explicit association',f=>{f.c.learning_agent_script_nodes[0].reference_activity_id=null;}],
 ['duplicate association',f=>{f.c.learning_agent_script_nodes.push({...f.c.learning_agent_script_nodes[0],id:uid(),node_key:'duplicate',sort_order:10});}],
 ['wrong Activity graph',f=>{f.c.digital_textbook_activities[0].node_id=uid();}],
 ['wrong module graph',f=>{f.c.learning_agent_lessons[0].module_id=uid();}],
 ['wrong chapter graph',f=>{f.c.digital_textbook_modules[0].chapter_id=uid();}],
 ['wrong version graph',f=>{f.c.digital_textbook_chapters[0].version_id=uid();}],
 ['wrong textbook scope',f=>{f.scope.textbookId=uid();}],
 ['Draft textbook',f=>{f.c.digital_textbooks[0].status='draft';}],
 ['Draft script',f=>{f.c.learning_agent_script_versions[0].status='draft';}],
 ['Draft version',f=>{f.c.digital_textbook_versions[0].status='draft';}],
 ['duplicate script for lesson',f=>{f.c.learning_agent_script_versions.push({...f.c.learning_agent_script_versions[0],id:uid()});}],
 ['multiple counted Activities per node',f=>{const a={...f.c.digital_textbook_activities[0],id:uid()};f.c.digital_textbook_activities.push(a);f.c.digital_textbook_activity_secrets.push({activity_id:a.id,answer_key:{kind:'index',value:0}});f.c.learning_agent_script_nodes.push({...f.c.learning_agent_script_nodes[0],id:uid(),node_key:'second',sort_order:2,reference_activity_id:a.id});}],
 ['unsupported speaking',f=>{f.c.digital_textbook_activities[0].activity_type='speaking';}],
 ['missing private grader dependency',f=>{f.c.digital_textbook_activity_secrets=[];}],
 ['invalid private grader index',f=>{f.c.digital_textbook_activity_secrets[0].answer_key.value=9;}],
 ['duplicate Activity ID',f=>{f.c.digital_textbook_activities.push(f.c.digital_textbook_activities[0]);}],
 ['unsupported authored configuration',f=>{f.c.learning_agent_script_nodes[0].configuration={cue:{required:true}};}],
 ['branch cannot be silently projected linear',f=>{f.c.learning_agent_script_nodes[0].next_node_key='unknown';}],
 ['media dependency cannot be silently dropped',f=>{f.c.digital_textbook_media_assets.push({id:uid()});}],
 ...['required_video','required_audio','required_speech','required_listening','required_cue'].map(k=>[k,f=>{f.c.learning_agent_script_nodes[0][k]=true;}]),
])test('native rejects '+name,()=>assert.throws(()=>{const f=nativeCapture();modify(f);compile(f);}));
test('native producer to official certified union reader',()=>{const b=compile();assert.equal(artifact.validateSnapshotBundle(b).revision,'publish-foundation/2');assert.equal(b.compilerVersion,'native-publication-1');assert.equal(b.manifest.snapshot.compilerVersion,b.compilerVersion);});
test('native producer rejected by legacy consumer',()=>assert.throws(()=>artifact.requireLegacyPublication(compile())));
test('multiple native teaching nodes and non-B3 configuration',()=>{const b=compile(nativeCapture(3));assert.equal(b.manifest.steps.length,3);assert.equal(b.manifest.activityRefs.length,3);assert.equal(b.manifest.version.number,9);assert.equal(b.privatePayload.bindings[0].scriptVersion,7);});
test('native public manifest excludes private secret, definition and invented cursor',()=>{const b=compile();const publicPart=JSON.stringify(b.manifest);for(const x of ['answer_key','privateDigest','native-execution/1','currentTeachingNode','cuePoints','Node7'])assert.equal(publicPart.includes(x),false);assert.equal(b.manifest.mediaRefs.length,0);assert.equal(b.manifest.compatibility.profile,'native');});
test('public semantic digest independent of grader answer and opaque snapshot identity',()=>{const f=nativeCapture(),a=compile(f);f.c.digital_textbook_activity_secrets[0].answer_key.value=1;const b=compile(f);assert.equal(a.manifestDigest,b.manifestDigest);assert.notEqual(a.snapshotId,b.snapshotId);assert.notEqual(a.privateDigest,b.privateDigest);});
for(const [name,change]of [
 ['unknown revision',b=>{b.revision='publish-foundation/99';}],['mixed kind',b=>{b.publicationKind='legacy-chapter-one';}],
 ['native masquerading as legacy',b=>{b.revision='publish-foundation/1';delete b.publicationKind;}],
 ['slash compiler prohibited',b=>{b.compilerVersion='native-publication/1';b.manifest.snapshot.compilerVersion=b.compilerVersion;}],
 ['compiler envelope mismatch',b=>{b.compilerVersion='other';}],['wrong manifest digest',b=>{b.manifestDigest='sha256:'+'f'.repeat(64);} ],
 ['wrong private binding',b=>{b.privatePayload.bindings[0].activityId=uid();}],['fake native cursor',b=>{b.manifest.execution={contract:'native-execution/1'};}],
 ['wrong content snapshot',b=>{b.manifest.snapshot.id='snapshot-native-'+uid();}],['missing dependencies',b=>{delete b.privatePayload.dependencies.digital_textbook_activities;}],
])test('certifier rejects '+name,()=>assert.throws(()=>{const b=compile();change(b);artifact.validateSnapshotBundle(reseal(b));}));

test('canonical teaching text can publish without a fabricated Activity',()=>{const f=nativeCapture();f.c.digital_textbook_activities=[];f.c.digital_textbook_activity_secrets=[];f.c.learning_agent_script_nodes[0].reference_activity_id=null;f.c.learning_agent_script_nodes[0].action_type='none';const b=compile(f);assert.equal(b.manifest.activityRefs.length,0);assert.equal(b.manifest.blocks[0].type,'text');assert.equal(b.privatePayload.bindings.length,0);});
