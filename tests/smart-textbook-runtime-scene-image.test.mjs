import test from 'node:test';
import assert from 'node:assert/strict';
import {source,manifest,compiled} from './fixtures/runtime-4a.mjs';
const {resolveSceneImage,sceneImageBytes}=await import('../src/features/smart-textbook-runtime/server/scene-image.server.ts');
const b=compiled.bindings;
const c=b.capsules.find(c=>c.kind==='learning'&&c.sections.some(s=>s.slot==='dialogueGroups'));
const signal=()=>new AbortController().signal;
test('scene image uses actual frozen node image and never an unrelated chapter asset',()=>{
  const row=source.media.find(x=>x.node_id===c.nodeId&&x.media_type==='image'&&x.production_status==='ready'&&x.object_key);
  assert.ok(row);assert.equal(resolveSceneImage(manifest,b,source,c.id).sourceId,row.id);
  assert.equal(resolveSceneImage(manifest,b,{media:source.media.filter(x=>x.node_id!==c.nodeId)},c.id),null);
  assert.throws(()=>resolveSceneImage(manifest,b,source,'wrong-capsule'),/SCENE_CAPSULE/);
});
test('pending, mismatched object/revision and ambiguous private association never become playable',()=>{
  const row=resolveSceneImage(manifest,b,source,c.id);
  const pending=structuredClone(source);pending.media.filter(x=>x.node_id===c.nodeId).forEach(x=>x.production_status='pending');
  assert.equal(resolveSceneImage(manifest,b,pending,c.id),null);
  for(const field of ['objectKey','revision']){const bad=structuredClone(b);bad.media.find(x=>x.ref===row.ref)[field]='wrong';assert.throws(()=>resolveSceneImage(manifest,bad,source,c.id),/SCENE_BINDING/);}
  const bad=structuredClone(b);bad.media.push({...row});assert.throws(()=>resolveSceneImage(manifest,bad,source,c.id),/SCENE_BINDING/);
});
test('authorized bytes only; SVG/HTML, empty and over-limit bytes rejected; abort respected',async()=>{
  const read=async()=>new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});
  const result=await sceneImageBytes(manifest,b,source,c.id,signal(),read);
  assert.ok(result instanceof Blob);assert.equal(result.size,4);assert.equal(result.type,'image/png');
  assert.equal(JSON.stringify(result),'{}');
  for(const mime of ['image/svg+xml','text/html'])await assert.rejects(sceneImageBytes(manifest,b,source,c.id,signal(),async()=>new Response('<svg/>',{headers:{'content-type':mime}})),/SCENE_IMAGE_UNAVAILABLE/);
  for(const size of [0,10*1024*1024+1])await assert.rejects(sceneImageBytes(manifest,b,source,c.id,signal(),async()=>new Response(new Uint8Array(size),{headers:{'content-type':'image/png'}})),/SCENE_IMAGE_(EMPTY|SIZE)/);
  const stop=new AbortController();stop.abort();await assert.rejects(sceneImageBytes(manifest,b,source,c.id,stop.signal,read),/abort/i);
});
