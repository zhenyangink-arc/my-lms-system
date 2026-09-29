import 'server-only';
import { fork,type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { verifyCurrentEnvironment,CANONICAL_SOURCE } from './execution-transport.server.ts';
type Reply={id:string;ok:boolean;value?:unknown};
let child:ChildProcess|undefined;
const pending=new Map<string,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
function fail(){for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('B3_CHILD_UNKNOWN'));}pending.clear();child=undefined;}
export async function startExecutionChild(readOnly:boolean){
 await verifyCurrentEnvironment();if(child)throw Error('B3_CHILD_EXISTS');
 child=fork(join(CANONICAL_SOURCE,'.next/server/b3/child.cjs'),[],{cwd:CANONICAL_SOURCE,execArgv:[],stdio:['ignore','ignore','ignore','ipc'],env:{PATH:process.env.PATH,NODE_ENV:'production'}});
 child.on('error',fail);child.on('exit',fail);child.on('message',(m:Reply)=>{const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);if(m.ok)p.resolve(m.value);else p.reject(Error('B3_READBACK_REQUIRED'));});
 try{return await executionCommand({operation:'start',readOnly});}catch{child?.disconnect();throw Error('B3_CHILD_START_FAILED');}
}
export async function executionCommand(command:Record<string,unknown>){
 if(!child?.connected)throw Error('B3_CHILD_UNAVAILABLE');const id=randomUUID();
 return new Promise<unknown>((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('B3_CHILD_TIMEOUT_NO_RETRY'));},25000);pending.set(id,{resolve,reject,timer});child!.send({...command,id},e=>{if(e){clearTimeout(timer);pending.delete(id);reject(Error('B3_CHILD_UNKNOWN'));}});});
}
export async function restartReadOnly(){
 if(!child)throw Error('B3_CHILD_UNAVAILABLE');await executionCommand({operation:'disable'});
 const previous=child;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('B3_CHILD_STOP_UNKNOWN')),8000);previous.once('exit',()=>{clearTimeout(timer);resolve();});previous.kill('SIGTERM');});
 return startExecutionChild(true);
}

export async function recoverExecutionChild(){return child?restartReadOnly():startExecutionChild(true);}
