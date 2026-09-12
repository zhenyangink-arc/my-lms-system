import { manifestStructureSchema, type LessonManifestV1, type ActivityRefV1 } from './contracts.ts';
import { blockRegistryV1, contractCapabilitiesV1, declaredPartIds, canPlayTarget } from './registry.ts';
import { makeRuntimeTarget, parseRuntimeTarget } from './targets.ts';
import { admittedMedia } from './media-admission.ts';

export interface ValidationIssueV1 { path: string; message: string }
export type ManifestValidationResultV1 = { success: true; data: LessonManifestV1 } | { success: false; issues: ValidationIssueV1[] };
/** External bindings are intentionally NOT public Manifest fields. No database access. */
export interface ValidationOptionsV1 {
  supportedCapabilities?: readonly string[];
  resolveBinding?: (kind: 'capsule' | 'teaching-cue' | 'playback-policy', ref: string, ownerRef: string) => boolean;
  requireBindings?: boolean;
  published?: boolean;
}
export function validateLessonManifestV1(input: unknown, options: ValidationOptionsV1 = {}): ManifestValidationResultV1 {
  const issues: ValidationIssueV1[] = [];
  const fail = (path: string, message: string) => { issues.push({ path, message }); };
  // Bound traversal before recursive schema parsing, including cyclic/non-JSON input.
  const seen = new WeakSet<object>(); let budget = 100000;
  const scan = (v: unknown, path: string, depth: number): void => {
    if (--budget < 0 || depth > 24) { fail(path,'Input complexity exceeded'); return; }
    if (!v || typeof v !== 'object') { if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint' || v === undefined) fail(path,'Non-JSON value'); return; }
    if (seen.has(v)) { fail(path,'Cyclic/shared object input: supply JSON data'); return; } seen.add(v);
    if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) fail(path,'Non-JSON object');
    for (const [k, child] of Object.entries(v)) {
      if (/^(?:secret.*|answer[_-]?key|answers?|correct.*|object[_-]?key|service[_-]?role.*|transcript|private[_-]?transcript|html|js|css|style|script|eyebrow|typeLabel|interactionLabel|__proto__|constructor|prototype)$/i.test(k)) fail(`${path}.${k}`,'Forbidden private/executable/decorative field');
      scan(child,`${path}.${k}`,depth+1);
      if (budget < 0) break;
    }
    seen.delete(v);
  };
  scan(input,'$',0);
  if (issues.length) return { success:false, issues };
  const parsed = manifestStructureSchema.safeParse(input);
  if (!parsed.success) return { success:false, issues:parsed.error.issues.map(i=>({path:i.path.join('.'),message:i.message})) };
  const m = parsed.data;
  const unique = (values: readonly (string | number)[], path: string) => { if (new Set(values).size !== values.length) fail(path,'Duplicate identity/order'); };
  for (const key of ['steps','blocks','regions','runtimeTargets','activityRefs','mediaRefs','progressRefs','teachingRefs'] as const) unique(m[key].map(x=>x.id),key);
  unique(m.steps.map(s=>s.key),'steps.key'); unique(m.steps.map(s=>s.order),'steps.order');
  unique(m.activityRefs.map(a=>a.activityId),'activityRefs.activityId');
  unique(m.requiredCapabilities,'requiredCapabilities'); unique(m.localization.locales,'localization.locales');
  if (!m.localization.locales.includes(m.localization.defaultLocale)) fail('localization','Default locale not declared');
  const titles = (v: unknown, path: string): void => { if (!v || typeof v !== 'object') return; for (const [k,c] of Object.entries(v)) { if (['title','prompt'].includes(k) && c && typeof c === 'object' && !(m.localization.defaultLocale in c)) fail(`${path}.${k}`,'Default locale required'); titles(c,`${path}.${k}`); } }; titles(m,'$');
  const supported = options.supportedCapabilities ?? contractCapabilitiesV1;
  for (const c of m.requiredCapabilities) if (!contractCapabilitiesV1.includes(c) || !supported.includes(c)) fail('requiredCapabilities',`Unsupported capability ${c}`);
  for (const c of ['layout.v1','navigation.linear.v1','progress.server.v1',...m.blocks.map(b=>blockRegistryV1[b.type].capability)]) if (!m.requiredCapabilities.includes(c)) fail('requiredCapabilities',`Missing capability ${c}`);
  const steps = new Map(m.steps.map(s=>[s.id,s])), blocks = new Map(m.blocks.map(b=>[b.id,b])), regions = new Map(m.regions.map(r=>[r.id,r]));
  const activities = new Map(m.activityRefs.map(a=>[a.id,a])), media = new Map(m.mediaRefs.map(a=>[a.id,a])), progress = new Map(m.progressRefs.map(a=>[a.id,a])), teaching = new Map(m.teachingRefs.map(a=>[a.id,a]));
  for (const id of ['teaching','interaction','interaction.main','navigation'] as const) if (!regions.has(id)) fail('regions',`Missing ${id}`);
  for (const r of m.regions) {
    const child = r.id.startsWith('interaction.');
    if (r.parent !== (child ? 'interaction' : null) || r.role !== (child ? r.id.split('.')[1] : r.id) || r.content !== (r.id === 'interaction' ? 'regions' : r.id === 'navigation' ? 'runtime-navigation' : 'blocks')) fail(`regions.${r.id}`,'Invalid bounded region hierarchy');
    unique(r.allowedBlockTypes,`regions.${r.id}.allowedBlockTypes`);
    if (r.content !== 'blocks' && r.allowedBlockTypes.length) fail(`regions.${r.id}`,'Container cannot allow blocks');
    for (const type of r.allowedBlockTypes) if (!blockRegistryV1[type].allowedRegions.includes(r.id)) fail(`regions.${r.id}`,'Registry disallows type');
  }
  const checkProgress = (ref: string,path: string,kind?: string) => { const p=progress.get(ref); if (!p || (kind && p.kind !== kind)) fail(path,`Invalid progressRef ${ref}`); };
  checkProgress(m.completion.chapterPolicyRef,'completion','chapter');
  const ordered=[...m.steps].sort((a,b)=>a.order-b.order), placements:string[]=[];
  for (const [i,s] of ordered.entries()) {
    if (s.nextStep !== (ordered[i+1]?.id ?? null)) fail(`steps.${s.id}.nextStep`,'Must point to immediate next Step');
    if (s.teachingRef && !teaching.has(s.teachingRef)) fail(`steps.${s.id}.teachingRef`,'Dangling teachingRef');
    if (s.completion.kind === 'server') checkProgress(s.completion.policyRef,`steps.${s.id}.completion`,'node');
    unique(s.regions.map(r=>r.region),`steps.${s.id}.regions`);
    for (const placement of s.regions) {
      if (regions.get(placement.region)?.content !== 'blocks') fail(`steps.${s.id}.regions`,'Not a leaf region');
      const orders:number[]=[];
      for (const id of placement.blockIds) { placements.push(id); const b=blocks.get(id); if (!b || b.stepId!==s.id || b.region!==placement.region) fail(`steps.${s.id}.regions`,'Dangling/mismatched block placement'); else orders.push(b.order); }
      unique(orders,`steps.${s.id}.${placement.region}.order`);
      if (orders.some((n,i)=>i>0 && n<=orders[i-1])) fail(`steps.${s.id}.regions`,'Block placement not in order');
    }
  }
  unique(placements,'placements');
  if (JSON.stringify(m.navigation.items)!==JSON.stringify(ordered.map(s=>s.id)) || m.navigation.entryStep!==ordered[0].id) fail('navigation','Must cover sorted steps exactly');
  const binding = (kind:'capsule'|'teaching-cue'|'playback-policy',ref:string,owner:string) => { if (((options.requireBindings || options.published) && !options.resolveBinding) || (options.resolveBinding && !options.resolveBinding(kind,ref,owner))) fail(kind,`Unresolved binding ${ref}`); };
  for (const t of m.teachingRefs) binding('teaching-cue',t.entryCueId,t.id);
  for (const a of m.activityRefs) {
    unique(a.publicPresentation.options.map(o=>o.id),`activityRefs.${a.id}.options`);
    if (a.type === 'self_check') unique(a.publicPresentation.settings.items.map(o=>o.id),`activityRefs.${a.id}.items`);
  }
  const expectedActivity: Partial<Record<string,ActivityRefV1['type']>> = {multiple_choice:'single_choice',multiple_select:'multiple_choice',fill_blank:'fill_blank',ordering:'ordering',listening:'listening',pronunciation:'speaking',role_play:'speaking',writing:'writing',self_check:'self_check'};
  for (const b of m.blocks) {
    const path=`blocks.${b.id}`, entry=blockRegistryV1[b.type];
    if (!steps.has(b.stepId) || !placements.includes(b.id)) fail(path,'Unplaced block / missing Step');
    if (!entry.allowedRegions.includes(b.region) || !regions.get(b.region)?.allowedBlockTypes.includes(b.type)) fail(path,'Illegal Region');
    if (b.completion.kind==='server') { checkProgress(b.completion.policyRef,path); if (!entry.progressKinds.includes(progress.get(b.completion.policyRef)?.kind as never)) fail(path,'Registry progress kind mismatch'); }
    if (b.runtimeTarget!==makeRuntimeTarget(b.stepId,b.id) || !m.runtimeTargets.some(t=>t.id===b.runtimeTarget && t.partId===null)) fail(path,'Missing/mismatched root target');
    const parts=declaredPartIds(b); unique(parts,`${path}.parts`);
    const walk=(v:unknown,p:string):void=>{ if (Array.isArray(v)) { v.forEach(x=>walk(x,p)); return; } if (!v || typeof v!=='object') return;
      for (const [k,c] of Object.entries(v)) {
        if (typeof c==='string') {
          if (['activityRef','listeningRef','speakingRef','readingRef','writingRef'].includes(k)) { const a=activities.get(c); const expected=k==='activityRef'?expectedActivity[b.type]:({listeningRef:'listening',speakingRef:'speaking',readingRef:'single_choice',writingRef:'writing'} as const)[k as 'listeningRef']; if (!a || (expected && a.type!==expected)) fail(p,`Invalid activityRef ${c}`); }
          if (['mediaRef','posterRef','captionsRef','modelMediaRef'].includes(k)) { const a=media.get(c); const kind=k==='posterRef'?'image':k==='captionsRef'?'captions':k==='modelMediaRef'?'audio':b.type==='image' || b.type==='supplemental_visual'?'image':b.type==='video'?'video':'audio'; if (!a || a.kind!==kind) fail(p,`Invalid mediaRef ${c}`); }
          if (k==='practiceRef') checkProgress(c,p,'guided-repeat');
          if (k==='teachingRef' && (!teaching.has(c) || teaching.get(c)?.mode!=='legacy' || steps.get(b.stepId)?.teachingRef!==c)) fail(p,'Invalid legacy teachingRef');
          if (k==='target' && !m.runtimeTargets.some(t=>t.id===c)) fail(p,'Dangling return target');
          if (k==='capsuleRef') binding('capsule',c,b.type==='compat.teacher.v1'?b.props.teachingRef:b.id);
          if (k==='playbackPolicyRef') binding('playback-policy',c,b.id);
        }
        if (k==='activityRefs' && Array.isArray(c)) for(const ref of c) if(!activities.has(ref)) fail(p,'Dangling activityRef');
        if (k==='progressRefs' && Array.isArray(c)) for(const ref of c) checkProgress(ref,p);
        walk(c,`${p}.${k}`);
      }
    }; walk(b.props,path);
    if (b.type.startsWith('compat.') && (m.compatibility.profile==='native' || !m.compatibility.adapterRevision)) fail(path,'Compatibility blocks require adapter provenance');
    if (b.type==='video' && b.props.role==='teacher' && teaching.get(steps.get(b.stepId)?.teachingRef ?? '')?.mode!=='video-first') fail(path,'Teacher video requires video-first teachingRef');
  }
  for (const t of m.runtimeTargets) {
    const parsed=parseRuntimeTarget(t.id), b=blocks.get(t.blockId);
    if (!parsed || parsed.stepId!==t.stepId || parsed.blockId!==t.blockId || parsed.partId!==t.partId || !b || b.stepId!==t.stepId || (t.partId!==null && !declaredPartIds(b).includes(t.partId))) fail(`runtimeTargets.${t.id}`,'Mismatched/unknown target or part');
    unique(t.capabilities,`runtimeTargets.${t.id}.capabilities`); unique(t.acceptedEvents,`runtimeTargets.${t.id}.events`);
    if (!t.capabilities.length && (t.acceptedEvents.length || t.verification!=='ui-only')) fail(t.id,'Identity-only target cannot accept events or learning evidence');
    if (t.acceptedEvents.includes('response-submitted') && t.verification!=='server-attempt') fail(t.id,'Submission requires server attempt evidence');
    if (t.acceptedEvents.includes('practice-confirmed') && t.verification!=='server-practice') fail(t.id,'Practice requires server evidence');
    if (t.acceptedEvents.includes('media-ended') && t.verification!=='playback-observation') fail(t.id,'Playback is observation only');
    if ((t.capabilities.includes('play') || t.acceptedEvents.includes('media-ended')) && b && !canPlayTarget(b,t.partId)) fail(t.id,'No playable media on this target');
    if (t.acceptedEvents.includes('response-submitted') && b && !('activityRef' in b.props || 'activityRefs' in b.props || 'listeningRef' in b.props || 'writingRef' in b.props)) fail(t.id,'No activity evidence binding on Block');
  }
  for (const r of m.mediaRefs) if (r.admission && !admittedMedia(m,r)) fail(`mediaRefs.${r.id}`,'Invalid legacy media admission');
  // Annotated artifacts use the same full admission rule in the browser too.
  // Unannotated legacy/draft technical fixtures retain their old validation path.
  if ((options.published || m.mediaRefs.some(r=>r.admission)) && (m.snapshot.scope!=='chapter' || m.mediaRefs.some(r=>!admittedMedia(m,r)))) fail('snapshot','Published scope/media not ready');
  return issues.length ? {success:false,issues} : {success:true,data:m};
}
