"""Fixed 000-007 foundation runner. No directory-driven execution, skip or retry.

The reusable transaction engine accepts guarded transports. Production transport
requires a separate explicit signed window/locks/fresh-backup authorization file;
it is never selected by rehearsal. Production execution is not authorized in R5B.
Receipts never contain SQL, credentials, database rows or raw stderr.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = Path(__file__).with_name('locked-package.json')
VERSIONS = tuple('20260914000'+str(i) for i in range(8))
BASE_SHA = 'd864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981'
IMAGE_ID = 'sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f'
MARKER = 'UPLY_R5B_ISOLATED_FOUNDATION'
PG = '/usr/lib/postgresql/bin/'

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def sha(value):return hashlib.sha256(value).hexdigest()
def quote(value):return "'"+str(value).replace("'","''")+"'"

class Rejected(RuntimeError):pass
class Halt(RuntimeError):
    def __init__(self,receipt):
        self.receipt=receipt
        super().__init__(receipt['reason'])


def transaction_body(sql):
    """Lex outer statements, preserving exact body text; ignore quoted PL/pgSQL."""
    i=start=0; visible=''; parts=[]
    while i<len(sql):
        rest=sql[i:]; c=sql[i]
        if rest.startswith('--'):
            end=sql.find('\n',i);i=len(sql) if end<0 else end;continue
        if rest.startswith('/*'):
            depth=1;i+=2
            while i<len(sql) and depth:
                if sql[i:i+2]=='/*':depth+=1;i+=2
                elif sql[i:i+2]=='*/':depth-=1;i+=2
                else:i+=1
            if depth:raise Rejected('SQL_COMMENT')
            continue
        dollar=re.match(r'\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$',rest)
        if dollar:
            tag=dollar[0];end=sql.find(tag,i+len(tag))
            if end<0:raise Rejected('SQL_DOLLAR')
            visible+=' BODY ';i=end+len(tag);continue
        if c in "'\"":
            end_quote=c;i+=1;closed=False
            while i<len(sql):
                if sql[i]==end_quote:
                    if i+1<len(sql) and sql[i+1]==end_quote:i+=2;continue
                    i+=1;closed=True;break
                # Only E strings support backslash escapes with standard strings ON.
                if sql[i]=='\\' and re.search(r'\b[eE]$',visible):i+=1
                i+=1
            if not closed:raise Rejected('SQL_STRING')
            visible+=' VALUE ';continue
        if c=='\\':raise Rejected('PSQL_METACOMMAND_FORBIDDEN')
        if c==';':parts.append((sql[start:i+1],visible.strip().lower()));start=i+1;visible=''
        else:visible+=c
        i+=1
    if visible.strip():raise Rejected('SQL_TRAILING_STATEMENT')
    if not parts or parts[0][1]!='begin' or parts[-1][1]!='commit':raise Rejected('SQL_TRANSACTION_WRAPPER')
    if any(re.match(r'^(begin|commit|rollback|start\s+transaction|end|prepare\s+transaction|vacuum)\b',p[1]) for p in parts[1:-1]):raise Rejected('SQL_NESTED_TRANSACTION')
    return '\n'.join(p[0] for p in parts[1:-1])


def validate_entries(entries,locked):
    if len(entries)!=8:raise Rejected('EXACT_EIGHT_REQUIRED')
    if tuple(e.get('version') for e in entries)!=VERSIONS:raise Rejected('EXACT_ORDER_REQUIRED')
    if entries!=locked:raise Rejected('LOCKED_PACKAGE_DRIFT')


def load_package(directory=None,entries=None):
    locked=json.loads(PACKAGE.read_text())['migrations']
    # Compare against immutable previous-stage evidence; modifying both is not a supported CLI input.
    prior=json.loads((ROOT/'docs/evidence/teaching-agent-stage-1f-r5a/migration-package.json').read_text())['migrations']
    expected=[{k:m[k] for k in ('version','name','filename','sha256')} for m in prior]
    validate_entries(locked,expected)
    entries=locked if entries is None else entries
    validate_entries(entries,locked)
    directory=Path(directory) if directory else ROOT/'supabase/migrations'
    # Discovery is rejection-only. Execution always consumes eight explicit filenames.
    discovered=sorted(p.name for p in directory.iterdir() if p.name.endswith('.sql') and p.name[:12]>'202609130003')
    if discovered!=[m['filename'] for m in locked]:raise Rejected('MISSING_OR_EXTRA_MIGRATION')
    plan=[]
    for m in entries:
        path=directory/m['filename']
        if path.is_symlink() or not path.is_file():raise Rejected('MIGRATION_NOT_REGULAR')
        raw=path.read_bytes()
        if sha(raw)!=m['sha256']:raise Rejected('MIGRATION_HASH_DRIFT')
        text=raw.decode('utf-8');plan.append({**m,'sql':text,'body':transaction_body(text)})
    return plan


# Full original rows, including statements, remain invariant during the eight steps.
PREFIX_EXPR="encode(sha256(convert_to(coalesce((select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version)::text from supabase_migrations.schema_migrations where version<='202609130003'),'[]'),'UTF8')),'hex')"
SNAPSHOT_SQL=f"""BEGIN READ ONLY; SET LOCAL statement_timeout='15s';
SELECT json_build_object('ledger',(select json_agg(json_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations),
'baseFullDigest',{PREFIX_EXPR},'newRows',(select coalesce(json_agg(json_build_object('version',version,'name',name,'statements',statements) order by version),'[]') from supabase_migrations.schema_migrations where version>'202609130003'));
ROLLBACK;"""


def parse_snapshot(output):
    for line in output.splitlines():
        if line.startswith('{'):
            try:
                value=json.loads(line)
                if 'ledger' in value:return value
            except ValueError:pass
    raise Rejected('READ_ONLY_SNAPSHOT_INVALID')


def verify_snapshot(snapshot,plan,count,base_full=None):
    ledger=snapshot['ledger'];old=ledger[:449]
    if len(ledger)!=449+count or digest(old)!=BASE_SHA or old[-1]['version']!='202609130003':raise Rejected('WRONG_LEDGER_PREFIX')
    if ledger[449:]!=[{k:m[k] for k in ('version','name')} for m in plan[:count]]:raise Rejected('WRONG_NEW_LEDGER')
    if snapshot['newRows']!=[{'version':m['version'],'name':m['name'],'statements':[m['sql']]} for m in plan[:count]]:raise Rejected('WRONG_LEDGER_SOURCE')
    if base_full is not None and snapshot['baseFullDigest']!=base_full:raise Rejected('BASE_SQL_PREFIX_CHANGED')


def transaction(plan,index,base_full,nonce):
    m=plan[index];prefix_checks='\n'.join(f"if not exists(select 1 from supabase_migrations.schema_migrations where version={quote(p['version'])} and name={quote(p['name'])} and statements=ARRAY[{quote(p['sql'])}]::text[]) then raise exception 'PREFIX_SOURCE_CHANGED';end if;" for p in plan[:index])
    return f"""BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s'; SET LOCAL standard_conforming_strings=on;
SELECT pg_advisory_xact_lock(4171,100);
LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
DO $r5b_guard$ BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'PG17_REQUIRED'; END IF;
 IF (select count(*) from supabase_migrations.schema_migrations)<>{449+index} OR {PREFIX_EXPR}<>{quote(base_full)} THEN RAISE EXCEPTION 'WRONG_LEDGER_PREFIX'; END IF;
 IF exists(select 1 from supabase_migrations.schema_migrations where version={quote(m['version'])}) THEN RAISE EXCEPTION 'ALREADY_APPLIED'; END IF;
 {prefix_checks}
END $r5b_guard$;
{m['body']}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ({quote(m['version'])},{quote(m['name'])},ARRAY[{quote(m['sql'])}]::text[]);
COMMIT;
SELECT json_build_object('r5bCommitAck',{quote(nonce)},'version',{quote(m['version'])});
"""


def classify(result,nonce,version):
    if not result['dispatched']:return 'NOT_COMMITTED'
    if result['code']!=0:return 'UNKNOWN'
    acknowledgements=[]
    for line in result['stdout'].splitlines():
        if line.startswith('{'):
            try:
                value=json.loads(line)
                if 'r5bCommitAck' in value:acknowledgements.append(value)
            except ValueError:pass
    if 'COMMIT' not in result['stdout'].splitlines() or acknowledgements!=[{'r5bCommitAck':nonce,'version':version}]:return 'UNKNOWN'
    return 'CONFIRMED'


def run_all(transport,plan,save_receipt=lambda r:None):
    if plan!=load_package():raise Rejected('EXACT_LOCKED_PLAN_REQUIRED')
    # Starting at 450..457 is always rejected: no skip/resume/force.
    initial=transport.snapshot();verify_snapshot(initial,plan,0);base=initial['baseFullDigest'];receipts=[]
    for i,m in enumerate(plan):
        verify_snapshot(transport.snapshot(),plan,i,base)
        nonce=secrets.token_hex(24)
        result=transport.execute(transaction(plan,i,base,nonce))
        commit=classify(result,nonce,m['version'])
        receipt={'version':m['version'],'sourceSha256':m['sha256'],'commitState':commit,'postVerification':'NOT RUN','nextMigrationAllowed':False,'reason':'COMMIT_ACK_UNCONFIRMED' if commit!='CONFIRMED' else 'POST_VERIFY_REQUIRED'}
        if commit!='CONFIRMED':
            save_receipt(receipt);raise Halt(receipt)
        try:verify_snapshot(transport.snapshot(),plan,i+1,base)
        except Exception:
            receipt.update(postVerification='FAIL',reason='POST_VERIFY_FAILED');save_receipt(receipt);raise Halt(receipt) from None
        receipt.update(postVerification='PASS',nextMigrationAllowed=i<7,reason='VERIFIED_COMMIT');receipts.append(receipt);save_receipt(receipt)
    return {'status':'PASS','startLedger':449,'finalLedger':457,'latest':VERSIONS[-1],'baseFullDigest':base,'old449Unchanged':True,'steps':receipts}


class IsolatedPsql:
    """No host/URI/password args. Owned container ID, network, mount and DB marker enforced."""
    def __init__(self,state):self.state=state
    def guard(self,marker=True):
        s=self.state
        if not re.fullmatch(r'uply-r5b-[a-f0-9]{12}',s['container']):raise Rejected('LOCAL_CONTAINER_REQUIRED')
        o=json.loads(subprocess.check_output(['docker','inspect',s['container']]))[0]
        if o['Id']!=s['containerId'] or o['Image']!=IMAGE_ID:raise Rejected('CONTAINER_IDENTITY_CHANGED')
        if o['Config']['Labels'].get('stage')!='stage1f-r5b' or o['Config']['Labels'].get('purpose')!='isolated-foundation':raise Rejected('OWNER_LABEL_MISMATCH')
        if o['HostConfig']['NetworkMode']!='none' or o['HostConfig']['PortBindings']:raise Rejected('DB_NETWORK_NOT_ISOLATED')
        if len(o['Mounts'])!=1 or o['Mounts'][0]['Type']!='volume' or o['Mounts'][0]['Name']!=s['volume'] or o['Mounts'][0]['Destination']!='/recovery':raise Rejected('UNSAFE_MOUNT')
        if any(re.search('SUPABASE|PGPASSWORD|PGSERVICE|DEEPSEEK|OPENAI',v.split('=',1)[0]) for v in o['Config']['Env']):raise Rejected('UNEXPECTED_SECRET_ENV')
        if marker:
            args=self.args('supabase_admin')+['-c',"SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()"]
            if subprocess.check_output(args).decode().strip()!=MARKER:raise Rejected('DB_MARKER_MISMATCH')
    def args(self,role='postgres'):
        s=self.state
        if s['database']!='uply_r5b_foundation':raise Rejected('ISOLATED_DATABASE_REQUIRED')
        return ['docker','exec','-i',s['container'],PG+'psql','-h','/recovery','-p','55483','-U',role,'-d',s['database'],'-X','-At','-v','ON_ERROR_STOP=1']
    def execute(self,sql,timeout=150):
        self.guard()
        try:p=subprocess.Popen(self.args(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        except OSError:return {'code':None,'stdout':'','dispatched':False}
        try:
            out,err=p.communicate(sql.encode(),timeout=timeout)
            return {'code':p.returncode,'stdout':out.decode(),'dispatched':True}
        except subprocess.TimeoutExpired:
            p.kill();p.communicate()
            # Killing client is not proof of database rollback.
            return {'code':None,'stdout':'','dispatched':True}
    def snapshot(self):
        result=self.execute(SNAPSHOT_SQL)
        if result['code']!=0:raise Rejected('READ_ONLY_VERIFY_FAILED')
        return parse_snapshot(result['stdout'])


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('mode',choices=['plan','rehearse','apply-authorized']);parser.add_argument('--state',type=Path);parser.add_argument('--receipts',type=Path);parser.add_argument('--connection',type=Path);parser.add_argument('--authorization',type=Path);args=parser.parse_args()
    plan=load_package()
    if args.mode=='plan':print(json.dumps({'count':8,'migrations':[{k:m[k] for k in ('version','filename','sha256')} for m in plan],'productionExecution':'NOT AUTHORIZED'}));return
    if not args.receipts:raise Rejected('EXPLICIT_PRIVATE_RECEIPTS_REQUIRED')
    if args.mode=='rehearse':
        if not args.state or args.connection or args.authorization:raise Rejected('EXPLICIT_ISOLATED_STATE_REQUIRED')
        state=json.loads(args.state.read_text());transport=IsolatedPsql(state)
    else:
        if not args.connection or not args.authorization or args.state:raise Rejected('EXPLICIT_PRODUCTION_AUTHORIZATION_REQUIRED')
        from maintenance_transport import MaintenancePsql
        transport=MaintenancePsql(args.connection,args.authorization)
    args.receipts.mkdir(mode=0o700)
    def receipt(value):
        path=args.receipts/(value['version']+'.json')
        with path.open('x') as f:
            os.fchmod(f.fileno(),0o600);json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
        directory=os.open(args.receipts,os.O_RDONLY|os.O_DIRECTORY)
        try:os.fsync(directory)
        finally:os.close(directory)
    try:print(json.dumps(run_all(transport,plan,receipt)))
    except Halt as error:print(json.dumps({'status':'STOP','receipt':error.receipt}));raise SystemExit(2)
if __name__=='__main__':
    try:main()
    except Rejected as error:print(json.dumps({'status':'STOP','reason':str(error),'action':'NO RETRY; review per-step receipts; no next migration'}));raise SystemExit(2)
