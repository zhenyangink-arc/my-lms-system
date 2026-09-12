import './smart-textbook-legacy-adapter/register-server-only.mjs';
const {digest}=await import('../../src/lib/smart-textbook-legacy-adapter/identity.server.ts');
// Reconstruct ONLY the old learning command projection. All other content and
// identities must still reproduce the frozen historical digest.
export function previousTargetContractDigest(manifest){
  const previous=structuredClone(manifest);
  for(const t of previous.runtimeTargets){
    if(previous.blocks.find(b=>b.id===t.blockId)?.type!=='compat.learning.v1')continue;
    t.capabilities=['reveal','focus','highlight','open'];t.acceptedEvents=['opened'];t.verification='ui-only';
  }
  const {snapshot,...semantic}=previous;return `sha256:${digest(semantic)}`;
}
export function previousTargetProofDigest(result){
  return digest({sourceRevision:result.report.sourceRevision,readinessRevision:result.readinessRevision,
    tts:{...result.tts,snapshotId:'snapshot-32603dd11ecc8762ccee25187a39ac0e'},speech:result.speech,unsupported:result.report.unsupported});
}
