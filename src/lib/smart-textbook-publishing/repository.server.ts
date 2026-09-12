import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { canonical } from '../smart-textbook-legacy-adapter/identity.server';
import { scopeSchema, assertPublishableSnapshot, type PublicationScope, type PublicationBundle } from './artifact.server';
export const pointerSchema=z.strictObject({snapshotId:z.string().min(1),generation:z.number().int().positive()});
export type PublicationPointer=z.infer<typeof pointerSchema>;
export function publicationRepository(admin:SupabaseClient) {
  const rpc=async(name:string,args:object)=>{const r=await admin.rpc(name,args);if(r.error)throw Error(`PUBLICATION_RPC: ${r.error.message}`);return r.data as unknown;};
  return {
    async current(scope:PublicationScope){
      const r=await rpc('read_runtime_publication_v1',{p_scope:scopeSchema.parse(scope)});
      if(!r)throw Error('PUBLICATION_POINTER_MISSING');
      const row=z.strictObject({pointer:pointerSchema,bundle:z.unknown()}).parse(r),bundle=assertPublishableSnapshot(row.bundle);
      if(row.pointer.snapshotId!==bundle.snapshotId||canonical(scope)!==canonical(bundle.scope))throw Error('PUBLICATION_POINTER_ASSOCIATION');
      return {pointer:row.pointer,bundle};
    },
    async publish(actorId:string,bundle:PublicationBundle,expected:PublicationPointer|null){
      const b=assertPublishableSnapshot(bundle);
      if(!b.privatePayload.dependencies)throw Error('PUBLICATION_CAPTURE_REQUIRED');
      return pointerSchema.parse(await rpc('publish_runtime_snapshot_v2',{p_actor:actorId,p_scope:b.scope,p_expected:expected&&pointerSchema.parse(expected),p_operation:'publish',p_bundle:b,p_target:null}));
    },
    async rollback(actorId:string,scope:PublicationScope,target:string,expected:PublicationPointer){
      const b=assertPublishableSnapshot(await rpc('read_runtime_snapshot_for_owner_v1',{p_actor:actorId,p_scope:scopeSchema.parse(scope),p_snapshot:target}));
      if(b.snapshotId!==target||canonical(b.scope)!==canonical(scope))throw Error('PUBLICATION_ROLLBACK_ASSOCIATION');
      return pointerSchema.parse(await rpc('publish_runtime_snapshot_v2',{p_actor:actorId,p_scope:scopeSchema.parse(scope),p_expected:pointerSchema.parse(expected),p_operation:'rollback',p_bundle:null,p_target:target}));
    },
    history:(actorId:string,scope:PublicationScope)=>rpc('read_runtime_publication_v1',{p_scope:scopeSchema.parse(scope),p_history_actor:actorId}),
    session:async(operation:'issue'|'resolve'|'revoke',actorId:string,tenantId:string,options:{ref?:string;scope?:PublicationScope;expected?:PublicationPointer;locale?:'zh-CN'|'ko-KR'}={})=>{
      const r=await rpc('runtime_publication_session_v1',{p_operation:operation,p_actor:actorId,p_tenant:tenantId,p_ref:options.ref??null,p_scope:options.scope??null,p_expected:options.expected??null,p_locale:options.locale??'zh-CN'});
      if(operation==='revoke')return null;
      const row=z.strictObject({sessionRef:z.string().regex(/^learning-session-[0-9a-f-]{36}$/),expiresAt:z.number(),locale:z.enum(['zh-CN','ko-KR']),bundle:z.unknown()}).parse(r);
      return {...row,bundle:assertPublishableSnapshot(row.bundle)};
    },
  };
}
