import 'server-only';
import { open,lstat,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { assertExecutionScope, type ExecutionScope } from './execution-scope.server.ts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
/** Private two-slot dispatch journal; stores no answer, correctness or progress.
 * A claim is never released on timeout/UNKNOWN. Reuse means readback only. */
export function createExecutionJournal(directory:string){
 const file=(name:string)=>join(directory,name);
 async function check(){const s=await lstat(directory);if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o077)||s.uid!==process.getuid?.())throw Error('EXECUTION_JOURNAL_PRIVATE');}
 async function exclusive(name:string,value:unknown){await check();const h=await open(file(name),'wx',0o600);try{await h.writeFile(JSON.stringify(value)+'\n');await h.sync();const d=await open(directory,'r');try{await d.sync();}finally{await d.close();}}finally{await h.close();}}
 return {
  async activate(scope:ExecutionScope){assertExecutionScope(scope);await exclusive('scenario.json',scope);},
  async scope(){await check();const s=await lstat(file('scenario.json'));if(s.isSymbolicLink()||(s.mode&0o077)||s.uid!==process.getuid?.())throw Error('EXECUTION_JOURNAL_PRIVATE');return assertExecutionScope(JSON.parse(await readFile(file('scenario.json'),'utf8')),Date.now(),false);},
  async claim(scope:ExecutionScope,slot:0|1,requestId:string,generation:number){
   assertExecutionScope(scope);if((slot!==0&&slot!==1)||!requestId||requestId.length>200)throw Error('EXECUTION_SLOT_INVALID');if(generation!==scope.generation)throw Error('STALE_EXECUTION_GENERATION');
   await check();const persisted=await readFile(file('scenario.json'),'utf8');if(hash(JSON.stringify(JSON.parse(persisted)))!==hash(JSON.stringify(scope)))throw Error('EXECUTION_SCOPE_MISMATCH');
   const closed=await lstat(file('disabled')).then(()=>true, e=>{if(e.code==='ENOENT')return false;throw e;});if(closed)throw Error('EXECUTION_SCOPE_CLOSED');
   await exclusive(`dispatch-${slot}.json`,{scenarioId:scope.scenarioId,requestHash:hash(requestId),generation,slot});
   assertExecutionScope(scope); // No I/O can prolong the authorization.
  },
  async disable(){await exclusive('disabled',{state:'DISABLED'}).catch(e=>{if(e.code!=='EEXIST')throw e;});},
  async enabled(){await check();try{await lstat(file('disabled'));return false;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return true;throw e;}},
 };
}
