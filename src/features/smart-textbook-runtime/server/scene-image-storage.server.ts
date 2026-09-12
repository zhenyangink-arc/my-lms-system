import 'server-only';
import {createR2SignedObjectUrl} from '../../../lib/r2';
export async function readSceneImage(key:string,signal:AbortSignal){
  signal.throwIfAborted();
  return fetch(await createR2SignedObjectUrl(key),{signal,cache:'no-store',redirect:'error'});
}
