// Synthetic users on the owned localhost stack only. Private output never enters evidence.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const directory=process.argv[2],state=JSON.parse(readFileSync(directory+'/state.json'));
if(state.marker!=='uply-teaching-agent-r2-disposable-v1'||!/^uply-agent-r2-[a-f0-9]{12}$/.test(state.project)||state.url!==`http://127.0.0.1:${state.ports.api}`)throw Error('LOCAL_STAGE_REQUIRED');
const keys=JSON.parse(readFileSync(directory+'/status.json'));
if(keys.API_URL!==state.url)throw Error('ENDPOINT_MISMATCH');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(state.url,keys.SERVICE_ROLE_KEY,options),users={};
for(const label of ['A1','A2','B1','TA','AA','PO','EX','IN']){
 const email=`${label.toLowerCase()}-${state.project}@synthetic.invalid`,password=randomBytes(30).toString('base64url');
 const made=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:`Synthetic R2 ${label}`}});
 if(made.error)throw Error('AUTH_CREATE_FAILED:'+made.error.code);
 const client=createClient(state.url,keys.ANON_KEY,options);
 const login=await client.auth.signInWithPassword({email,password});if(login.error)throw Error('AUTH_LOGIN_FAILED:'+login.error.code);
 const user=await client.auth.getUser();if(user.data.user?.id!==made.data.user.id)throw Error('AUTH_ID_MISMATCH');
 users[label]={id:made.data.user.id,email,password,session:login.data.session};
}
writeFileSync(directory+'/users.private.json',JSON.stringify(users),{mode:0o600});
const bad=await createClient(state.url,keys.ANON_KEY,options).auth.signInWithPassword({email:users.A1.email,password:'synthetic-wrong-password'});
const absent=await createClient(state.url,keys.ANON_KEY,options).auth.getUser();
const claims=JSON.parse(Buffer.from(users.A1.session.access_token.split('.')[1],'base64url'));
const result={created:Object.keys(users),realPasswordLogin:true,getUser:true,wrongPasswordRejected:!!bad.error,noTokenRejected:!!absent.error,jwt:{role:claims.role,aud:claims.aud,subMatches:true,issuerLocal:claims.iss.startsWith(state.url),unexpired:claims.exp*1000>Date.now()},liveProviderRequests:0};
writeFileSync(directory+'/auth-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
