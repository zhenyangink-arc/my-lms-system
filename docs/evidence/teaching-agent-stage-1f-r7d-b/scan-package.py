from pathlib import Path
import json,hashlib,tarfile,shutil,datetime
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7d-b';D=Path('/tmp/uply-r7d-b-candidate');A=R/'build/r7d-b-candidate';A.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
locks=json.loads((E/'candidate-source-lock.json').read_text());files=locks['files'];assert all(sha(R/p)==h and sha(D/p)==h for p,h in files.items())
C=json.loads(Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json').read_text())
secrets=[str(v) for k,v in C.items() if any(w in k.upper() for w in ['SECRET','SERVICE_ROLE','PASSWORD','PRIVATE_KEY']) and isinstance(v,str) and len(v)>10]
private=Path('/home/yangzhen/.config/uply-first-enable-20260910/db/pgpass').read_text();secrets.extend(l.split(':')[-1] for l in private.splitlines() if l and not l.startswith('#'))
markers=['native-choice-response/1','privateDefinitionDigest','FACTS_READ_ONLY_REQUIRED','B3_DB_CREDENTIAL_BINDING','/home/yangzhen/.config/uply-first-enable-20260910','cf4d2db0a75301af51a807149b0ed32134ce69db7e3767251816b9232722afbe','development-domain-execution@synthetic.invalid']
scanned=0;fail=[]
for p in (D/'.next/static').rglob('*'):
 if not p.is_file():continue
 b=p.read_bytes();scanned+=1
 if any(v.encode() in b for v in secrets+markers):fail.append(str(p.relative_to(D)))
assert not fail,'CLIENT_PRIVATE_BOUNDARY_FAILED (values withheld)'
route='/[space]/dashboard/admin/development-execution/lesson-facts/page'
manifest=json.loads((D/'.next/server/app-paths-manifest.json').read_text());assert route in manifest
refs=list((D/'.next/server/app/[space]/dashboard/admin/development-execution/lesson-facts').glob('*client-reference-manifest.js'))
assert refs and all('lesson-facts-readonly.server' not in p.read_text() and 'get-current-lesson-execution-facts' not in p.read_text() for p in refs)
for name,paths in [('candidate-build.tar.gz',[D/'.next']),('candidate-source.tar.gz',[D/p for p in files])]:
 with tarfile.open(A/name,'w:gz') as t:
  for p in paths:t.add(p,arcname=str(p.relative_to(D)),filter=lambda x:None if x.name.startswith('.next/cache') else x)
artifacts={p.name:{'path':str(p),'sha256':sha(p),'bytes':p.stat().st_size} for p in A.glob('*.tar.gz')}
scan={'status':'PASS','clientFilesScanned':scanned,'actualPrivateConfigValuesExposed':0,'serverMarkersExposed':0,'newRouteServerOnly':True,'unitDtoNoSecrets':'PASS','isolatedDbAndBrowserBoundaries':'PASS','currentDbToolDOMNetwork':'NOT EXECUTED - deploy approval pending','privateDefinitionDigestExposed':False,'rawSubjectIdsExposed':False}
(E/'r7d-private-boundary-result.json').write_text(json.dumps(scan,indent=2)+'\n')
L=Path('/home/yangzhen/releases/uply-first-enable-20260910/source');presence={}
for p in files:
 f=L/p;presence[p]={'exists':f.exists(),'mode':oct(f.stat().st_mode&0o777) if f.exists() else None,'sha256':sha(f) if f.exists() else None}
build=(D/'.next/BUILD_ID').read_text().strip();live=(L/'.next/BUILD_ID').read_text().strip();assert live=='KaSWaVYOIk7ZjWGpvVWIf'
package={'approval':'R7D-B Deploy','status':'READY - AWAITING USER APPROVAL','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':'canonical UPLY :8443','currentBuild':live,'candidateBuild':build,'artifacts':artifacts,'modifiedProductFiles':list(json.loads((E/'source-before.json').read_text())),'newProductFiles':[p for p in files if p not in json.loads((E/'source-before.json').read_text())],'sourceHashes':files,'productFileCount':8,'scopeExtensionEvidence':'scope-extension.json','dependenciesChanged':0,'packageChanged':False,'lockfileChanged':False,'migration':'NONE','dbSchemaWrites':0,'rls':'UNCHANGED','studentPolicy':'UNCHANGED','auth':'UNCHANGED','ledger':458,'rpc':'UNCHANGED','businessWrites':0,'scope':'DISABLED','agentRuns':0,'provider':0,'feature':'OFF','allowlists':'EMPTY','pm2Target':'uply-first-enable','deploymentPerformed':False,'candidateBuildIncludes':'existing B3 child and media artifact rebuilt from same locked source; no scenario execution','rollback':{'root':'/home/yangzhen/operations/uply/teaching-agent/r7d-b/<approved-deployment-UTC>/rollback','paths':presence,'method':'Preserve previous .next and exact eight path presence/mode/hash before stop. Switch only .next and exact eight files. On deployment failure restore .next and original files; delete only manifest-proven absent new paths. Start same PM2 only. No DB/config/journal/dependency/public changes.'},'acceptanceAfterApproval':{'route':'/platform/dashboard/admin/development-execution/lesson-facts','operator':'existing normal Platform Owner browser session','pipeline':'Core executor -> Tool -> Domain Port -> single-snapshot trusted read','expected':'attempts2/latest CORRECT/completed100/mastery100/CURRENT_DEVELOPMENT_DB','dbWrites':0,'noScopeActivation':True,'prePostFingerprints':'r7d-current-db-readonly-plan.json'}}
(E/'approval-r7d-lesson-tool-deploy.json').write_text(json.dumps(package,indent=2)+'\n')
for n in ['new-tests','regression','browser-regression','typegen','typecheck','lint','build']:
 shutil.copyfile('/tmp/r7d-'+n+'.log',E/(n+'.log'))
print(json.dumps({'candidateBuild':build,'artifacts':artifacts,'scan':scan}))
