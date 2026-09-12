import type { TeacherKimPose } from '../../../lib/teacher-kim-character.ts';
import type { TtsPlaybackOwner } from './playback.ts';
export type TeacherIntent='start'|'ready'|'hint'|'example'|'answer';
export type TeacherTurn={
  text:string; cueId:string; phase:'explanation'|'task'|'task_feedback'|'question';
  character:{pose:TeacherKimPose;voiceEnabled:boolean;voiceRate:number}|null;
  speechAssetId:string|null;
  buffer:{text:string;assetId:string|null};
  blackboard:Array<{id:string;content:string;translation:string;x:number;y:number;width:number;height:number;fontSize:number;align:'left'|'center'|'right'}>;
  task:{target:string;instruction:string;playbackGrantAvailable:boolean}|null;
  visualTarget:string|null; awaitingAnswer:boolean; questionOptions:string[];
  terminal:boolean; continueLabel:string; unsupported:string[];
  playbackOwner?:TtsPlaybackOwner|null;
};
export type TeacherServices={
  turn(teachingRef:string,generation:number,intent:TeacherIntent,answer:string|undefined,signal:AbortSignal):Promise<TeacherTurn>;
  cancel(generation:number):Promise<void>;
  speech?(kind:'speech'|'buffer',cueId:string,generation:number,signal:AbortSignal):Promise<Blob>;
  character?(cueId:string,generation:number,signal:AbortSignal):Promise<Blob>;
};
