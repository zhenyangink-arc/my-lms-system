import 'server-only';
import { z } from 'zod';
import { profile } from '../smart-textbook-legacy-adapter/profile.server';
import type { LegacyChapterOneSource } from '../smart-textbook-legacy-adapter/source.server';
import type { ConversionEntry } from '../smart-textbook-legacy-adapter/report.server';
import type { PublicationDiagnostic } from './diagnostics';

const descriptions = {
  identity: {area:'内容身份',message:'内容与已保存的稳定身份不一致。请核对最近修改；此类修改需要补齐身份映射，不能直接发布。',action:'content'},
  content: {area:'学习内容',message:'此处内容不符合当前支持的结构。请核对最近修改；不要通过删除字段绕过检查。',action:'content'},
  teaching: {area:'教学脚本',message:'教学版本、节点或任务依赖未通过兼容校验。请核对已发布脚本；当前教材编译仍受 v23 兼容范围限制。',action:'teaching'},
  media: {area:'图片与音频',message:'媒体或关联内容已变化，原媒体准入证据不再适用。请核对素材与播放文本，并完成媒体复核；不要直接更改 ready 状态。',action:'content'},
  binding: {area:'运行依赖',message:'目标、进度或服务绑定未通过校验。请保留当前数据并联系维护人员核对；本次不会跳过检查。',action:'refresh'},
  capture: {area:'内容读取',message:'无法取得一致的教材数据。请刷新后重试；若仍失败，请联系维护人员检查读取权限和编辑窗口。',action:'refresh'},
  format: {area:'内容格式',message:'已保存数据不符合当前内容契约。请核对最近修改；原始数据和私密配置不会显示在错误提示中。',action:'content'},
} as const;

function item(code:PublicationDiagnostic['code'],moduleId?:string):PublicationDiagnostic {
  const step=Object.values(profile).find(p=>p.moduleId===moduleId);
  return {code,stepId:step?.moduleId??null,stepTitle:step?.title['zh-CN']??'第一章',...descriptions[code]};
}
export class PublicationDiagnosticError extends Error {
  readonly diagnostics:PublicationDiagnostic[];
  constructor(diagnostics:PublicationDiagnostic[]){
    super('PUBLICATION_DIAGNOSTIC');
    this.diagnostics=diagnostics;
  }
}
export function compilationDiagnostics(source:LegacyChapterOneSource,entries:ConversionEntry[]):PublicationDiagnostic[] {
  const rows=entries.map(e=>{
    const loc=e.source;
    const node=source.nodes.find(n=>n.id===loc.nodeId)||source.nodes.find(n=>source.activities.some(a=>a.id===loc.activityId&&a.node_id===n.id));
    const media=source.media.find(m=>m.id===loc.mediaId);
    const moduleId=loc.moduleId??node?.module_id??source.nodes.find(n=>n.id===media?.node_id)?.module_id;
    // Only internal categories are recognized. No source title, reason or JSON
    // path is echoed, even when the source contains hostile/private strings.
    const path=loc.path;
    const code:PublicationDiagnostic['code']=path.startsWith('identityMap')||e.reason==='Missing or ambiguous frozen identity allocation'?'identity'
      :loc.teachingNodeId||path.startsWith('teaching')||path.startsWith('configuration')?'teaching'
      :path.startsWith('media')||path.startsWith('speech')?'media'
      :path.startsWith('content')||path.startsWith('public_config')?'content':'binding';
    return item(code,moduleId);
  });
  return [...new Map(rows.map(r=>[`${r.code}:${r.stepId}`,r])).values()];
}
export function publicationDiagnostics(error:unknown):PublicationDiagnostic[] {
  if(error instanceof PublicationDiagnosticError)return error.diagnostics;
  if(error instanceof z.ZodError)return [item('format')];
  const message=error instanceof Error?error.message:'';
  if(message==='PUBLICATION_CAPTURE_UNAVAILABLE'||message.startsWith('CAPTURE_'))return [item('capture')];
  if(message.startsWith('GRAMMAR_IDENTITY_'))return [item('identity',profile.grammar.moduleId)];
  if(message.startsWith('PUBLICATION_MEDIA_'))return [item('media')];
  if(message.startsWith('PUBLICATION_BINDINGS_')||message.startsWith('PUBLICATION_ADMISSION:')||message==='PUBLICATION_COMPILE_BLOCKED')return [item('binding')];
  return [];
}
export function mediaDiagnostic(moduleId?:string){return item('media',moduleId);}
