// After formal synthetic catalog setup, regenerate authoritative pins with real JWT.
import '../../tests/fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {SupabaseStudentTeachingReadRepository} from '../../src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts';
import {projectStudentSelectionPins} from '../../src/features/teaching-agent/server/page-projection/selection-projection.ts';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),s=read('state.json'),k=read('status.json'),u=read('users.private.json').A1,ids=read('fixture.json');
assert.equal(s.marker,'uply-teaching-agent-r2-disposable-v1');assert.equal(s.url,`http://127.0.0.1:${s.ports.api}`);assert.equal(k.API_URL,s.url);
const client=createClient(s.url,k.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
assert.equal((await client.auth.signInWithPassword({email:u.email,password:u.password})).error,null);
const authenticate=async()=>{const {data}=await client.auth.getUser();if(!data.user)return null;const m=await client.from('tenant_memberships').select('tenant_id,role,status').eq('user_id',data.user.id).eq('is_default',true).single();return m.data?.role==='student'&&m.data.status==='active'?{actorId:data.user.id,tenantId:m.data.tenant_id}:null;};
const pins=await projectStudentSelectionPins({candidates:ids.anodes.map(nodeId=>({lessonId:ids.alesson,moduleId:ids.amodule,scriptVersionId:ids.ascriptVersion,nodeId})),repository:new SupabaseStudentTeachingReadRepository(client),authenticate,execution:{runId:randomUUID(),signal:AbortSignal.timeout(12000),deadlineAt:new Date(Date.now()+12000).toISOString()}});
assert.equal(pins.length,16);writeFileSync(d+'/pins.json',JSON.stringify(pins));console.log(JSON.stringify({freshPins:pins.length}));
