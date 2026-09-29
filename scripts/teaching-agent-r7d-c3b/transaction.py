"""Single outer transaction, byte-pinned body and honest source ledger, no retries."""
import base64
import re
import time
from receipts import Failure, sha, Journal
from plan_contract import authorize
from checks import observe, run_checks, fingerprint, scope_delta


def top_level_guard(body):
    """Small lexer for reviewed bytes only; never accepts arbitrary migrations."""
    s = body.decode('utf8'); i = 0; out = []
    while i < len(s):
        if s.startswith('--',i):
            j=s.find('\n',i); i=len(s) if j<0 else j+1; out.append(' '); continue
        if s.startswith('/*',i):
            depth=1; i+=2
            while depth and i<len(s):
                if s.startswith('/*',i): depth+=1;i+=2
                elif s.startswith('*/',i): depth-=1;i+=2
                else:i+=1
            if depth: raise Failure('PRECHECK_FAILED','UNTERMINATED_COMMENT')
            out.append(' ');continue
        if s[i] in "'\"":
            quote=s[i]; escape=(i>0 and s[i-1] in 'eE' and quote=="'"); i+=1
            while i<len(s):
                if escape and s[i]=='\\': i+=2;continue
                if s[i]==quote:
                    if i+1<len(s) and s[i+1]==quote:i+=2;continue
                    i+=1;break
                i+=1
            else:raise Failure('PRECHECK_FAILED','UNTERMINATED_QUOTE')
            out.append(' LITERAL ');continue
        if s[i]=='$':
            m=re.match(r'\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$',s[i:])
            if m:
                tag=m.group(); j=s.find(tag,i+len(tag))
                if j<0:raise Failure('PRECHECK_FAILED','UNTERMINATED_DOLLAR')
                i=j+len(tag);out.append(' LITERAL ');continue
        if s[i]=='\\':raise Failure('PRECHECK_FAILED','PSQL_META_FORBIDDEN')
        out.append(s[i]);i+=1
    text=''.join(out).upper()
    if re.search(r'\b(CONCURRENTLY|VACUUM|CALL|COPY)\b|\bALTER\s+SYSTEM\b|\b(CREATE|DROP)\s+(DATABASE|TABLESPACE|EXTENSION)\b',text):
        raise Failure('PRECHECK_FAILED','UNSAFE_STATEMENT')
    for stmt in text.split(';'):
        if re.match(r'\s*(BEGIN|COMMIT|ROLLBACK|END|START|SAVEPOINT|RELEASE|PREPARE)\b',stmt):
            raise Failure('PRECHECK_FAILED','OUTER_TRANSACTION_CONTROL')


def reviewed_body(raw, spec):
    if len(raw)!=spec['rawBytes'] or sha(raw)!=spec['rawSha256']:
        raise Failure('PRECHECK_FAILED','MIGRATION_RAW_HASH')
    start,end=spec['bodyStartByteInclusive'],spec['bodyEndByteExclusive']
    if not (0<start<end<len(raw)) or not raw[:start].rstrip().upper().endswith(b'BEGIN;') or raw[end:].strip().upper()!=b'COMMIT;':
        raise Failure('PRECHECK_FAILED','ENVELOPE')
    body=raw[start:end]
    if sha(body)!=spec['bodySha256']:raise Failure('PRECHECK_FAILED','BODY_HASH')
    top_level_guard(body)
    return body


def _literal_bytes(raw):
    # Base64 contains no SQL quotes, backslashes or terminators. Source is never interpolated as SQL.
    return "convert_from(decode('"+base64.b64encode(raw).decode()+"','base64'),'UTF8')"


def _ledger_insert(plan,raw):
    m=plan.data['migration']
    return ('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('+
            _literal_bytes(m['version'].encode())+','+_literal_bytes(m['name'].encode())+',ARRAY['+_literal_bytes(raw)+']);')


