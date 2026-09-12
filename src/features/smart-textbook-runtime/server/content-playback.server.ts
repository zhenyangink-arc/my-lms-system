import 'server-only';
import type { PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';

/** Old ContentRenderer's concrete Korean speech controls. Frozen legacy paths
 * are lookup evidence only, never generated Runtime identities. No raw JSON
 * or media path crosses the service boundary. Orientation teaching grants and
 * guided-repeat markers remain owned by their existing dedicated executors. */
export function contentUtterances(bindings:PrivateBindings,capsuleRef:string){
  const c=bindings.capsules.find(c=>c.id===capsuleRef);
  if(c?.kind!=='learning')throw Error('CONTENT_PLAYBACK_CAPSULE');
  const allowed=new Set(['content.targets[]','content.vocabulary[]','content.patternCards[].examples[]',
    'content.quickResponse[]','content.personalOutput[]','content.substitutions[]','content.substitutionGroups[][]','content.repeatLines[]','content.dialogueGroups[].lines[]']);
  return bindings.identities.filter(i=>i.owner===c.nodeId&&allowed.has(i.legacyPath.replace(/\[\d+\]/g,'[]'))).map(i=>{
    const match=/^content\.([a-zA-Z]+)(.*)$/.exec(i.legacyPath);
    if(!match)throw Error('CONTENT_PLAYBACK_PATH');
    let value:unknown=c.sections.find(s=>s.slot===match[1])?.body;
    for(const token of match[2].matchAll(/\[(\d+)\]|\.([a-zA-Z]+)/g)){
      if(token[1]!==undefined){if(!Array.isArray(value))throw Error('CONTENT_PLAYBACK_ARRAY');value=value[Number(token[1])];}
      else {if(!value||typeof value!=='object')throw Error('CONTENT_PLAYBACK_FIELD');value=(value as {[key:string]:unknown})[token[2]];}
    }
    const text=typeof value==='string'?value:value&&typeof value==='object'&&'ko'in value?value.ko:null;
    if(typeof text!=='string'||!text.trim())throw Error('CONTENT_PLAYBACK_TEXT');
    return {partId:i.partId,text};
  });
}
