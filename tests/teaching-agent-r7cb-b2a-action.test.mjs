import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks}from'node:module';
let role='owner',guards=0,calls=0;
globalThis.__b2aOwner=async()=>{guards++;if(role!=='owner')throw Error('OWNER_DENIED');return{supabase:{owner:true}};};
globalThis.__b2aExecute=async c=>{assert.equal(c.owner,true);calls++;return{contract:'development-domain-execution/1',status:'VERIFY_REQUIRED',classification:'UNKNOWN',stage:'ACTOR',scope:'DISABLED'};};
const h=registerHooks({resolve(s,c,n){if(s==='@/lib/admin')return{url:'data:text/javascript,export const requirePlatformOwner=()=>globalThis.__b2aOwner()',shortCircuit:true};if(s.endsWith('/provisioning-entrypoint.server.ts'))return{url:'data:text/javascript,export const executeProvisioningEntrypoint=(c)=>globalThis.__b2aExecute(c)',shortCircuit:true};return n(s,c);}});
const {provisionDevelopmentExecutionAction:action}=await import('../src/features/development-execution/server/provisioning.actions.ts');h.deregister();
for(const r of ['anonymous','non-owner'])test(`${r} denied before entrypoint`,async()=>{role=r;await assert.rejects(action(),/OWNER_DENIED/);assert.equal(calls,0);});
test('Owner invokes existing entrypoint exactly once; UNKNOWN not retried',async()=>{role='owner';assert.equal((await action()).status,'VERIFY_REQUIRED');assert.equal(calls,1);});
for(const input of [{actorId:'untrusted'},{tenantId:'untrusted'},{dbUrl:'https://wrong.invalid'},{budget:999},'arbitrary-target'])test('browser arguments rejected after Owner guard',async()=>{role='owner';const n=guards,c=calls;assert.equal((await action(input)).status,'DENIED');assert.equal(guards,n+1);assert.equal(calls,c);});