class Engine:
    def __init__(self,plan,transport,auth,receipt_root):
        plan.ensure_ready()
        if plan.fixture != transport.fixture or transport.identity != auth['targetIdentity']:
            raise Failure('TARGET_IDENTITY_MISMATCH')
        self.plan,self.transport,self.auth,self.receipt_root=plan,transport,auth,receipt_root

    def preflight(self):
        mode=self.auth.get('scope')
        if mode not in ('SINGLE_MIGRATION_APPLY','READ_ONLY_PREFLIGHT'):raise Failure('APPROVAL_MISSING')
        authorize(self.plan,self.auth,mode)
        self.plan.source();self.plan.inventory()
        with self.transport._session(True) as s:
            before=observe(s);run_checks(self.plan,before,self.auth,'preflightChecks');s._rollback()
        return {'observedAt':time.time(),'state':before}

    def verify(self,before):
        raw,_=self.plan.source()
        with self.transport._session(True) as s:
            now=observe(s)
            scope_delta(self.plan,before,now,raw)
            run_checks(self.plan,now,self.auth,'postconditionChecks',before,raw)
            s._rollback()
        return now

    def reconcile(self,before):
        """Independent readonly classification, never rewrites or retries an attempt."""
        raw,_=self.plan.source()
        with self.transport._session(True) as s:
            now=observe(s);s._rollback()
        if now==before:
            return {'state':'NOT_COMMITTED_VERIFIED','ledgerCount':len(now['ledger'])}
        try:
            scope_delta(self.plan,before,now,raw)
            run_checks(self.plan,now,self.auth,'postconditionChecks',before,raw)
        except Failure:
            return {'state':'FORWARD_FIX_REQUIRED','ledgerCount':len(now['ledger'])}
        return {'state':'COMMITTED_VERIFIED','ledgerCount':len(now['ledger'])}

    def apply(self):
        from backup_adapter import validate_backup
        authorize(self.plan,self.auth,'SINGLE_MIGRATION_APPLY')
        raw,body=self.plan.source()
        fresh=self.preflight()
        validate_backup(self.plan,self.auth,self.transport)
        try:
            journal=Journal(self.receipt_root,self.plan,self.auth['nonce'])
            journal.record('PREFLIGHT',ledgerBefore=len(fresh['state']['ledger']),catalogSha256=fingerprint(fresh['state']))
        except FileExistsError:raise Failure('APPROVAL_MISSING','ATTEMPT_ALREADY_CONSUMED') from None
        except OSError:raise Failure('PRECHECK_FAILED','JOURNAL_NOT_DURABLE') from None
        phase='PRECHECK';committed=False;commit_sent=False;before=None;rollback_ack=False
        try:
            with self.transport._session(False) as s:
                try:
                    got=s._json('select to_jsonb(pg_try_advisory_xact_lock(4171,100));')
                    if got is not True:raise Failure('CONCURRENT_RUN_REJECTED')
                    s._exchange('LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;')
                    self.transport._check(s)
                    before=observe(s)
                    run_checks(self.plan,before,self.auth,'preflightChecks')
                    if time.time()-fresh['observedAt']>60:raise Failure('PRECHECK_FAILED','STALE_PREFLIGHT')
                    validate_backup(self.plan,self.auth,self.transport)
                    authorize(self.plan,self.auth,'SINGLE_MIGRATION_APPLY')
                    journal.record('DISPATCH',ledgerBefore=len(before['ledger']))
                    phase='MIGRATION';s._exchange(body.decode())
                    phase='LEDGER';s._exchange(_ledger_insert(self.plan,raw))
                    phase='POSTCHECK';after=observe(s)
                    scope_delta(self.plan,before,after,raw)
                    run_checks(self.plan,after,self.auth,'postconditionChecks',before,raw)
                    authorize(self.plan,self.auth,'SINGLE_MIGRATION_APPLY')
                    journal.record('PRECOMMIT',ledgerAfter=len(after['ledger']),catalogSha256=fingerprint(after))
                    phase='COMMIT';commit_sent=True
                    s._exchange('COMMIT;')
                    ack=s._json("select jsonb_build_object('commitAck','"+journal.attempt+"');")
                    if ack!={'commitAck':journal.attempt}:raise Failure('UNKNOWN_COMMIT','COMMIT_ACK_MISSING')
                    committed=True
                except Exception:
                    if not commit_sent:
                        try:s._rollback();rollback_ack=True
                        except Exception:pass
                    raise
            journal.record('COMMITTED',ledgerAfter=len(after['ledger']))
            verified=self.verify(before)
            journal.record('SUCCESS',ledgerAfter=len(verified['ledger']),state='SUCCESS')
            return 'SUCCESS'
        except Exception as error:
            if commit_sent and not committed:
                state='UNKNOWN_COMMIT'
            elif committed:
                state='POSTCHECK_FAILED_COMMITTED_FORWARD_FIX_REQUIRED'
            elif rollback_ack:
                try:
                    with self.transport._session(True) as check:
                        unchanged=observe(check)==(before or fresh['state']);check._rollback()
                except Exception:unchanged=False
                if not unchanged:state='UNKNOWN_COMMIT'
                elif isinstance(error,Failure) and error.state=='CONCURRENT_RUN_REJECTED':state=error.state
                else:state={'MIGRATION':'MIGRATION_FAILED_ROLLED_BACK','LEDGER':'LEDGER_FAILED_ROLLED_BACK',
                            'POSTCHECK':'POSTCHECK_FAILED_ROLLED_BACK'}.get(phase,'PRECHECK_FAILED')
            else:state='UNKNOWN_COMMIT'
            try:journal.record('RESULT',state=state,transactionPhase=phase,rollbackAcknowledged=rollback_ack,
                               code=error.code if isinstance(error,Failure) else 'LOCAL_IO_OR_PROTOCOL_FAILURE')
            except Exception:pass  # Durable attempt already exists; never retry after receipt failure.
            raise Failure(state) from None
