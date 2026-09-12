import { blockTypes, type BlockTypeV1, type LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { blockRegistryV1 } from '../../../lib/smart-textbook-runtime-v1/registry.ts';
import { validateLessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/validator.ts';

/** Do not confuse an inspectable partial UI with an executable learning workflow. */
export const rendererRegistry = Object.freeze(Object.fromEntries(blockTypes.map(type=>[type,{
  type, capability:blockRegistryV1[type].capability,
  // Chapter-one compatibility implementation evidence precedes promotion;
  // teacher-readiness additionally requires strict mounted integration proof.
  rendererStatus:(['text','multiple_choice','compat.learning.v1','compat.teacher.v1'].includes(type)?'implemented':'unsupported') as 'implemented'|'unsupported',
  inspectable:['text','multiple_choice','compat.learning.v1','compat.teacher.v1'].includes(type),
}])) as Record<BlockTypeV1,{type:BlockTypeV1;capability:string;rendererStatus:'implemented'|'unsupported';inspectable:boolean}>);
export const executableCapabilities = Object.freeze(['layout.v1','navigation.linear.v1','progress.server.v1',...blockTypes.filter(t=>rendererRegistry[t].rendererStatus==='implemented').map(t=>rendererRegistry[t].capability)]);
export function validateRuntimeActivation(manifest:unknown){return validateLessonManifestV1(manifest,{supportedCapabilities:executableCapabilities});}
export function runtimeReadiness(manifest:LessonManifestV1,nonUiRuntimeReady:boolean){
  const validation=validateRuntimeActivation(manifest);
  return {nonUiRuntimeReady,executableCapabilities,runtimeReady:nonUiRuntimeReady&&validation.success,
    unsupported:validation.success?[]:validation.issues};
}
