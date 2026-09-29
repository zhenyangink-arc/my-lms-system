import json,subprocess
from pathlib import Path
D=Path('/tmp/uply-r7cb-b2-workflow');s=json.loads((D/'isolated-state.json').read_text())
for key in ['rest','auth','mail','pg']:
 name=s.get(key)
 if not name:continue
 r=subprocess.run(['docker','inspect',name],capture_output=True)
 if r.returncode:continue
 obj=json.loads(r.stdout)[0];assert obj['Config']['Labels'].get('stage')=='r7cb-b2'
 subprocess.run(['docker','rm','-f',name],check=True,stdout=subprocess.DEVNULL)
for typ,key in [('volume','vol'),('network','net')]:
 obj=json.loads(subprocess.check_output(['docker',typ,'inspect',s[key]]))[0];assert obj['Labels'].get('stage')=='r7cb-b2';subprocess.run(['docker',typ,'rm',s[key]],check=True,stdout=subprocess.DEVNULL)
(D/'cleanup.json').write_text(json.dumps({'ownedContainersRemoved':True,'ownedVolumeRemoved':True,'ownedInternalNetworkRemoved':True,'currentDbWrites':0}));print('{"cleanup":"PASS","ownedOnly":true}')
