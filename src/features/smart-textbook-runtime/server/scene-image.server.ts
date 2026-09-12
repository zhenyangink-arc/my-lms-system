import 'server-only';
import type {LessonManifestV1} from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type {PrivateBindings} from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import type {LegacyChapterOneSource} from '../../../lib/smart-textbook-legacy-adapter/source.server.ts';

/** Mirrors the old orientation/dialogue panel's first ready node image.
 * Source and bindings must be from the same authorized immutable bundle. */
export function resolveSceneImage(m:LessonManifestV1,b:PrivateBindings,source:Pick<LegacyChapterOneSource,'media'>,capsuleRef:string){
  const c=b.capsules.find(c=>c.id===capsuleRef);
  const block=m.blocks.find(x=>x.type==='compat.learning.v1'&&x.props.capsuleRef===capsuleRef);
  if(c?.kind!=='learning'||!block||block.stepId!==c.stepId)throw Error('SCENE_CAPSULE');
  if(!c.sections.some(s=>s.slot==='dialogueGroups'||s.slot==='dialogueScenes'))return null;
  const row=source.media.find(a=>a.node_id===c.nodeId&&a.media_type==='image'&&a.production_status==='ready'&&a.object_key);
  if(!row)return null;
  const bindings=b.media.filter(x=>x.sourceId===row.id);
  const binding=bindings[0],ref=m.mediaRefs.find(x=>x.id===binding?.ref);
  if(bindings.length!==1||!ref||ref.kind!=='image'||ref.readiness!=='ready'||ref.access!=='lesson'||binding.access!=='lesson'||ref.revision!==binding.revision||binding.objectKey!==row.object_key)throw Error('SCENE_BINDING');
  return binding;
}

/** Byte transport is injected by the server. No location or private row escapes. */
export async function sceneImageBytes(m:LessonManifestV1,b:PrivateBindings,source:Pick<LegacyChapterOneSource,'media'>,capsuleRef:string,signal:AbortSignal,read:(key:string,signal:AbortSignal)=>Promise<Response>):Promise<Blob|null>{
  signal.throwIfAborted();const binding=resolveSceneImage(m,b,source,capsuleRef);if(!binding)return null;
  const response=await read(binding.objectKey!,signal),mime=response.headers.get('content-type')?.split(';')[0]??'';
  if(!response.ok||!['image/png','image/jpeg','image/webp','image/avif'].includes(mime)||!response.body)throw Error('SCENE_IMAGE_UNAVAILABLE');
  const reader=response.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let size=0;
  try{while(true){signal.throwIfAborted();const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>10*1024*1024)throw Error('SCENE_IMAGE_SIZE');chunks.push(new Uint8Array(part.value));}
    signal.throwIfAborted();if(!size)throw Error('SCENE_IMAGE_EMPTY');return new Blob(chunks,{type:mime});
  }finally{await reader.cancel();reader.releaseLock();}
}
