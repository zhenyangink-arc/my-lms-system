import 'server-only';
import { z } from 'zod';
import { withNativeLearningSession, assertActiveNativeSessionAuthority } from './native-learning-session.server.ts';
import { readFixedSelectedVideoSnapshot } from '../../../lib/smart-textbook-publishing/fixed-selected-media.server.ts';
import { fixedSelectedMediaProofSchema } from '../../../lib/smart-textbook-publishing/native-video-source.server.ts';
import { canonical } from '../../../lib/smart-textbook-legacy-adapter/identity.server.ts';

const querySchema = z.strictObject({sessionRef:z.string().min(1).max(100),mediaRef:z.string().min(1).max(200),revision:z.string().min(1).max(200)});
const headers = {'Cache-Control':'private, no-store','Vary':'Cookie','Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
function unavailable(status:number) { return new Response(null,{status,headers}); }
function range(value:string|null,size:number):[number,number]|null {
  if (value === null) return [0,size-1];
  const match = /^bytes=([0-9]*)-([0-9]*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const first = match[1] ? Number(match[1]) : null, last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null;
  if (first === null) return last && last > 0 ? [Math.max(0,size-last),size-1] : null;
  if (first >= size || (last !== null && last < first)) return null;
  return [first,Math.min(last ?? size-1,size-1)];
}
export async function serveNativePublishedMedia(request:Request):Promise<Response> {
  if (!['GET','HEAD'].includes(request.method)) return unavailable(405);
  let query:z.infer<typeof querySchema>;
  try {
    const url = new URL(request.url);
    if (url.search.length > 1024 || [...url.searchParams.keys()].length !== 3) return unavailable(400);
    query = querySchema.parse(Object.fromEntries(url.searchParams));
  } catch { return unavailable(400); }
  try {
    return await withNativeLearningSession(query.sessionRef,request.signal,async authority => {
      assertActiveNativeSessionAuthority(authority);
      const {bundle} = authority, binding = bundle.privatePayload.bindings[0];
      const member = bundle.manifest.mediaRefs.find(media => media.id === query.mediaRef);
      const proof = fixedSelectedMediaProofSchema.parse(bundle.privatePayload.source.teachingNodes[0].configuration.videoPilotPublication.media);
      if (!member || member.kind !== 'video' || member.access !== 'lesson' || member.readiness !== 'ready'
        || member.revision !== query.revision || binding.mediaRef !== query.mediaRef || binding.mediaRevision !== query.revision
        || proof.revision !== query.revision) return unavailable(403);
      let snapshot:Awaited<ReturnType<typeof readFixedSelectedVideoSnapshot>>;
      try { snapshot = await readFixedSelectedVideoSnapshot(request.signal); }
      catch { return unavailable(503); }
      request.signal.throwIfAborted();
      assertActiveNativeSessionAuthority(authority);
      if (canonical(snapshot.proof) !== canonical(proof)) return unavailable(503);
      const requestedRange = request.headers.get('range'), selected = range(requestedRange,snapshot.bytes.length);
      if (!selected) return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${snapshot.bytes.length}`}});
      const [start,end] = selected;
      const responseHeaders:Record<string,string> = {...headers,'Content-Type':'video/mp4','Content-Disposition':'inline',
        'Accept-Ranges':'bytes','Content-Length':String(end-start+1)};
      if (requestedRange !== null) responseHeaders['Content-Range'] = `bytes ${start}-${end}/${snapshot.bytes.length}`;
      let offset = start;
      // No I/O outside the request lease, no read-ahead. B owns the stream's
      // cancellation barrier and only leaves after this producer has stopped.
      const body = request.method === 'HEAD' ? null : new ReadableStream<Uint8Array>({
        pull(controller) {
          request.signal.throwIfAborted();
          if (offset > end) {controller.close();return;}
          const next = Math.min(end+1,offset+65536);
          controller.enqueue(snapshot.bytes.subarray(offset,next));offset = next;
        }, cancel() {offset = end+1;},
      },{highWaterMark:0});
      return new Response(body,{status:requestedRange === null ? 200 : 206,headers:responseHeaders});
    });
  } catch { return unavailable(request.signal.aborted ? 499 : 403); }
}
