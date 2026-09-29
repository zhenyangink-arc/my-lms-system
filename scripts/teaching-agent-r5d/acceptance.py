#!/usr/bin/env python3
"""R5D fixed read-only acceptance. No production mutation or business RPC path.

No CLI SQL, credentials, target or scope overrides. Only safe evidence and a
private acceptance receipt are written. Temporary credentials are removed.
"""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/teaching-agent-r4c'))
import inventory as inv
import catalog_contract as contract
import readonly_transport as transport
import datetime as dt,hashlib,http.client,json,os,stat,tarfile,time
from urllib.parse import urlsplit
EV=ROOT/'docs/evidence/teaching-agent-stage-1f-r5d'
WINDOW=json.loads(Path('/tmp/uply-r5d-observation.json').read_text())
PRIOR=ROOT/'docs/evidence/teaching-agent-stage-1f-r5c'
REF=json.loads((PRIOR/'production-end-state.json').read_text())
BUILD='6IhDHN8Dm1nCewiCEZnV5'
SHA='1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28'
LIVE=Path('/home/yangzhen/releases/uply-first-enable-20260910/source')
CANDIDATE=Path('/home/yangzhen/artifacts/uply-teaching-agent-foundation-r3d/candidate-build.tar.gz')
BASE_FULL='cfdade473cb06c8169399c2b99686dec7e3d466965ad9d0d3fd8ea26b5899b03'
BASE_NAMES='d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981'
def now():return dt.datetime.now(dt.timezone.utc)
def budget():
 assert now()<dt.datetime.fromisoformat(WINDOW['observationDeadlineUtc']) and time.monotonic()-WINDOW['startMonotonic']<1800,'OBSERVATION_BUDGET_EXPIRED'
