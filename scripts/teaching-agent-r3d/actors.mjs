import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n));
const state=read('state.json'),keys=read('status.json'),users=read('users.private.json');
if(state.marker!=='uply-teaching-agent-r2-disposable-v1'||state.url!==`http://127.0.0.1:${state.ports.api}`||keys.API_URL!==state.url)throw Error('OWNED_LOCAL_REQUIRED');
const admin=createClient(state.url,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
for(const label of ['PO2','MA','UT','TB']){
 if(users[label])throw Error('ONE_SHOT');
 const email=`${label.toLowerCase()}-${state.project}@synthetic.invalid`,password=randomBytes(30).toString('base64url');
 const made=await admin.auth.admin.createUser({email,password,email_confirm:true});if(made.error)throw Error('ACTOR_CREATE_FAILED');
 const client=createClient(state.url,keys.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email,password});if(login.error)throw Error('ACTOR_LOGIN_FAILED');
 users[label]={id:made.data.user.id,email,password,session:login.data.session};
}
writeFileSync(d+'/users.private.json',JSON.stringify(users),{mode:0o600});
console.log(JSON.stringify({added:['PO2','MA','UT','TB'],realAuth:true}));
