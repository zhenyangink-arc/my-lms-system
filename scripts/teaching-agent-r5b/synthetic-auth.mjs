// Real isolated GoTrue user/session; only synthetic credentials in private files.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const d=process.argv[2],s=JSON.parse(readFileSync(d+'/services.private.json')),k=JSON.parse(readFileSync(d+'/keys.private.json'));
const url=`http://127.0.0.1:${s.gatewayPort}`,options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,k.service,options),email=`r5b-${randomBytes(8).toString('hex')}@synthetic.invalid`,password=randomBytes(30).toString('base64url');
const made=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'R5B Synthetic Owner'}});
if(made.error)throw Error('ISOLATED_AUTH_CREATE_FAILED:'+made.error.code);
const client=createClient(url,k.anon,options),login=await client.auth.signInWithPassword({email,password});
if(login.error)throw Error('ISOLATED_AUTH_LOGIN_FAILED:'+login.error.code);
const actor={id:made.data.user.id,email,password,session:login.data.session};
writeFileSync(d+'/actor.private.json',JSON.stringify(actor),{mode:0o600});
console.log(JSON.stringify({realIsolatedAuth:true,syntheticOnly:true,productionAuthChanges:0}));
