export async function learningSessionHttp(operation:'catalog'|'resume'|'enter'|'dispatch',payload:unknown,signal:AbortSignal,blob?:Blob){
  signal.throwIfAborted();const input=operation==='catalog'||operation==='resume'?{operation,...payload as {sessionRef:string}}:{operation,payload};
  let body:BodyInit,headers:HeadersInit|undefined;
  if(blob){const form=new FormData();form.set('request',JSON.stringify(input));form.set('recording',blob,'recording.webm');body=form;}
  else{headers={'content-type':'application/json'};body=JSON.stringify(input);}
  const response=await fetch('/api/smart-textbook-runtime-audit/learning',{method:'POST',headers,body,signal,credentials:'same-origin'});
  if(!response.ok)throw Error('LEARNING_SESSION_REQUEST_FAILED');
  const value=response.headers.get('content-type')?.startsWith('application/json')?await response.json():await response.blob();signal.throwIfAborted();return value;
}
