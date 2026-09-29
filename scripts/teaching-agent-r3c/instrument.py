"""Add request attribution only in the owned instrumented Next copy."""
import json,pathlib,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import ROOT,load
stage=pathlib.Path(sys.argv[1]);load(stage)
subprocess.run(['python3',str(ROOT/'scripts/teaching-agent-r3/instrument.py'),str(stage)],check=True)
dest=stage/'next'
(dest/'src/instrumentation-r3c-observer.ts').write_text('''import {AsyncLocalStorage} from 'node:async_hooks';
const key=Symbol.for('uply.r3c.agent-observation');
const scope=globalThis as typeof globalThis & {[key]?:AsyncLocalStorage<boolean>};
export const agentObservation=scope[key]??=(new AsyncLocalStorage<boolean>());
''')
p=dest/'src/app/api/teaching-agent/runs/route.ts';s=p.read_text();assert 'export const POST = studentTransport.post;' in s
p.write_text("import {agentObservation} from '@/instrumentation-r3c-observer';\n"+s.replace('export const POST = studentTransport.post;','export const POST = (request: Request) => agentObservation.run(true, () => studentTransport.post(request));'))
p=dest/'scripts/teaching-agent-r2/observed-fetch.ts';s=p.read_text();assert 'JSON.stringify({at,path:u.pathname,method,kind})' in s
p.write_text("import {agentObservation} from '../../src/instrumentation-r3c-observer';\n"+s.replace('JSON.stringify({at,path:u.pathname,method,kind})','JSON.stringify({at,path:u.pathname,method,kind,agentRequest:agentObservation.getStore()===true})'))
print(json.dumps({'privateOnly':True,'formalRoute':True,'agentRequestAttribution':True,'authPolicyBypass':False}))
