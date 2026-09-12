import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';

/** No completion inference. Every transition invalidates async results and mounted resources. */
export class StepController {
  activeStepId: string;
  generation = 0;
  private stateRevision = 0;
  private abort = new AbortController();
  private disposers = new Set<() => void>();
  private listeners = new Set<() => void>();
  private completed: ReadonlySet<string>;
  readonly manifest:LessonManifestV1;
  constructor(manifest: LessonManifestV1, completed: readonly string[] = [], resume?: string) {
    this.manifest=manifest;
    this.completed = new Set(completed);
    this.activeStepId = resume && this.canEnter(resume) ? resume : manifest.navigation.entryStep;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => `${this.generation}:${this.activeStepId}:${this.stateRevision}`;
  canEnter(id: string) {
    const position = this.manifest.navigation.items.indexOf(id);
    return position >= 0 && (this.manifest.navigation.access === 'free'
      || this.manifest.navigation.items.slice(0,position).every(id => this.completed.has(id)));
  }
  serverCompletion(ids: readonly string[]) { this.completed = new Set(ids.filter(id=>this.manifest.navigation.items.includes(id))); this.stateRevision++; this.listeners.forEach(f => f()); }
  lease() { return { generation:this.generation, stepId:this.activeStepId, signal:this.abort.signal }; }
  isCurrent(lease: ReturnType<StepController['lease']>) { return !lease.signal.aborted && lease.generation === this.generation && lease.stepId === this.activeStepId; }
  onDispose(dispose: () => void) { this.disposers.add(dispose); return () => { this.disposers.delete(dispose); }; }
  private release() {
    this.abort.abort();
    const disposers = [...this.disposers]; this.disposers.clear();
    for (const dispose of disposers) { try { dispose(); } catch { /* Continue releasing other resources. */ } }
    this.generation++; this.abort = new AbortController();
  }
  go(id: string) {
    if (!this.canEnter(id)) throw Error('STEP_UNAVAILABLE');
    if (id === this.activeStepId) return;
    this.release(); this.activeStepId=id; this.listeners.forEach(f => f());
  }
  next() { const step=this.manifest.steps.find(s=>s.id===this.activeStepId); if(step?.nextStep)this.go(step.nextStep); }
  previous() { const i=this.manifest.navigation.items.indexOf(this.activeStepId); if(i>0)this.go(this.manifest.navigation.items[i-1]); }
  dispose() { this.release(); this.abort.abort(); this.listeners.clear(); }
}
