/** Host-provided course route only. Never infer navigation from browser history,
 * chapter titles or Manifest content. */
export function courseReturnHref(value:string|undefined):string|null{
  if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\s#%]/.test(value))return null;
  if(!/^\/(?:[a-zA-Z0-9_-]+\/)?dashboard\/courses(?:\/[a-zA-Z0-9_-]+)*\/?(?:\?course=[a-zA-Z0-9_-]+)?$/.test(value))return null;
  return value;
}
