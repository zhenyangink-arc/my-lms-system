import 'server-only';
import { adaptChapterOneReadiness } from './readiness.server.ts';
import { legacySourceSchema } from './source.server.ts';
import { serviceEvidenceSchema, serviceIdentitySchema } from './readiness-contracts.server.ts';
import { buildTtsBinding, buildSpeechReachability, type TtsObservationBinding, type SpeechReachability } from './final-proof.server.ts';
import { validatePrivateBindings } from './bindings.server.ts';
import { digest, canonical } from './identity.server.ts';
import { buildCurrentSpeechReachability } from './current-speech-proof.server.ts';

export const FINAL_READINESS_REVISION='chapter-one-readiness.2';
export function auditPhase3DNonUiReadiness(input:unknown,identities:unknown,history:unknown,evidence:unknown){
  const base=adaptChapterOneReadiness(input,identities,history,evidence);
  let tts:TtsObservationBinding|null=null,speech:SpeechReachability|null=null;
  const failures:string[]=[];
  const s=legacySourceSchema.safeParse(input),e=serviceEvidenceSchema.safeParse(evidence),h=serviceIdentitySchema.safeParse(history);
  if(s.success&&e.success&&h.success&&base.manifest&&base.services){
    try{tts=buildTtsBinding(s.data,base);}catch(error){failures.push(String(error));}
    try{speech=buildSpeechReachability(s.data,e.data);}catch(error){failures.push(String(error));}
    if(tts&&speech)failures.push(...validatePrivateBindings(base.manifest,base.bindings,{services:base.services,source:s.data,history:h.data,evidence:e.data,sourceRevision:base.report.sourceRevision,finalProof:{tts,speech}}));
  }else failures.push('Missing validated Phase 3C source/evidence/bindings');
  const report=structuredClone(base.report);
  const resolved:string[]=[];
  if(tts&&!failures.length){report.unsupported=report.unsupported.filter(e=>e.source.path!=='configuration.studentTask');resolved.push('configuration.studentTask');}
  if(speech&&!failures.length&&speech.proofs.every(p=>p.proofStatus!=='unsupported')&&speech.historical199.every(a=>['reachable-and-valid','unreachable-stale'].includes(a.classification))){report.unsupported=report.unsupported.filter(e=>e.source.path!=='speech.voiceTimeline');resolved.push('speech.voiceTimeline');}
  for(const row of report.unsupported)if(row.source.path==='speech.voiceTimeline')row.reason='Current loader/resume/reentry paths can select ready segment 199 without checking the expected buffer hash; see complete private selection proofs. Do not activate or silently substitute fallback for successful mismatched audio.';
  for(const reason of failures)report.unsupported.push({source:{path:'final-readiness.proof'},result:'unsupported',reason});
  report.adapterRevision=FINAL_READINESS_REVISION;report.runtimeReady=false;
  report.unsupported.sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  const remainingNonUiUnsupported=report.unsupported.filter(e=>e.source.path!=='runtime.capabilities');
  return {...base,report,tts,speech,resolvedInPhase3D:resolved,remainingNonUiUnsupported,
    nonUiRuntimeReady:remainingNonUiUnsupported.length===0,runtimeReady:false as const,
    readinessRevision:FINAL_READINESS_REVISION,
    proofDigest:digest({sourceRevision:report.sourceRevision,readinessRevision:FINAL_READINESS_REVISION,tts,speech,unsupported:report.unsupported}),
  };
}

export const CURRENT_READINESS_REVISION='chapter-one-readiness.3';
export function finalizeChapterOneNonUiReadiness(input:unknown,identities:unknown,history:unknown,evidence:unknown){
  const base=auditPhase3DNonUiReadiness(input,identities,history,evidence);
  const report=structuredClone(base.report),failures:string[]=[];
  let speech:SpeechReachability|null=null;
  const s=legacySourceSchema.safeParse(input),e=serviceEvidenceSchema.safeParse(evidence),h=serviceIdentitySchema.safeParse(history);
  if(s.success&&e.success&&h.success&&base.manifest&&base.services&&base.tts){
    try{
      speech=buildCurrentSpeechReachability(s.data,e.data);
      failures.push(...validatePrivateBindings(base.manifest,base.bindings,{services:base.services,source:s.data,history:h.data,evidence:e.data,sourceRevision:base.report.sourceRevision,finalProof:{tts:base.tts,speech}}));
    }catch(error){failures.push(String(error));}
  }else failures.push('Missing validated source/evidence/bindings');
  const speechReady=!!speech&&!failures.length&&speech.proofs.every(p=>p.proofStatus!=='unsupported')
    &&speech.historical199.every(p=>['reachable-and-valid','candidate-but-rejected'].includes(p.classification));
  if(speechReady)report.unsupported=report.unsupported.filter(p=>p.source.path!=='speech.voiceTimeline');
  else for(const p of report.unsupported)if(p.source.path==='speech.voiceTimeline')p.reason='Current hash-safe selection proof incomplete or invalid';
  for(const reason of failures)report.unsupported.push({source:{path:'current-speech.proof'},result:'unsupported',reason});
  report.adapterRevision=CURRENT_READINESS_REVISION;report.runtimeReady=false;
  report.unsupported.sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  const remainingNonUiUnsupported=report.unsupported.filter(p=>p.source.path!=='runtime.capabilities');
  return {...base,report,speech,remainingNonUiUnsupported,resolvedInPhase3E:speechReady?['speech.voiceTimeline']:[],
    nonUiRuntimeReady:remainingNonUiUnsupported.length===0,runtimeReady:false as const,readinessRevision:CURRENT_READINESS_REVISION,
    proofDigest:digest({sourceRevision:report.sourceRevision,readinessRevision:CURRENT_READINESS_REVISION,tts:base.tts,speech,unsupported:report.unsupported})};
}
