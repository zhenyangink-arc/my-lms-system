'use server';
import { requirePlatformOwner } from '@/lib/admin';
import { prepareCurrentExecution,readExecutionApproval,scopeFor } from './execution-composition.server.ts';
import { issueExecutionScope } from './execution-scope.server.ts';
import { createExecutionJournal } from './execution-journal.server.ts';
import { EXECUTION_DIRECTORY } from './execution-transport.server.ts';
import { startExecutionChild,executionCommand,restartReadOnly,recoverExecutionChild } from './execution-manager.server.ts';
import { completionRequestSchema } from '../../smart-textbook-runtime/core/execution-contracts.ts';
import { z } from 'zod';
export async function activateB3Execution(...args:unknown[]){
 await requirePlatformOwner();if(args.length)throw Error('B3_NO_BROWSER_CONFIG');
 const approval=await readExecutionApproval(),p=await prepareCurrentExecution(),s=await issueExecutionScope(scopeFor(p,approval),()=>p.reader.read());
 const {createDurableActivityRepository}=await import('../../smart-textbook-runtime/server/durable-activity-repository.server.ts');
 const before=await createDurableActivityRepository(p.transport).read(p.domain) as {attempts:unknown[];progress:unknown};
 if(before.attempts.length||before.progress)throw Error('B3_NOT_EMPTY');
 const j=createExecutionJournal(EXECUTION_DIRECTORY);await j.activate(s);
 try{await startExecutionChild(false);}catch{await j.disable();throw Error('B3_ACTIVATION_UNKNOWN');}
 return {manifest:p.manifest,context:p.context,state:{snapshotId:p.manifest.snapshot.id,revision:p.manifest.snapshot.contentDigest,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]}};
}
export async function b3ExecutionRequest(input:unknown){
 await requirePlatformOwner();
 const v=z.discriminatedUnion('operation',[
  z.strictObject({operation:z.enum(['readback','checkpoint','restore']),request:completionRequestSchema,pending:z.boolean().optional()}),
  z.strictObject({operation:z.literal('submit'),request:completionRequestSchema,optionId:z.string().regex(/^option-[0-2]$/)}),
  z.strictObject({operation:z.enum(['restart','disable'])}),
 ]).parse(input);
 if(v.operation==='restart')return restartReadOnly();
 return executionCommand(v);
}

export async function recoverB3ReadOnly(...args:unknown[]){
 await requirePlatformOwner();if(args.length)throw Error('B3_NO_BROWSER_CONFIG');
 const p=await prepareCurrentExecution(),j=createExecutionJournal(EXECUTION_DIRECTORY);await j.scope();await j.disable();await recoverExecutionChild();
 return {manifest:p.manifest,context:p.context,state:{snapshotId:p.manifest.snapshot.id,revision:p.manifest.snapshot.contentDigest,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]}};
}
