// Offline manifest generation; never connects to a database or Provider.
import {readFileSync,writeFileSync,readdirSync,statSync,copyFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,relative} from 'node:path';
import assert from 'node:assert/strict';
import {pinStudentRuntimeDefinition} from '../../src/features/teaching-agent/server/runtime/student-runtime-definition.ts';
const root=process.cwd(),d=process.argv[2],out=process.argv[3];
const read=p=>JSON.parse(readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const state=read(d+'/state.json');assert.equal(state.marker,'uply-teaching-agent-r2-disposable-v1');
const baseline=read('supabase/bootstrap/baseline-manifest.json'),build=read(d+'/candidate-build-result.json');
assert.equal(build.exit,0);assert.equal(build.instrumented,false);
const history=read('supabase/bootstrap/migration-ledger-baseline.json'),cutover=history.at(-1).version;
const files=readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&n.split('_')[0]>cutover).sort();
assert.deepEqual(files,baseline.postBaselineMigrations.map(x=>x.filename));
for(const item of baseline.postBaselineMigrations)assert.equal(sha(readFileSync('supabase/migrations/'+item.filename)),item.sha256);
const inputs={};
function walk(dir){for(const n of readdirSync(dir).sort()){const p=join(dir,n);if(statSync(p).isDirectory())walk(p);else inputs[relative(root,p)]=sha(readFileSync(p));}}
walk(join(root,'src'));walk(join(root,'public'));
for(const n of ['package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs'])inputs[n]=sha(readFileSync(n));
// The fixture source has intentional injection. Compare against the start-of-stage original bytes instead.
const start=read('/tmp/uply-r3-baseline.json');const hashes=start.files??start.hashes??start;
for(const [p,h] of Object.entries(inputs))if(Object.hasOwn(hashes,p))assert.equal(h,hashes[p],`Protected release input changed: ${p}`);
const definition=pinStudentRuntimeDefinition();
const archive=readFileSync(d+'/candidate-build.tar.gz');assert.equal(sha(archive),build.archiveDigest);
mkdirSync(out,{recursive:true,mode:0o700});copyFileSync(d+'/candidate-build.tar.gz',out+'/candidate-build.tar.gz');
const manifest={schemaVersion:1,gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 workspaceStartDigest:sha(readFileSync('/tmp/uply-r3-baseline.json')),
 workspaceReleaseInputDigest:sha(JSON.stringify(inputs)),releaseInputScope:'src/** + public/** + package/lock + next/ts/postcss config; reports/tests/operational helpers excluded',
 buildId:build.buildId,artifactDigest:build.artifactDigest,archiveDigest:build.archiveDigest,artifactFiles:build.artifactFiles,
 artifactLocation:out+'/candidate-build.tar.gz',publicConfigMatchesProduction:build.publicConfigMatchesProduction,
 baselineCutover:cutover,baselineSqlDigest:baseline.baselineSqlDigest,migrations:baseline.postBaselineMigrations,
 definitionDigest:definition.definitionDigest,definition:definition.profile,
 rlsMigration:baseline.postBaselineMigrations.at(-1),
 featureConfigNames:['TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED','TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS'],
 rolloutPolicyVersion:'source-sha256:'+inputs['src/features/teaching-agent/server/transport/rollout-policy.ts'],
 productionFeatureFlag:'OFF',productionMigrations:'NOT APPLIED',productionDeploy:false,
 validationBoundary:'Original uninstrumented complete build. Functional Full Supabase/Provider-fixture tests use a separately built instrumented copy. This artifact was not enabled in production.',
 invalidation:'Any release input, migration, definition or artifact change requires affected gates to rerun.'};
writeFileSync(out+'/release-inputs.json',JSON.stringify(inputs,null,2));writeFileSync(out+'/release-candidate-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({buildId:manifest.buildId,artifactDigest:manifest.artifactDigest,definitionDigest:manifest.definitionDigest,migrations:files.length,sourceInputs:Object.keys(inputs).length}));
