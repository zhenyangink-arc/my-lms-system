import {literal as q,json,service} from './recording-v2-postgres.mjs';
const ident=v=>{if(!/^[a-z_][a-z_0-9]*$/.test(v))throw Error('Unsafe test identifier');return `"${v}"`;};
const val=v=>v===null?'null':typeof v==='object'?json(v):typeof v==='number'||typeof v==='boolean'?String(v):q(v);
const allowed=new Set(['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','digital_textbook_nodes','digital_textbook_activities','digital_textbook_activity_secrets','digital_textbook_attempts','digital_textbook_node_progress','learning_agent_profiles','learning_agent_lessons','learning_agent_steps','learning_agent_sessions','learning_agent_messages','learning_agent_script_versions','learning_agent_script_nodes','learning_agent_node_attempts','learning_agent_task_events','learning_agent_script_audio_assets']);
const writable=new Set(['learning_agent_sessions','learning_agent_messages','learning_agent_node_attempts','learning_agent_task_events']);
export function teacherSqlTransport(db){
  const calls=[];return{calls,from(table){if(!allowed.has(table))throw Error(`Unexpected table ${table}`);let filters=[],order='',limit='',mutation=null,row=null,conflict=null;
    const b={select(){return b;},eq(k,v){filters.push(`${ident(k)}=${val(v)}`);return b;},in(k,vs){filters.push(`${ident(k)} in (${vs.map(val).join(',')})`);return b;},
      order(k,{ascending=true}={}){order=` order by ${ident(k)} ${ascending?'asc':'desc'}`;return b;},limit(n){if(!Number.isInteger(n)||n<1)throw Error('Bad limit');limit=` limit ${n}`;return b;},
      insert(v){mutation='insert';row=v;return b;},update(v){mutation='update';row=v;return b;},
      upsert(v,options){if(options.onConflict!=='session_id,node_id,event_type,target_key'||!options.ignoreDuplicates)throw Error('Unexpected conflict semantics');mutation='insert';row=v;conflict=options.onConflict;return b;},
      async maybeSingle(){const r=await finish();return{...r,data:r.data?.[0]??null};},async single(){const r=await finish();if(!r.error&&r.data.length!==1)throw Error('Expected one row');return{...r,data:r.data?.[0]??null};},then(resolve,reject){return finish().then(resolve,reject);}};
    async function finish(){const where=filters.length?` where ${filters.join(' and ')}`:'';let sql;
      if(mutation){if(!writable.has(table))throw Error(`Forbidden learning mutation ${table}`);const entries=Object.entries(row).filter(([,v])=>v!==undefined);
        const statement=mutation==='insert'?`insert into public.${ident(table)} (${entries.map(([k])=>ident(k)).join(',')}) values (${entries.map(([,v])=>val(v)).join(',')})${conflict?` on conflict (${conflict.split(',').map(ident).join(',')}) do nothing`:''}`:
          `update public.${ident(table)} set ${entries.map(([k,v])=>`${ident(k)}=${val(v)}`).join(',')}${where}`;
        sql=`with changed as (${statement} returning *) select coalesce(jsonb_agg(to_jsonb(changed)),'[]') from changed;`;
      }else sql=`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select * from public.${ident(table)}${where}${order}${limit})r;`;
      calls.push({table,mutation,conflict,filters:[...filters]});const result=await db.raw(service(sql));
      if(result.code)throw Error(`Isolated SQL ${table}: ${result.stderr}`);
      return{data:result.stdout?JSON.parse(result.stdout):[],error:null};
    }return b;
  }};
}
