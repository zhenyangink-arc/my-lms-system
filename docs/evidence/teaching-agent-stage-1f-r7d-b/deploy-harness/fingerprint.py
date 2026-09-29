from pathlib import Path
import json,sys,hashlib,datetime,os
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7d-b';phase=sys.argv[1];assert phase in ['preflight','before','after']
ns={};exec((R/'docs/evidence/teaching-agent-stage-1f-r7c-b/b3a-build-harness/b3a-readonly.py').read_text().split('snapshot=query')[0],ns);q=ns['wrapped']
# Only catalog-selected tables; all SQL transactions are explicitly READ ONLY.
tables=q("SELECT json_build_object('tables',(SELECT json_agg(schemaname||'.'||tablename ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname='auth' OR (schemaname='public' AND tablename ~ '(agent|provider|publish|pin|textbook|teaching|profile|tenant|membership|objective|permission|account_management)'))) ")['tables']
assert all(__import__('re').fullmatch(r'(auth|public)\.[a-z_0-9]+',t) for t in tables)
parts=[]
for t in tables:parts.append("SELECT '"+t+"' AS name,count(*) AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text||t.xmin::text),'' ORDER BY md5(to_jsonb(t)::text||t.xmin::text)),'')) AS digest FROM "+t+" t")
f=q("SELECT json_build_object('tables',(SELECT json_object_agg(name,json_build_object('count',count,'digest',digest)) FROM ("+' UNION ALL '.join(parts)+") x))")
f['at']=datetime.datetime.now(datetime.timezone.utc).isoformat();os.umask(0o077);Path('/tmp/r7d-db-'+phase+'.json').write_text(json.dumps(f))
(E/('db-fingerprint-'+phase+'-inventory.json')).write_text(json.dumps({'at':f['at'],'transaction':'NEW READ ONLY','tableCount':len(tables),'tables':tables,'privateDigests':'held in /tmp only, not exposed','toolInvokedByThisHarness':False},indent=2)+'\n')
print('READ_ONLY_FINGERPRINT',phase,len(tables))
