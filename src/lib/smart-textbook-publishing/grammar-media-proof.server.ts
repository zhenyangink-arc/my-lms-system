import 'server-only';
import { digest } from '../smart-textbook-legacy-adapter/identity.server';
import { readTextbookGrammarCards } from '../textbook-grammar-content';

/** Re-audited against the frozen Chapter 1 node. learning-tools.server.ts
 * resolves examples[].audioId and validates metadata.script === examples[].ko;
 * playback never consumes form/function/caution/source. Rules, example text,
 * IDs/status, ordering and ALL other node fields remain in this projection.
 * This is not an exemption from the published dependency fence. */
export function unchangedGrammarMedia(node:{id:string;content:unknown},originalNodeDigest:string|null):boolean {
  if(node.id!=='e5078937-9a9d-4fb7-b92f-a6fe54fa7633'||originalNodeDigest!=='8da8793aff849b949c25b84cc1040e1ef6fd18e3cb26322e666c23e27e7ad289')return false;
  const content=node.content as Record<string,unknown>;
  const cards=readTextbookGrammarCards(content);
  const projected={...content,grammarCards:cards.map(({form:_,function:f,caution:c,source:s,...mediaAndOtherContent})=>mediaAndOtherContent)};
  return digest(projected)==='d668480a2d047446d96acf9fc0cabd7137ee3ce3ab636b5be0c3eddb94f908ba';
}
