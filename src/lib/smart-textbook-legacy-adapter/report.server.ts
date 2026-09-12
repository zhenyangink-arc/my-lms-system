import 'server-only';
export type ConversionStatus = 'converted' | 'preserved-in-compat' | 'ignored-safe' | 'unsupported';
export interface ConversionEntry {
  source:{ moduleId?:string; nodeId?:string; activityId?:string; mediaId?:string; teachingNodeId?:string; path:string };
  result:ConversionStatus;
  reason:string;
  target?:{ step?:string; block?:string; part?:string; ref?:string; capsule?:string };
}
export interface ConversionReport {
  chapter:string;
  sourceRevision:string;
  adapterRevision:string;
  modulesScanned:number;
  nodesScanned:number;
  activitiesScanned:number;
  mediaScanned:{ assets:number; listeningTracks:number; grammarAudio:number; speech:number; recordingDependencies:number };
  teachingNodesScanned:number;
  converted:ConversionEntry[];
  preservedInCompat:ConversionEntry[];
  ignoredSafe:ConversionEntry[];
  unsupported:ConversionEntry[];
  warnings:string[];
  runtimeReady:boolean;
}
export function record(report:ConversionReport,entry:ConversionEntry):void {
  const key=({'converted':'converted','preserved-in-compat':'preservedInCompat','ignored-safe':'ignoredSafe','unsupported':'unsupported'} as const)[entry.result];
  report[key].push(entry);
}
/** A classification for every field including containers and empty arrays, not just a key count. */
export function classifyTree(report:ConversionReport,value:unknown,entry:ConversionEntry):void {
  record(report,{...entry,source:{...entry.source},...(entry.target?{target:{...entry.target}}:{})});
  if(value && typeof value==='object') for(const [key,child] of Object.entries(value)) classifyTree(report,child,{...entry,source:{...entry.source,path:Array.isArray(value)?`${entry.source.path}[${key}]`:`${entry.source.path}.${key}`}});
}
