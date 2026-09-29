import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),s=read('state.json'),k=read('status.json'),u=read('users.private.json'),ids=read('fixture.json');
assert.equal(s.marker,'uply-teaching-agent-r2-disposable-v1');assert.equal(s.url,`http://127.0.0.1:${s.ports.api}`);assert.equal(k.API_URL,s.url);
const checks=[];
for(const [label,token] of [['anon',k.ANON_KEY],...Object.entries(u).map(([label,user])=>[label,user.session.access_token])]){
 for(const [name,args] of [['find_reconcilable_agent_runs_v1',{p_tenant:ids.A,p_limit:50}],['reconcile_agent_run_batch_v1',{p_tenant:ids.A,p_limit:50}],['reconcile_agent_run_v1',{p_tenant:ids.A,p_run:randomUUID(),p_expected_version:1,p_fence:randomUUID()}]]){
  const r=await fetch(s.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:k.ANON_KEY,Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(args)}),body=await r.json();
  assert.equal(r.status,label==='anon'?401:403);assert.equal(body.code,'42501');checks.push({label,rpc:name,status:r.status,code:body.code});
 }
}
const result={status:'PASS',realJwtChecks:checks.length,checks};writeFileSync(d+'/reconcile-permissions-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',realJwtChecks:checks.length}));
