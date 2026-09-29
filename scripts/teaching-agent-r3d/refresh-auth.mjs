// Renew real disposable Auth sessions after long-running build/review work.
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),s=read('state.json'),k=read('status.json'),users=read('users.private.json');
if(s.marker!=='uply-teaching-agent-r2-disposable-v1'||s.url!==`http://127.0.0.1:${s.ports.api}`||k.API_URL!==s.url)throw Error('OWNED_LOCAL_REQUIRED');
for(const user of Object.values(users)){
 const client=createClient(s.url,k.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const result=await client.auth.signInWithPassword({email:user.email,password:user.password});
 if(result.error||result.data.user?.id!==user.id)throw Error('REAL_REAUTH_FAILED');
 user.session=result.data.session;
}
writeFileSync(d+'/users.private.json',JSON.stringify(users),{mode:0o600});
console.log(JSON.stringify({realAuthRefreshed:Object.keys(users).length}));
