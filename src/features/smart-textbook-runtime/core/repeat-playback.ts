/** Existing repeat-line browser TTS semantics, not a teaching grant or verified
 * media evidence. Unsupported browsers fail instead of inventing an onend. */
export async function playRepeatLine(text:string,signal:AbortSignal,host:{
  create(text:string):SpeechSynthesisUtterance;speak(value:SpeechSynthesisUtterance):void;cancel():void;
}){
  signal.throwIfAborted();
  await new Promise<void>((resolve,reject)=>{
    const utterance=host.create(text);utterance.lang='ko-KR';utterance.rate=0.82;
    let settled=false;
    const finish=(error?:Error)=>{if(settled)return;settled=true;utterance.onend=null;utterance.onerror=null;signal.removeEventListener('abort',cancel);error?reject(error):resolve();};
    const cancel=()=>{finish(Error('REPEAT_CANCELLED'));host.cancel();};
    utterance.onend=()=>finish();utterance.onerror=()=>finish(Error('REPEAT_PLAYBACK_FAILED'));
    signal.addEventListener('abort',cancel,{once:true});
    if(signal.aborted)return cancel();
    try{host.speak(utterance);}catch{finish(Error('REPEAT_PLAYBACK_FAILED'));}
  });
  signal.throwIfAborted();
}
