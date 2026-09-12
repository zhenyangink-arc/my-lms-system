import 'server-only';
import { selectBufferSpeech, bufferTextHash } from '../learning-agent-buffer-selection.server.ts';
import type { LegacyChapterOneSource } from './source.server.ts';
import type { ServiceEvidence } from './readiness-contracts.server.ts';
import type { SpeechReachability, SpeechSelectionProof, Historical199Proof } from './final-proof.server.ts';
import { teacherConfigurationSchema } from './chapter-one-shapes.server.ts';
import { identity } from './identity.server.ts';
import { verifySpeechSlot } from './speech-proof.server.ts';

/** Current production policy. Phase 3D's buildSpeechReachability remains a historical audit only. */
export function buildCurrentSpeechReachability(s: LegacyChapterOneSource, e: ServiceEvidence): SpeechReachability {
  const nodes = [...s.teachingNodes].sort((a,b) => a.sort_order-b.sort_order);
  const version = s.teachingVersions[0];
  if (nodes.length !== 8 || s.teachingVersions.length !== 1 || version.version_number !== 23 || version.status !== 'published'
    || nodes.some(n => n.script_version_id !== version.id)) throw Error('Unresolved published v23 node/version scope');
  const proofs: SpeechSelectionProof[] = [];
  for (const node of nodes) {
    const configuration = teacherConfigurationSchema.parse(node.configuration);
    for (const locale of ['zh-CN','ko-KR'] as const) {
      const candidates = e.speech.filter(a => a.script_node_id === node.id && a.locale === locale && a.segment_index === 199);
      const selection = selectBufferSpeech({ version, node: { id: node.id, scriptVersionId: node.script_version_id, configuration }, locale, candidates });
      const paths: SpeechSelectionProof['path'][] = ['resume-loader','resume-reentry','reset',
        ...(node.id === nodes[0].id ? ['opening-loader','restart'] as const : ['buffer-transition'] as const),
        ...(configuration.terminal ? ['terminal-restore','terminal-completed'] as const : [])];
      for (const path of paths) {
        // Completed sessions are not loaded. A historical active terminal is still validated above.
        const completed = path === 'terminal-completed';
        const kind = completed ? 'silent' : selection.kind;
        proofs.push({id:identity('speech-proof',node.id,locale,path),nodeId:node.id,nodeKey:node.node_key,teachingRevision:node.script_version_id,
          locale,segment:199,path,expectedTextHash:completed?bufferTextHash(''):selection.expectedTextHash,
          preset:completed?null:selection.presetId,
          selectionMode:kind==='preset'?'preset-first':kind==='verified-asset'?'exact-buffer-hash':kind,
          legacyCandidateAssetId:candidates.length===1?candidates[0].id:null,
          selectedAssetId:kind==='verified-asset'?selection.selectedSpeechAssetId:null,
          fallbackMode:kind==='silent'?'existing-silent':kind==='unsupported'?null:'existing-browser-tts-or-text',
          proofStatus:kind==='verified-asset'?'verified-asset':kind==='preset'?'verified-preset':kind==='unsupported'?'unsupported':'verified-existing-fallback',
          reason:completed?'Completed terminal session excluded by active-session loader':selection.reason});
      }
    }
  }
  for (const asset of e.speech.filter(a => a.segment_index !== 199)) {
    const node=nodes.find(n=>n.id===asset.script_node_id);
    if(!node)throw Error('Speech asset outside published nodes');
    const valid=verifySpeechSlot(node,asset);
    proofs.push({id:identity('speech-proof',node.id,asset.locale,String(asset.segment_index)),nodeId:node.id,nodeKey:node.node_key,
      teachingRevision:node.script_version_id,locale:asset.locale,segment:asset.segment_index,path:'script',expectedTextHash:asset.content_hash,
      preset:null,selectionMode:'exact-script',legacyCandidateAssetId:asset.id,selectedAssetId:valid?asset.id:null,fallbackMode:null,
      proofStatus:valid?'verified-asset':'unsupported',reason:valid?'Unchanged Phase 3C script/hash/timeline verification':'Script slot mismatch'});
  }
  const historical199: Historical199Proof[] = e.speech.filter(a=>a.segment_index===199).map((a): Historical199Proof=>{
    const paths=proofs.filter(p=>p.segment===199&&p.nodeId===a.script_node_id&&p.locale===a.locale);
    const selected=paths.some(p=>p.selectedAssetId===a.id);
    return {assetId:a.id,nodeId:a.script_node_id,locale:a.locale,
      classification:selected?'reachable-and-valid':paths.length&&paths.every(p=>p.proofStatus!=='unsupported')?'candidate-but-rejected':'unresolved',
      proofIds:paths.map(p=>p.id).sort()};
  }).sort((a,b)=>a.assetId.localeCompare(b.assetId));
  proofs.sort((a,b)=>a.id.localeCompare(b.id));
  return {revision:'speech-reachability/2',proofs,historical199,selectableAssetIds:[...new Set(proofs.flatMap(p=>p.selectedAssetId?[p.selectedAssetId]:[]))].sort()};
}
