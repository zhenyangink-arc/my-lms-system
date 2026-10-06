import 'server-only';
import {createHmac,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireActiveUser} from '../../../lib/auth';
import {createAdminClient} from '../../../lib/supabase/admin';
import {recordingEvidenceV2,EnvironmentRecordingProofKeyProvider} from '../../../lib/recording-domain.server';
import {authorizeRuntimeApplication} from './application-access.server';
import {loadPublishedRuntimeSnapshot} from '../../../lib/smart-textbook-publishing/loader.server';
import {validateRuntimeActivation} from '../core/block-registry';

const policySchema=z.strictObject({eligible:z.boolean(),revision:z.number().int().positive()});
/** DB policy is read on EVERY decision. Env is a deployment ceiling, not a
 * replica-local kill switch. No request parameter can choose a cohort or mode. */
export async function runtimeAdmissionPolicy(){
 if(process.env.SMART_TEXTBOOK_RUNTIME_ADMISSION_ENABLED!=='true')return {eligible:false,revision:0};
 const auth=await requireActiveUser();if(!auth.tenant||auth.profile?.role!=='student')return {eligible:false,revision:0};
 const r=await createAdminClient().rpc('runtime_admission_state_v1',{p_tenant:auth.tenant.id,p_student:auth.user.id});
 if(r.error)throw Error('RUNTIME_ADMISSION_CONTROL_UNAVAILABLE');return policySchema.parse(r.data);
}
export async function assertRuntimeDependencies(){
 const a=await authorizeRuntimeApplication(),owner={tenantId:a.tenantId,studentId:a.auth.user.id};
 const config=recordingEvidenceV2(process.env,owner);if(config.domain!=='v2')throw Error('RUNTIME_REQUIRES_RECORDING_V2');
 const key=await new EnvironmentRecordingProofKeyProvider().get(),nonce=randomUUID(),time=Math.floor(Date.now()/1000);
 const message=['runtime-admission/1',owner.tenantId,owner.studentId,config.epoch,config.instance,key.keyId,nonce,time].join('|');
 const r=await a.admin.rpc('runtime_recording_dependency_v1',{p_tenant:owner.tenantId,p_student:owner.studentId,p_epoch:config.epoch,p_instance:config.instance,
  p_key:key.keyId,p_nonce:nonce,p_time:time,p_mac:createHmac('sha256',key.secret).update(message).digest('hex')});
 if(r.error||r.data?.ready!==true||r.data.epoch!==config.epoch)throw Error('RUNTIME_RECORDING_DEPENDENCY_UNAVAILABLE');
 // Presence/shape, not a claim of remote object health. Byte owners still use
 // normal authorization and report storage outages; never substitute Preview.
 for(const k of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'])if(!process.env[k])throw Error('RUNTIME_MEDIA_CONFIG_MISSING');
 if(!/^[a-z0-9]+$/i.test(process.env.R2_ACCOUNT_ID!))throw Error('RUNTIME_MEDIA_CONFIG_INVALID');
 return a;
}
export async function runtimePageDecision(input:{chapterNumber:number;platformAudit:boolean}):Promise<'legacy'|'runtime'|'unavailable'>{
 if(input.chapterNumber!==1||input.platformAudit)return 'legacy';
 try{
  const p=await runtimeAdmissionPolicy();if(!p.eligible)return 'legacy';
  await assertRuntimeDependencies();const current=await loadPublishedRuntimeSnapshot();
  if(!validateRuntimeActivation(current.bundle.manifest).success)throw Error('RUNTIME_CAPABILITY');
  return 'runtime';
 }catch{return 'unavailable';}
}