def save(name,value):
 EV.mkdir(exist_ok=True,parents=True)
 (EV/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def normalized(v):
 if isinstance(v,dict):return {k:normalized(x) for k,x in v.items()}
 if isinstance(v,list):return sorted((normalized(x) for x in v),key=lambda x:json.dumps(x,sort_keys=True))
 return v
class FixedReadonly:
 def execute(self,sql):
  budget()
  assert sql.strip().startswith('BEGIN READ ONLY;') and sql.strip().endswith('ROLLBACK;')
  output=transport.query(sql)
  return {'code':0,'stdout':output}
def jsonquery(sql):return next(json.loads(x) for x in FixedReadonly().execute(sql)['stdout'].splitlines() if x.startswith('{'))
def operations():
 budget();ops=inv.operations()
 for x in ops['tailscale']['bindings']:
  url=urlsplit(x.pop('proxy'));x.update(targetAddress=url.hostname,targetPort=url.port)
 raw=json.loads(inv.run(['pm2','jlist']))
 ops['otherPm2Apps']=[{'name':p['name'],'pid':p.get('pid',0),**{k:p['pm2_env'].get(k) for k in ('status','restart_time','pm_uptime','pm_cwd','pm_exec_path')}} for p in raw if p['name']!='uply-first-enable']
 app=next(p for p in raw if p['name']=='uply-first-enable')['pm2_env']
 return ops,{k:app.get(k) for k in ('node_version','exec_interpreter')}
def assertops(ops):
 assert ops['runtime']==REF['operations']['runtime'],'RUNTIME_DRIFT'
 assert ops['launcherSha256']==REF['operations']['launcherSha256'],'LAUNCHER_DRIFT'
 assert ops['tailscale']==REF['operations']['tailscale'],'TAILSCALE_DRIFT'
 assert ops['otherPm2Apps']==REF['operations']['otherPm2Apps'],'OTHER_PM2_DRIFT'
 assert ops['pm2']==REF['operations']['pm2'],'NAMED_PM2_DRIFT'
def ledger(plan):
 expr="encode(sha256(convert_to(coalesce((select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version)::text from supabase_migrations.schema_migrations where version<='202609130003'),'[]'),'UTF8')),'hex')"
 sql="BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; SELECT json_build_object('ledger',(select json_agg(json_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations),'baseFullDigest',"+expr+",'newRows',(select json_agg(json_build_object('version',version,'name',name,'statements',statements) order by version) from supabase_migrations.schema_migrations where version>'202609130003'));ROLLBACK;"
 snap=jsonquery(sql)
 assert len(snap['ledger'])==457 and inv.digest(snap['ledger'][:449])==BASE_NAMES and snap['baseFullDigest']==BASE_FULL,'LEDGER_PREFIX_DRIFT'
 assert snap['ledger'][449:]==[{k:m[k] for k in ('version','name')} for m in plan],'LEDGER_RANGE_DRIFT'
 assert snap['newRows']==[{'version':m['version'],'name':m['name'],'statements':[m['sql']]} for m in plan],'STORED_SQL_DRIFT'
 return {'status':'PASS','count':457,'latest':'202609140007','old449VersionNameSha256':BASE_NAMES,'old449FullSqlSha256':BASE_FULL,'old449Prefix':'UNCHANGED','eightMigrationSql':'MATCH','fullVersionNameSha256':inv.digest(snap['ledger']),'migrations':[{k:m[k] for k in ('version','name','filename','sha256')} for m in plan]}
def main():
 budget();save('authorization-scope',{'scope':'READ-ONLY ACCEPTANCE ONLY','userRequest':'Stage 1F-R5D','productionChangesAuthorized':False,'authenticatedSessionAvailable':False,'privateAcceptanceReceiptAuthorized':True,'r5cHistoricalStatus':'CONDITIONAL — WINDOW EXPIRED / EXECUTION INCOMPLETE'})
 save('observation-window',{**WINDOW,'maximumObservationMinutes':30,'productionMaintenanceWindow':False})
 db=inv.database();db.pop('expectedStateMatches',None)
 for k in ('projectIdentitySha256','hostIdentitySha256','serverVersion'):
  assert db[k]==REF['database'][k],'TARGET_DRIFT'
 assert db['migrationLedgerCount']==457 and db['latestMigration']['version']=='202609140007' and db['agentTables']==5,'INSTALLED_STATE_DRIFT'
 save('production-identity',{'status':'MATCH',**{k:db[k] for k in ('observedAt','readOnly','serverVersion','projectIdentitySha256','hostIdentitySha256','sslmode','clientTls')},'identityBasis':'verify-full connection target matches approved runtime project and R5C hashes'})
 ops,extra=operations();assertops(ops)
 save('runtime-launcher',{'status':'UNCHANGED','runtime':ops['runtime'],'launcherSha256':ops['launcherSha256'],'launcherPath':ops['pm2']['pm_exec_path']})
 save('pm2',{'status':'PASS','namedApp':ops['pm2'],**extra,'otherAppsUnchanged':True,'otherApps':ops['otherPm2Apps'],'mutations':0})
 save('tailscale',{'status':'UNCHANGED',**ops['tailscale'],'port9443Present':False,'mutations':0})
 locked=json.loads((ROOT/'scripts/teaching-agent-r5b/locked-package.json').read_text())['migrations']
 prior=json.loads((ROOT/'docs/evidence/teaching-agent-stage-1f-r5a/migration-package.json').read_text())['migrations']
 assert locked==[{k:m[k] for k in ('version','name','filename','sha256')} for m in prior]
 assert [m['version'] for m in locked]==['20260914000'+str(i) for i in range(8)]
 found=sorted(p.name for p in (ROOT/'supabase/migrations').iterdir() if p.suffix=='.sql' and p.name[:12]>'202609130003')
 assert found==[m['filename'] for m in locked],'PACKAGE_RANGE_DRIFT'
 plan=[]
 for m in locked:
  p=ROOT/'supabase/migrations'/m['filename'];assert p.is_file() and not p.is_symlink() and inv.sha(p)==m['sha256'],'MIGRATION_HASH_DRIFT'
  plan.append({**m,'sql':p.read_text()})
 initial=ledger(plan);save('ledger-verification',initial)
 v,checks=contract.verify(FixedReadonly(),plan)
 reference=json.loads(Path('/home/yangzhen/operations/uply/teaching-agent/foundation-install/20260916T025809Z/catalog.private.json').read_text())
 exact={k:normalized(v[k])==normalized(reference[k]) for k in v}
 save('foundation-objects',{'status':'PASS' if all(checks.values()) and all(exact.values()) else 'FAIL','sourceContractChecks':checks,'r5cFullRecordCategoryMatches':exact,'canonicalCategoryDigests':{k:inv.digest(normalized(x)) for k,x in v.items()},'functionCount':len(v['functions']),'tableCount':6,'comparison':'Full records including signatures, owner, security definer, search_path, bodies, ACL, policies; unordered catalog arrays sorted for comparison only'})
 save('agent-empty-state',{'status':'PASS' if all(x==0 for x in v['agentRows'].values()) else 'UNEXPECTED AGENT DATA','rows':v['agentRows'],'agentAdmissionTest':'NOT EXECUTED BY DESIGN'})
 save('rls-acl',{'status':'PASS' if all(checks.values()) and all(exact.values()) else 'FAIL','sourceChecks':checks,'fullFunctionsPoliciesViewRlsMatchR5C':{k:exact[k] for k in ('functions','policies','view','rls')},'safeViewSecurityBarrier':True,'writeRpcCalls':0})
 assert all(checks.values()) and all(exact.values()),'CATALOG_OR_AGENT_DATA_DRIFT'
 budget();assert stat.S_ISREG(CANDIDATE.lstat().st_mode) and not CANDIDATE.is_symlink() and inv.sha(CANDIDATE)==SHA,'ARTIFACT_DRIFT'
 hashes={};mismatch=[]
 with tarfile.open(CANDIDATE,'r:gz') as tar:
  for member in tar.getmembers():
   name=member.name.removeprefix('./');path=Path(name)
   assert not path.is_absolute() and '..' not in path.parts and path.parts[0] in ('.next','public','package.json','next.config.ts'),'ARCHIVE_MEMBER_INVALID'
   assert member.isfile() or member.isdir(),'ARCHIVE_NONREGULAR_MEMBER'
   if not member.isfile():continue
   digest=hashlib.sha256(tar.extractfile(member).read()).hexdigest();hashes[name]=digest
   live=LIVE/name
   if not live.is_file() or live.is_symlink() or inv.sha(live)!=digest:mismatch.append(name)
 assert not mismatch,'LIVE_ARTIFACT_DRIFT'
 assert len(hashes)==1394 and (LIVE/'.next/BUILD_ID').read_text().strip()==BUILD,'BUILD_DRIFT'
 required=json.loads((LIVE/'.next/required-server-files.json').read_text())['files']
 assert len(required)==19 and all((LIVE/p).is_file() for p in required),'REQUIRED_FILES_MISSING'
 version=json.loads((LIVE/'node_modules/next/package.json').read_text())['version'];assert version=='16.2.10','NEXT_VERSION_DRIFT'
 extras=sorted(str(p.relative_to(LIVE)) for top in ('.next','public') for p in (LIVE/top).rglob('*') if p.is_file() and str(p.relative_to(LIVE)) not in hashes)
 save('artifact-verification',{'status':'MATCH','candidatePath':str(CANDIDATE),'candidateSha256':SHA,'size':CANDIDATE.stat().st_size,'regularNotSymlink':True,'archiveReadable':True,'buildId':BUILD,'nextVersion':version,'liveSource':str(LIVE),'approvedFileCount':len(hashes),'allApprovedFilesMatch':True,'fileMappingSha256':inv.digest(hashes),'additionalLiveFiles':extras,'requiredServerFiles':len(required),'requiredServerFilesPresent':True})
 routes=json.loads((LIVE/'.next/server/app-paths-manifest.json').read_text())
 wanted=['/[space]/dashboard/admin/apps/[appSlug]/textbooks/page','/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/page','/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page']
 routechecks={p:p in routes and (LIVE/'.next/server'/routes[p]).is_file() for p in wanted}
 assert all(routechecks.values()),'COMPILED_ROUTE_MISSING'
 results=[]
 for method,path in [('GET','/'),('GET','/login'),('GET','/platform/dashboard'),('GET','/platform/apps/korean/courses'),('GET','/platform/dashboard/admin'),('GET','/platform/dashboard/admin/apps/korean/textbooks'),('GET','/platform/dashboard/admin/apps/korean/teaching-scripts'),('HEAD','/images/hangul/pronunciation-side-profile.png'),('HEAD','/pwa/icon-192.png')]:
  budget();c=http.client.HTTPConnection('127.0.0.1',3000,timeout=15)
  c.request(method,path,headers={'User-Agent':'UPLY-R5D-readonly-acceptance'})
  response=c.getresponse();loc=response.getheader('Location');body=response.read(2*1024*1024)
  results.append({'method':method,'path':path,'status':response.status,'redirectCategory':'NONE' if not loc else 'LOGIN' if 'login' in loc else 'OTHER','streamedRedirectObserved':b'NEXT_REDIRECT' in body,'authenticated':False});c.close()
 health=all(x['status'] in (200,301,302,303,307,308) for x in results)
 save('http-health',{'status':'PASS' if health else 'PARTIAL','requests':results,'compiledRoutes':routechecks,'limitation':'Basic unauthenticated response only; HTTP 200 or streamed login redirect is not authenticated business verification','cookiesSent':False,'responseBodiesSaved':False})
 assert health,'HTTP_HEALTH_NOT_PASS'
 save('authoring-foundation',{'technicalFoundation':'PASS','compiledRoutes':routechecks,'schemaAndSkeletonRpcAcl':'PASS','approvedCandidateRunning':True,'authenticatedUi':'AUTH SESSION REQUIRED','authenticatedUiGate':'PARTIAL','noAuthorizedOwnedSessionSupplied':True,'interactiveActions':0,'skeletonRpcCalls':0})
 # End-state repeat, never repair or restart on drift.
 final=ledger(plan);assert final==initial,'LEDGER_CHANGED_DURING_OBSERVATION'
 ending,_=operations();assertops(ending)
 rows=jsonquery("BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; SELECT json_build_object("+','.join("'"+n+"',(select count(*) from public."+n+")" for n in v['agentRows'])+");ROLLBACK;")
 assert rows==v['agentRows'],'AGENT_ROWS_CHANGED'
 save('provider-boundary',{'liveProviderRequestsInTask':0,'agentRunsInTask':0,'agentAdmissionTest':'NOT EXECUTED BY DESIGN','policy':'DEFERRED / NOT APPROVED','policyDocumentModified':False,'evidenceBoundary':'Task call paths and OFF/EMPTY config; not provider-account-wide traffic audit'})
 safety={k:0 for k in ('productionDbWrites','productionMigrations','productionDeploy','pm2Mutations','runtimeWrites','launcherWrites','tailscaleMutations','agentRuns','providerRequests','contentWrites','authWrites','reconcilerCalls','persistentCancelCalls','newBackups','restores')}
 safety.update(status='PASS',feature='OFF',allowlists='EMPTY',agentRows=rows,otherAppsUnchanged=True,r5cHistoryPreserved=True,r5cFreshBackupRetained=Path('/home/yangzhen/backups/uply/20260916T030822Z/database.dump').is_file(),backupRule='No new recovery point required for read-only acceptance closure.',evidenceBoundary='Fixed read-only SQL, no business RPC, GET/HEAD only; task-scope counters, not global concurrent activity claim')
 assert safety['r5cFreshBackupRetained'];save('production-safety',safety)
 budget();end=now();window={**WINDOW,'r5dEndUtc':end.isoformat(),'r5dEndAsiaSeoul':end.astimezone(dt.timezone(dt.timedelta(hours=9))).isoformat(),'durationSeconds':time.monotonic()-WINDOW['startMonotonic'],'maximumObservationMinutes':30,'budgetExceeded':False,'productionMaintenanceAuthorization':False};save('observation-window',window)
 seal_receipt()
 print(json.dumps({'status':'PASS','ledger':457,'build':BUILD,'productionMutations':0}))

def seal_receipt():
 budget()
 window=json.loads((EV/'observation-window.json').read_text())
 assert window.get('budgetExceeded') is False and json.loads((EV/'production-safety.json').read_text())['status']=='PASS'
 # User-authorized private acceptance record, never a production execution grant.
 private=Path('/home/yangzhen/operations/uply/teaching-agent/acceptance')
 for parent in list(private.parents)[::-1]+[private]:
  if parent.exists():assert stat.S_ISDIR(parent.lstat().st_mode) and not parent.is_symlink(),'PRIVATE_PATH_UNSAFE'
  else:parent.mkdir(mode=0o700)
 stamp=dt.datetime.fromisoformat(WINDOW['r5dStartUtc']).strftime('%Y%m%dT%H%M%SZ')
 directory=private/('r5d-'+stamp);directory.mkdir(mode=0o700)
 receipt={'scope':'READ-ONLY ACCEPTANCE ONLY','status':'PASS','currentFoundationTechnicalStatus':'READY FOR CONTENT PREPARATION','r5cHistoricalStatus':'CONDITIONAL — WINDOW EXPIRED / EXECUTION INCOMPLETE','window':window,'productionMutationCount':0,'evidenceSha256':{p.name:inv.sha(p) for p in EV.glob('*.json')},'stage1g':'NOT READY / NOT AUTHORIZED'}
 destination=directory/'acceptance.json'
 fd=os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n');f.flush();os.fsync(f.fileno())
 fd=os.open(directory,os.O_DIRECTORY);os.fsync(fd);os.close(fd)
 save('private-receipt',{'path':str(destination),'sha256':inv.sha(destination),'fileMode':oct(destination.stat().st_mode&0o777),'directoryMode':oct(directory.stat().st_mode&0o777),'status':'SEALED','scope':'Acceptance evidence only, not production authorization'})
if __name__=='__main__':
 try:
  assert sys.argv[1:] in ([],['--seal-only'])
  if sys.argv[1:]:seal_receipt()
  else:main()
 except Exception as error:
  # Never echo raw SQL, command stderr, credentials or business rows.
  reason=str(error) if isinstance(error,AssertionError) else type(error).__name__
  save('acceptance-failure',{'status':'STOPPED','reason':reason,'observedAt':now().isoformat(),'productionMutations':0})
  print(json.dumps({'status':'STOPPED','reason':reason}));sys.exit(1)
