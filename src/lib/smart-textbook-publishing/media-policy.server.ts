import 'server-only';
import { canonical, digest } from '../smart-textbook-legacy-adapter/identity.server';
import type { LegacyChapterOneSource } from '../smart-textbook-legacy-adapter/source.server';
import type { finalizeChapterOneNonUiReadiness } from '../smart-textbook-legacy-adapter/final-readiness.server';
import audit from './assets/v1/chapter-one-media-audit.server';

type Result = ReturnType<typeof finalizeChapterOneNonUiReadiness>;
/** All 75 references remain. Source readiness and stable learning IDs remain.
 * Only reviewed pending audio gains a narrowly scoped publication annotation. */
export function mediaPublicationAudit(source: LegacyChapterOneSource, result: Result) {
  if (!result.manifest || result.manifest.mediaRefs.length !== audit.length) throw Error('PUBLICATION_MEDIA_COVERAGE');
  return result.manifest.mediaRefs.map(ref => {
    const proof = audit.find(a => a.ref === ref.id);
    const binding = result.bindings.media.find(b => b.ref === ref.id);
    const asset = source.media.find(a => a.id === binding?.sourceId);
    const node = source.nodes.find(n => n.id === asset?.node_id);
    if(!binding)throw Error('PUBLICATION_MEDIA_BINDING');
    // Track revisions include the enclosing chapter source hash. Audit the
    // actual resource identity, not an unrelated chapter title/compiler revision.
    const {revision:_,...resource}=binding;
    if (!proof || proof.readiness !== ref.readiness || digest(asset ?? resource) !== proof.resourceDigest ||
      (node ? digest(node.content) : null) !== proof.nodeDigest) throw Error(`PUBLICATION_MEDIA_REAUDIT_REQUIRED:${ref.id}`);
    return {...proof, ...(proof.rule === 'required-ready' ? {} : { admission: {
      revision:'chapter-one-media/1' as const, rule:proof.rule, evidenceDigest:digest(proof),
    }})};
  });
}

export function withMediaPublicationPolicy(source:LegacyChapterOneSource,input:Result,dependencyDigest='unbound'):Result {
  const result=structuredClone(input),m=result.manifest;
  if(!m||!result.tts)throw Error('PUBLICATION_COMPILE_BLOCKED');
  const rows=mediaPublicationAudit(source,result);
  for(const ref of m.mediaRefs){const rule=rows.find(r=>r.ref===ref.id)!;if(rule.admission)ref.admission=rule.admission;}
  const {snapshot:_,...semantic}=m;
  const hash=digest(semantic);
  const compilerVersion=`${m.snapshot.compilerVersion}.media1`;
  m.snapshot={...m.snapshot,id:`snapshot-pub-${digest({hash,dependencyDigest,compilerVersion}).slice(0,32)}`,contentDigest:`sha256:${hash}`,compilerVersion};
  result.tts.snapshotId=m.snapshot.id;
  result.proofDigest=digest({sourceRevision:result.report.sourceRevision,tts:result.tts,speech:result.speech,unsupported:result.report.unsupported,mediaAudit:rows});
  return result;
}

export function verifyMediaPublicationPolicy(source:LegacyChapterOneSource,result:Result){
  if(!result.manifest?.mediaRefs.some(r=>r.admission))return;
  const rows=mediaPublicationAudit(source,result);
  for(const ref of result.manifest.mediaRefs){
    const expected=rows.find(r=>r.ref===ref.id)!.admission;
    if(canonical(ref.admission??null)!==canonical(expected??null))throw Error('PUBLICATION_MEDIA_PROOF');
  }
}
