import 'server-only';
import type { LessonManifestV1 } from '../smart-textbook-runtime-v1/contracts.ts';
import type { PrivateBindings } from './capsules.server.ts';
import { validateReadinessBindings, type ReadinessValidationContext } from './readiness-validation.server.ts';
import { learningTargetSemantics } from './target-semantics.server.ts';
/** Offline referential validation only, never authorization or evidence validation. */
export function validatePrivateBindings(manifest:LessonManifestV1,bindings:PrivateBindings,readiness?:ReadinessValidationContext):string[]{
  const errors:string[]=[];
  for(const row of learningTargetSemantics(manifest,bindings)){
    const target=manifest.runtimeTargets.find(t=>t.id===row.address)!;
    if(row.classification==='unreachable-invalid')errors.push(`target:${row.address}: unknown semantics`);
    if(JSON.stringify(row.capabilities)!==JSON.stringify(target.capabilities))errors.push(`target:${row.address}: capability projection mismatch`);
  }
  const one=(values:unknown[],path:string)=>{if(values.length!==1)errors.push(`${path}: expected exactly one binding`);};
  for(const ref of manifest.activityRefs)one(bindings.activities.filter(b=>b.ref===ref.id&&b.activityId===ref.activityId&&b.versionId===manifest.version.id),`activity:${ref.id}`);
  for(const ref of manifest.mediaRefs)one(bindings.media.filter(b=>b.ref===ref.id&&b.revision===ref.revision),`media:${ref.id}`);
  for(const ref of manifest.progressRefs)one(bindings.progress.filter(b=>b.ref===ref.id&&b.kind===ref.kind),`progress:${ref.id}`);
  for(const ref of manifest.teachingRefs)one(bindings.teaching.filter(b=>b.ref===ref.id&&b.scriptVersionId===ref.revision&&b.entryCueId===ref.entryCueId),`teaching:${ref.id}`);
  for(const b of manifest.blocks)if('capsuleRef'in b.props){const ref=b.props.capsuleRef;one(bindings.capsules.filter(c=>c.id===ref&&c.stepId===b.stepId),`capsule:${b.id}`);}
  for(const alias of bindings.aliases)if(!manifest.runtimeTargets.some(t=>t.id===alias.target&&t.stepId===alias.moduleId))errors.push(`target:${alias.legacyKey}: dangling target`);
  const targetParts=new Set(manifest.runtimeTargets.flatMap(t=>t.partId?[t.partId]:[]));
  for(const p of bindings.progress)for(const id of p.partIds)if(!targetParts.has(id))errors.push(`progress:${p.ref}: dangling part`);
  if(readiness)errors.push(...validateReadinessBindings(manifest,bindings,readiness));
  return errors;
}
