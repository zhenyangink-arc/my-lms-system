import type { TextbookGrammarCard } from '@/lib/textbook-grammar-content';
import type { PublicationDiagnostic } from '@/lib/smart-textbook-publishing/diagnostics';
export type WorkbenchGrammarCard = {nodeId:string;cardId:string;expected:string;card:TextbookGrammarCard};
export type Pointer = { snapshotId: string; generation: number } | null;
export type WorkbenchActivity = {
  id: string; key: string; type: string; prompt: string; koreanPrompt: string;
  instruction: string; options: string[]; answerIndex: number | null;
  editable: boolean;
};
export type ChapterWorkbenchData = {
  title: string; version: number; pointer: Pointer;
  steps: { id: string; title: string; description: string;
    nodes: { id: string; title: string; activities: WorkbenchActivity[]; grammarCards?: WorkbenchGrammarCard[] }[];
    teaching: { title: string; script: string; version: number }[];
  }[];
};
export type PublicationCheck = {
  snapshotId: string; digest: string; expected: Pointer; steps: number; activities: number;
};
export type WorkbenchResult =
  | { ok: false; message: string; diagnostics?: PublicationDiagnostic[] }
  | { ok: true; kind: 'read'; data: ChapterWorkbenchData }
  | { ok: true; kind: 'begin'; state: 'draining' | 'editing'; inflight: number }
  | { ok: true; kind: 'save' }
  | { ok: true; kind: 'check'; check: PublicationCheck }
  | { ok: true; kind: 'publish'; pointer: Exclude<Pointer, null> };
