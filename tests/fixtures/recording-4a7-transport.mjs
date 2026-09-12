import { literal as q, json, service } from './recording-v2-postgres.mjs';
const identifier = value => { if(!/^[a-z_][a-z_0-9]*$/.test(value))throw Error('Unexpected isolated SQL identifier');return `"${value}"`; };
const value = v => v===null?'null':typeof v==='object'?json(v):typeof v==='boolean'||typeof v==='number'?String(v):q(v);
export function recordingSqlTransport(db, storage) {
  const log=[];
  const allowed=new Set(['digital_textbook_activities','digital_textbook_nodes','digital_textbook_activity_secrets','digital_textbook_speaking_evidence','digital_textbook_attempts','digital_textbook_node_progress','digital_textbook_guided_repeat_progress']);
  async function execute(sql) {
    const r=await db.raw(`\\set VERBOSITY verbose\n${service(sql)}`);
    if(r.code){log.push(r.stderr.split('\n')[0]);return {data:null,error:{code:r.stderr.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1]??'XX000',message:r.stderr}};}
    return {data:r.stdout?JSON.parse(r.stdout):null,error:null};
  }
  return {log,storage:{from:storage},async rpc(name,args){
    log.push(`rpc:${name}`);
    // PostgREST types the response parameter as JSONB even for numeric choices.
    const fn=identifier(name),parameters=Object.entries(args).map(([k,v])=>`${identifier(k)} => ${k==='p_response'?json(v):value(v)}`).join(',');
    const call=`public.${fn}(${parameters})`;
    const result=await execute(['record_smart_textbook_attempt','record_smart_textbook_speaking_attempt'].includes(name)
      ?`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from ${call} r;`:`select ${call};`);
    if(result.error?.code==='42883' && name==='recording_domain_request_v1')result.error={code:'PGRST202',message:'recording_domain_request_v1 not found'};
    return result;
  },from(name){
    if(!allowed.has(name))throw Error(`Not in isolated table allowlist: ${name}`);
    const table=`public.${identifier(name)}`;let filters=[],order='',limit='',mutation=null,rows=null;
    const builder={select(){return builder;},eq(k,v){filters.push(`${identifier(k)}=${value(v)}`);return builder;},
      or(expression){if(expression!=='metadata->runtimeBinding.not.is.null,metadata->lifecycle.not.is.null')throw Error('Unexpected isolated OR filter');filters.push("(metadata->'runtimeBinding' is not null or metadata->'lifecycle' is not null)");return builder;},
      neq(k,v){filters.push(`${identifier(k)}<>${value(v)}`);return builder;},lt(k,v){filters.push(`${identifier(k)}<${value(v)}`);return builder;},
      contains(k,v){filters.push(`${identifier(k)} @> ${json(v)}`);return builder;},is(k,v){if(v!==null)throw Error('Expected null');const column=['metadata->>practiceKey','metadata->>sceneId'].includes(k)?`metadata->>${q(k.split('->>')[1])}`:identifier(k);filters.push(`${column} is null`);return builder;},
      in(k,vs){filters.push(`${identifier(k)} in (${vs.map(value).join(',')})`);return builder;},
      order(k,{ascending=true}={}){order=` order by ${identifier(k)} ${ascending?'asc':'desc'}`;return builder;},limit(n){if(!Number.isInteger(n)||n<1)throw Error('Invalid limit');limit=` limit ${n}`;return builder;},
      insert(row){mutation='insert';rows=row;return builder;},update(row){mutation='update';rows=row;return builder;},delete(){mutation='delete';return builder;},
      async single(){const r=await finish();return r.error?r:r.data.length===1?{data:r.data[0],error:null}:{data:null,error:{message:'Expected one row'}};},
      async maybeSingle(){const r=await finish();return r.error?r:{data:r.data[0]??null,error:null};},then(resolve,reject){return finish().then(resolve,reject);},
    };
    async function finish(){
      const where=filters.length?` where ${filters.join(' and ')}`:'';let sql;
      if(mutation){log.push(`${mutation}:${name}`);
        const statement=mutation==='insert'?`insert into ${table}(${Object.keys(rows).map(identifier)}) values(${Object.values(rows).map(value)})`
          :mutation==='update'?`update ${table} set ${Object.entries(rows).map(([k,v])=>`${identifier(k)}=${value(v)}`).join(',')}${where}`:`delete from ${table}${where}`;
        sql=`with changed as (${statement} returning *) select coalesce(jsonb_agg(to_jsonb(changed)),'[]') from changed`;
      }else{
        const extra=name==='digital_textbook_nodes'?`,(select jsonb_build_object('digital_textbook_chapters',jsonb_build_object('version_id',c.version_id)) from public.digital_textbook_modules m join public.digital_textbook_chapters c on c.id=m.chapter_id where m.id=base.module_id) as digital_textbook_modules`:'';
        sql=`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select base.*${extra} from ${table} base${where}${order}${limit}) r`;
      }
      return execute(sql+';');
    }
    return builder;
  }};
}
