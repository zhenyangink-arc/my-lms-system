import 'server-only';
import { z } from 'zod';
import { prepareCurrentExecution,composeExecution } from './execution-composition.server.ts';
import { createExecutionJournal } from './execution-journal.server.ts';
import { EXECUTION_DIRECTORY } from './execution-transport.server.ts';
const message=z.discriminatedUnion('operation',[
 z.strictObject({id:z.string(),operation:z.literal('start'),readOnly:z.boolean()}),
 z.strictObject({id:z.string(),operation:z.enum(['readback','restore','checkpoint']),request:z.unknown(),pending:z.boolean().optional()}),
 z.strictObject({id:z.string(),operation:z.literal('submit'),request:z.unknown(),optionId:z.string()}),
 z.strictObject({id:z.string(),operation:z.literal('disable')}),
]);
let service:Awaited<ReturnType<typeof composeExecution>>|undefined;
let serial=Promise.resolve();
/** Owned IPC child only. No listener, URL, CLI submission or independent runtime.
 * Parent owner action checks authorization on every request. */
export async function childMessage(raw:unknown){
 const m=message.parse(raw);
 if(m.operation==='start'){
  if(service)throw Error('B3_ALREADY_STARTED');const j=createExecutionJournal(EXECUTION_DIRECTORY),scope=await j.scope();
  if(m.readOnly)await j.disable();service=await composeExecution(await prepareCurrentExecution(),scope,j,m.readOnly);return {ready:true};
 }
 if(!service)throw Error('B3_CHILD_NOT_READY');
 if(m.operation==='disable'){await service.disable();return {state:'DISABLED'};}
 if(m.operation==='submit')return service.submit(m.request,m.optionId);
 if(m.operation==='restore')return service.restore(m.request,m.pending);
 return service[m.operation](m.request);
}
if(process.send){process.on('message',raw=>{serial=serial.then(async()=>{let id='invalid';try{const m=message.parse(raw);id=m.id;const value=await childMessage(m);process.send?.({id,ok:true,value});}catch{process.send?.({id,ok:false,error:'B3_INDEPENDENT_READBACK_REQUIRED'});}});});}

if(process.send)process.once('disconnect',()=>{void (async()=>{try{await service?.disable();}finally{process.exit(0);}})();});
