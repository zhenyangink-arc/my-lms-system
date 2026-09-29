"""D19 companion: one authorized source-only PRE / roles / POST acquisition.

This module does not extend the sealed recovery package or authorize production.
The public CLI accepts only fixed-slot tagged DIRECT or SESSION approvals. Owned test contexts are private,
explicitly marked, and cannot produce admissible production artifacts.
"""
import argparse
import base64
import configparser
import copy
from dataclasses import dataclass
import datetime
import fcntl
import json
import math
import os
from pathlib import Path
import re
import select
import selectors
import stat
import subprocess
import sys
import time
import uuid

import backup_adapter as ba
import checks
import capture_authorization as ca
import plan_contract as pc
from maintenance_transport import _conninfo, validate_identity
from receipts import Failure, canonical, sha, strict_json, safe_file

ROOT = pc.ROOT
OPS = Path(__file__).resolve().parent
DESIGN_PATH = ROOT / 'docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-attempt2-e3-recovery-d19-source-only-bootstrap-provenance-acquisition-contract-design-review.json'
DESIGN_SHA = 'a205da202b3361969c47e247d1f169eda409f89537cc1193a7c978b6889bc706'
ADMISSION_DESIGN_PATH = ROOT / 'docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-attempt2-e3-recovery-d21-r1-f2-r1-bounded-forward-reference-design-review.json'
ADMISSION_DESIGN_SHA = 'faf65e0d5e5893cecbee8262dde987ece802bc03101c66ac1dadd5daae687c6d'
PACKAGE_DIGEST = '1f80cfc251818c882b1cd37f58157f03ee985ba89ee422c40447a90c35fc333f'
SCOPE = 'SOURCE_BOOTSTRAP_PROVENANCE_READ_EXPORT'
TEST_SCOPE = 'OWNED_TEST_SOURCE_BOOTSTRAP_PROVENANCE_READ_EXPORT'
STATUS = 'IMPLEMENTED_NOT_FRESH_VALIDATED'
FORWARD_DESIGN_PATH = ROOT / 'docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-d26-direct-source-acquisition-design.json'
FORWARD_DESIGN_SHA = 'd83a4acaa12b85c3a4fdab193993762774053fe95b0d576946afa313ed085334'
IMAGE = 'sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f'
HEX32 = re.compile(r'[a-f0-9]{32}\Z')
HEX64 = re.compile(r'[a-f0-9]{64}\Z')
SAFE_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LC_ALL': 'C'}
PAYLOADS = ('pre.json', 'post.json', 'roles.sql', 'transport-proofs.json', 'profile-review.json')
SUCCESS = 'SUCCESS_ACQUIRED_PROFILE_SUPPORTED'
FAILED = 'FAILED_CONSUMED'
REJECTED = 'PROFILE_REJECTED_CONSUMED'


def require(ok, code='ACQUISITION_AUTH_INVALID'):
    if not ok:
        raise Failure('ACQUISITION_FAILED', code)


def _load_design():
    raw = safe_file(DESIGN_PATH)
    require(sha(raw) == DESIGN_SHA, 'ACQUISITION_SOURCE_DRIFT')
    return strict_json(raw)


def _load_admission_design():
    raw = safe_file(ADMISSION_DESIGN_PATH)
    require(sha(raw) == ADMISSION_DESIGN_SHA, 'ACQUISITION_SOURCE_DRIFT')
    return strict_json(raw)


def _load_forward_design():
    raw = safe_file(FORWARD_DESIGN_PATH)
    require(sha(raw) == FORWARD_DESIGN_SHA, 'ACQUISITION_SOURCE_DRIFT')
    return strict_json(raw)


FORWARD_DESIGN = _load_forward_design()
DIRECT_SCHEMAS = FORWARD_DESIGN['CONTRACT DEFINITIONS']
FORWARD_SLOTS = FORWARD_DESIGN['fixedFutureEvidencePaths']
DIRECT_PROFILE_ID = 'uply-source-provenance-direct/1'
DIRECT_PROJECT_SHA = 'cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673'
DIRECT_TRANSPORT = {
    'contract': 'source-provenance-direct-transport/1', 'schemaVersion': 1,
    'connectionKind': 'DIRECT_POSTGRES', 'port': 5432, 'database': 'postgres', 'user': 'postgres',
    'sslmode': 'verify-full', 'gssencmode': 'disable', 'caPolicy': 'EXACT_APPROVED_ROOT_CRT_RAW_SHA',
    'endpointPolicy': 'SINGLE_APPROVED_PROVIDER_DIRECT_HOST_SAME_PROJECT',
    'hostaddrAllowed': False, 'poolerFallbackAllowed': False,
    'readOnlyStartupOptions': '-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=5000',
    'connectTimeoutSeconds': 15, 'clientImageId': IMAGE, 'clientVersion': '17.6',
    'prePostGate': {'transactionReadOnly': 'on', 'defaultTransactionReadOnly': 'on', 'transactionIsolation': 'repeatable read'},
    'prePostBackendSslRequired': True,
    'rolesProofBoundary': 'ACTUAL_FIXED_TOOL_LIBPQ_STARTUP_ENFORCEMENT_NOT_PER_TRANSACTION_OBSERVATION',
}
DIRECT_PROFILE = {
    'contract': 'source-provenance-direct-profile/1', 'schemaVersion': 1,
    'profileId': DIRECT_PROFILE_ID, 'scope': SCOPE, 'projectIdentitySha256': DIRECT_PROJECT_SHA,
    'hostNameRule': 'PROVIDER_DIRECT_DB_PREFIX_PROJECT_REF_SUPABASE_CO', 'transport': DIRECT_TRANSPORT,
    'operationalLineageRequired': True, 'arbitraryEndpointAllowed': False, 'productionExecutionAuthorized': False,
}
DIRECT_PROFILE_SHA = sha(canonical(DIRECT_PROFILE))
DIRECT_TRANSPORT_SHA = sha(canonical(DIRECT_TRANSPORT))
ADMISSION_REVIEW = _load_admission_design()
ADMISSION = ADMISSION_REVIEW['forwardAdmissionContract']
DESIGN = _load_design()
BUDGETS = DESIGN['budgets']
QUERY_RECORDS = DESIGN['queryAndProfileContract']['fixedQueryRegistry']
QUERY_SHA = DESIGN['queryAndProfileContract']['fixedQueryRegistrySha256']
QUERIES = {q['id']: q['sql'] for q in QUERY_RECORDS}
PRE_ORDER = DESIGN['queryAndProfileContract']['preQueryOrder']
POST_ORDER = DESIGN['queryAndProfileContract']['postQueryOrder']
BODY_IDS = PRE_ORDER[4:-1]
FIELDS = {k: frozenset(v['requiredFields']) for k, v in DESIGN['authorizationAndLifecycleSchemas'].items()}
ERRORS = frozenset(DESIGN['errorAndPrivacyPolicy']['publicFailureCodes'])
FIELDS.update({k: frozenset(v['requiredFields']) for k, v in DIRECT_SCHEMAS['forwardSchemas'].items()})
FIELDS['ApprovalBindings/2'] = frozenset(DIRECT_SCHEMAS['ApprovalBindings/2']['requiredFields'])
ELIGIBILITY_PATH = ROOT / FORWARD_SLOTS['completion']
CONTEXT_PATHS = tuple(DESIGN['companionEligibilityDesign']['validationContext'])
CLOSURE_PATHS = tuple(DESIGN['companionEligibilityDesign']['companionSourceClosure']['paths'])
COUNTERS = ('credentialFilesRead measurementSessionAttempts rolesToolInvocationAttempts '
            'productionClientInvocations controllerSelectStatements controllerControlStatements '
            'DockerInvocations DockerPulls clustersCreated destinationClusters fullDumpInvocations '
            'schemaDumpInvocations pgRestoreInvocations automaticRetries ownedContainersRemaining '
            'toolInternalSQLStatements physicalServerConnections').split()


SESSION_DESIGN_PATH = ROOT / 'docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-design.json'
SESSION_DESIGN_SHA = 'b445df04c4ee6a46f066d0ecd2b050e2200a8b3827e421a1622c3d5278c3ebfa'
_SESSION_RAW = safe_file(SESSION_DESIGN_PATH)
require(sha(_SESSION_RAW) == SESSION_DESIGN_SHA, 'ACQUISITION_SOURCE_DRIFT')
SESSION_DESIGN = strict_json(_SESSION_RAW)
SESSION_SCHEMAS = SESSION_DESIGN['contractSchemas']['$defs']
SESSION_PROFILE = SESSION_DESIGN['sessionProfile']
SESSION_TRANSPORT = SESSION_PROFILE['transport']
SESSION_PROFILE_SHA = SESSION_DESIGN['sessionProfileSha256']
SESSION_TRANSPORT_SHA = SESSION_DESIGN['sessionTransportSha256']
SESSION_PROFILE_ID = SESSION_PROFILE['profileId']
OWNED_SESSION_POOLER_IMAGE = 'sha256:c57b1222f3ca21a3180c202dea14806cc0be67cda633eb62bcc6481efc0e7a95'
OWNED_SESSION_STOCK_CLIENT_MEMORY_BYTES = SESSION_DESIGN['futureActualLocalValidationResources']['memoryCeilings']['stockPrePostClientBytes']
OWNED_SESSION_ROLES_RUNTIME_MEMORY_BYTES = SESSION_DESIGN['futureActualLocalValidationResources']['memoryCeilings']['rolesRuntimeBytes']
OWNED_SESSION_POOLER_MEMORY_BYTES = SESSION_DESIGN['futureActualLocalValidationResources']['memoryCeilings']['poolerBytes']
SESSION_SLOTS = SESSION_DESIGN['fixedFutureEvidencePaths']
ARTIFACT_LOCK_PATH = ROOT / 'scripts/teaching-agent-r7d-c3b/roles_exporter/artifact-lock-v1.json'
ROLES_REGISTRY_SHA = SESSION_DESIGN['operationRegistry']['canonicalSha256']
EXPORTER_PREFIX = SESSION_DESIGN['runtimeEnvironment']['prefix']
ENV_BINDINGS = SESSION_DESIGN['receiptBridge']['producerEnvBindingMapping']
CLOSURE_PATHS = tuple(SESSION_DESIGN['sourceClosurePolicy']['futurePaths'])
CONTEXT_PATHS = tuple(SESSION_DESIGN['sourceClosurePolicy']['validationContextPaths'])
ELIGIBILITY_PATH = ROOT / SESSION_SLOTS['completion']
STATUS = 'IMPLEMENTED_UNBUILT_NOT_FRESH_VALIDATED'
_CURRENT_CONTRACTS = {
    'source-provenance-human-approval/3': 'HumanApproval3',
    'source-provenance-authorization/3': 'Authorization3',
    'source-provenance-proof-bundle/3': 'ProofBundle3',
    'source-provenance-acquisition-fresh-validation/3': 'FreshValidation3',
    'source-provenance-acquisition-validation-completion/4': 'Completion4',
}
for _contract, _schema in _CURRENT_CONTRACTS.items():
    FIELDS[_contract] = frozenset(SESSION_SCHEMAS[_schema]['required'])


def _schema_check(value, spec):
    """Frozen schema subset; type equality is strict, including bool versus int."""
    if 'xExactFrozenDescriptor' in spec:
        if 'planId' in spec.get('properties',{}):
            require(type(value) is dict and canonical(value)==canonical(operational_lineage(fixture=value.get('transportRiskAcceptance')=={'fixture':True})),'ACQUISITION_ARTIFACT_INVALID')
        elif spec.get('properties',{}).get('contract',{}).get('xFrozenFieldTypeAndConstant'):
            validate_direct_intent(value,fixture=type(value) is dict and value.get('scope')==TEST_SCOPE)
        else:require(False,'ACQUISITION_ARTIFACT_INVALID')
    if '$ref' in spec:
        _schema_check(value, SESSION_SCHEMAS[spec['$ref'].split('/')[-1]])
    kind = spec.get('type')
    predicates = {'object': lambda: type(value) is dict, 'array': lambda: type(value) is list,
                  'string': lambda: type(value) is str, 'integer': lambda: type(value) is int,
                  'number': lambda: moment(value), 'boolean': lambda: type(value) is bool,
                  'null': lambda: value is None}
    if kind is not None:
        require(kind in predicates and predicates[kind](), 'ACQUISITION_ARTIFACT_INVALID')
    if 'const' in spec:
        require(canonical(value) == canonical(spec['const']), 'ACQUISITION_ARTIFACT_INVALID')
    if 'enum' in spec:
        require(any(canonical(value) == canonical(v) for v in spec['enum']), 'ACQUISITION_ARTIFACT_INVALID')
    for key, compare in [('minimum', lambda a,b:a>=b), ('maximum',lambda a,b:a<=b)]:
        if key in spec:
            require(type(value) in (int,float) and moment(value) and compare(value,spec[key]), 'ACQUISITION_ARTIFACT_INVALID')
    if 'pattern' in spec:
        require(type(value) is str and re.fullmatch(spec['pattern'],value) is not None, 'ACQUISITION_ARTIFACT_INVALID')
    if 'properties' in spec:
        require(type(value) is dict, 'ACQUISITION_ARTIFACT_INVALID')
        require(set(spec.get('required',[])) <= set(value), 'ACQUISITION_ARTIFACT_INVALID')
        if spec.get('additionalProperties') is False:
            require(set(value) <= set(spec['properties']), 'ACQUISITION_ARTIFACT_INVALID')
        for key, child in spec['properties'].items():
            if key in value:
                _schema_check(value[key],child)
    if type(value) is list:
        require(len(value)>=spec.get('minItems',0) and len(value)<=spec.get('maxItems',len(value)), 'ACQUISITION_ARTIFACT_INVALID')
        prefix=spec.get('prefixItems',[])
        for i, item in enumerate(value):
            if i<len(prefix): _schema_check(item,prefix[i])
            elif 'items' in spec:
                require(spec['items'] is not False,'ACQUISITION_ARTIFACT_INVALID')
                if type(spec['items']) is dict:_schema_check(item,spec['items'])
        if spec.get('uniqueItems'):
            require(len(set(canonical(x) for x in value))==len(value),'ACQUISITION_ARTIFACT_INVALID')
        if 'xUniqueBy' in spec:
            names=[x['name'] for x in value]
            require(names==sorted(names) and len(names)==len(set(names)), 'ACQUISITION_ARTIFACT_INVALID')
    def matches(s):
        try: _schema_check(value,s);return True
        except Failure:return False
    if 'oneOf' in spec:
        require(sum(matches(s) for s in spec['oneOf'])==1,'ACQUISITION_ARTIFACT_INVALID')
    if 'not' in spec: require(not matches(spec['not']),'ACQUISITION_ARTIFACT_INVALID')
    for part in spec.get('allOf',[]): _schema_check(value,part)
    if 'if' in spec and matches(spec['if']): _schema_check(value,spec.get('then',{}))


def schema_validate(value, name):
    require(name in SESSION_SCHEMAS, 'ACQUISITION_ARTIFACT_INVALID')
    _schema_check(value,SESSION_SCHEMAS[name])
    return value


def validate_artifact_lock(value, *, require_built=True):
    schema_validate(value,'ArtifactLock')
    require(type(require_built) is bool and (not require_built or value['status']=='BUILT'), 'ACQUISITION_IMAGE_UNAVAILABLE')
    return value


def load_artifact_lock():
    """Public artifact admission precedes any credential or network operation."""
    try:
        raw=safe_file(ARTIFACT_LOCK_PATH,private=True)
        value=validate_artifact_lock(strict_json(raw))
        inputs=value['buildInputRawSha256']
        names={'patch':'pg17.6-session-readonly-receipt-v1.patch','recipe':'build-recipe-v1.json',
               'receiptContract':'receipt-contract-v1.json','dockerfile':'Dockerfile.v1','entrypoint':'entrypoint-v1.sh'}
        for k,p in names.items():
            require(sha(safe_file(ARTIFACT_LOCK_PATH.parent/p))==inputs[k], 'ACQUISITION_SOURCE_DRIFT')
        recipe=strict_json(safe_file(ARTIFACT_LOCK_PATH.parent/names['recipe']))
        receipt=strict_json(safe_file(ARTIFACT_LOCK_PATH.parent/names['receiptContract']))
        schema_validate(recipe,'BuildRecipe');schema_validate(receipt,'ReceiptContractFile')
        require(canonical(recipe['upstreamInputs'])==canonical(value['upstreamInputs']) and
                canonical(recipe['configurePolicy'])==canonical(value['configurePolicy']) and
                canonical(receipt['component'])==canonical(value['component']), 'ACQUISITION_SOURCE_DRIFT')
        return value,raw
    except (OSError,ValueError,TypeError,KeyError,Failure):
        raise Failure('ACQUISITION_FAILED','ACQUISITION_IMAGE_UNAVAILABLE') from None


def producer_environment(bindings):
    schema_validate(bindings,'ProducerBindings')
    raw=''.join(m['environmentKey']+'='+bindings[m['bindingField']]+'\n' for m in ENV_BINDINGS).encode('ascii')
    require(len(raw)<=1024,'ACQUISITION_SIZE_LIMIT')
    return raw


def parse_producer_environment(raw, expected_bindings):
    require(type(raw) is bytes and 0<len(raw)<=1024,'ACQUISITION_CAPTURE_BINDING')
    require(raw==producer_environment(expected_bindings),'ACQUISITION_CAPTURE_BINDING')
    return dict(expected_bindings)


def validate_producer_receipt(raw, expected_bindings):
    require(type(raw) is bytes and 0<len(raw)<=8192,'ACQUISITION_SIZE_LIMIT')
    try:
        value=strict_json(raw.decode('utf-8',errors='strict'))
        require(raw==canonical(value)+b'\n','ACQUISITION_CAPTURE_BINDING')
        schema_validate(value,'ProducerReceipt');schema_validate(expected_bindings,'ProducerBindings')
        require(canonical(value['bindings'])==canonical(expected_bindings),'ACQUISITION_CAPTURE_BINDING')
        text=value['measurement']['actualTextValues'];normal=value['measurement']['normalizedValues']
        require(re.fullmatch(r'[1-9][0-9]{0,9}',text[2]) is not None and int(text[2])<=2147483647 and
                normal['backendPid']==int(text[2]) and normal['serverVersionNum']==int(text[3]),'ACQUISITION_CAPTURE_BINDING')
        return value
    except (UnicodeError,ValueError,TypeError,KeyError):
        raise Failure('ACQUISITION_FAILED','ACQUISITION_CAPTURE_BINDING') from None


def _runtime_dependency_path(name):
    require(type(name) is str and re.fullmatch(r'[A-Za-z0-9_.+-]{1,127}',name) and name not in ('.','..'),
            'ACQUISITION_IMAGE_UNAVAILABLE')
    return '/lib64/ld-linux-x86-64.so.2' if name=='ld-linux-x86-64.so.2' else EXPORTER_PREFIX+'/lib/'+name


def validate_runtime_loader_binding(outputs, loaded_paths, actual_files):
    """Pure join of admitted closure, effective loader paths and measured bytes."""
    _schema_check(outputs,SESSION_SCHEMAS['BuildEvidence']['properties']['actualOutputs'])
    dependencies=outputs['runtimeDependencies'];expected={r['name']:r for r in dependencies}
    libpq=outputs['libpq'];record=expected.get('libpq.so.5')
    require(record is not None and record['bytes']==libpq['bytes'] and record['sha256']==libpq['sha256'],
            'ACQUISITION_IMAGE_UNAVAILABLE')
    require(type(loaded_paths) is list and loaded_paths and all(type(p) is str for p in loaded_paths) and
            type(actual_files) is list and len(actual_files)==len(dependencies),'ACQUISITION_IMAGE_UNAVAILABLE')
    paths={_runtime_dependency_path(name):name for name in expected}
    require(set(loaded_paths)==set(paths),'ACQUISITION_IMAGE_UNAVAILABLE')
    names=[]
    for actual in actual_files:
        require(type(actual) is dict and set(actual)=={'name','path','resolvedPath','bytes','sha256'} and
                type(actual['name']) is str and actual['name'] in expected,'ACQUISITION_IMAGE_UNAVAILABLE')
        name=actual['name'];wanted=expected[name];path=_runtime_dependency_path(name)
        resolved=libpq['path'] if name=='libpq.so.5' else path
        require(type(actual['bytes']) is int and actual['bytes']==wanted['bytes'] and
                actual['sha256']==wanted['sha256'] and actual['path']==path and actual['resolvedPath']==resolved,
                'ACQUISITION_IMAGE_UNAVAILABLE')
        names.append(name)
    require(names==sorted(expected) and len(names)==len(set(names)),'ACQUISITION_IMAGE_UNAVAILABLE')
    return actual_files


def parse_runtime_loader_inspection(raw):
    """Parse fixed private ldd output followed by bounded resolved-file records."""
    require(type(raw) is bytes and 0<len(raw)<=1048576,'ACQUISITION_IMAGE_UNAVAILABLE')
    try:lines=raw.decode('ascii',errors='strict').splitlines()
    except UnicodeError:raise Failure('ACQUISITION_FAILED','ACQUISITION_IMAGE_UNAVAILABLE') from None
    loaded=[];actual=[];i=0;metadata=False
    while i<len(lines):
        line=lines[i];i+=1
        if not line.strip():continue
        if line.startswith('UPLY_RUNTIME_FILE='):
            metadata=True;name=line.removeprefix('UPLY_RUNTIME_FILE=');path=_runtime_dependency_path(name)
            require(i+3<=len(lines),'ACQUISITION_IMAGE_UNAVAILABLE')
            resolved,size,digest=lines[i:i+3];i+=3
            require(re.fullmatch(r'[1-9][0-9]{0,18}',size) is not None and
                    re.fullmatch(r'[a-f0-9]{64}  '+re.escape(path),digest) is not None,
                    'ACQUISITION_IMAGE_UNAVAILABLE')
            actual.append({'name':name,'path':path,'resolvedPath':resolved,'bytes':int(size),'sha256':digest[:64]})
            continue
        require(not metadata and 'not found' not in line,'ACQUISITION_IMAGE_UNAVAILABLE')
        if re.fullmatch(r'\s*linux-vdso[.]so[.][0-9]+\s+\(0x[a-fA-F0-9]+\)\s*',line):continue
        library=re.fullmatch(r'\s*([A-Za-z0-9_.+-]{1,127})\s+=>\s+(/\S+)\s+\(0x[a-fA-F0-9]+\)\s*',line)
        loader=re.fullmatch(r'\s*(/\S+)\s+\(0x[a-fA-F0-9]+\)\s*',line)
        require(library is not None or loader is not None,'ACQUISITION_IMAGE_UNAVAILABLE')
        path=library[2] if library else loader[1]
        if library:require(library[1] not in ('.','..') and library[1]==Path(path).name,'ACQUISITION_IMAGE_UNAVAILABLE')
        loaded.append(path)
    return loaded,actual


def validate_observed_counters(value):
    require(type(value) is dict and set(value)==set(COUNTERS),'ACQUISITION_ARTIFACT_INVALID')
    for key,count in value.items():
        if key in ('toolInternalSQLStatements','physicalServerConnections'):
            require(type(count) is str and count=='NOT_OBSERVABLE','ACQUISITION_ARTIFACT_INVALID')
        else:require(integer(count),'ACQUISITION_ARTIFACT_INVALID')
    return value


def session_target(host_sha, frontend_user_sha, artifact_lock_sha, runtime_image, *, fixture=False, project_sha=DIRECT_PROJECT_SHA):
    fields=SESSION_SCHEMAS['OwnedSessionTarget' if fixture else 'SessionTarget']['properties']
    target={k:copy.deepcopy(v['const']) for k,v in fields.items() if 'const' in v}
    target.update(hostIdentitySha256=host_sha,frontendUserIdentitySha256=frontend_user_sha,
                  projectIdentitySha256=project_sha,exporterArtifactLockSha256=artifact_lock_sha,
                  rolesRuntimeImageId=runtime_image,exporterComponent=copy.deepcopy(SESSION_SCHEMAS['Component']['properties']))
    target['exporterComponent']={k:v['const'] for k,v in SESSION_SCHEMAS['Component']['properties'].items()}
    return validate_session_target(target,fixture=fixture)


def validate_session_target(target, *, fixture=False):
    require(type(fixture) is bool, 'ACQUISITION_TARGET_MISMATCH')
    schema_validate(target,'OwnedSessionTarget' if fixture else 'SessionTarget')
    return target


def session_intent(target, *, fixture=False):
    validate_session_target(target,fixture=fixture)
    value={k:copy.deepcopy(v['const']) for k,v in SESSION_SCHEMAS['SessionIntent']['properties'].items() if 'const' in v}
    value.update(target=target,scope=TEST_SCOPE if fixture else SCOPE,sourceTargetId=sha(canonical(target)),
                 exporterComponent=target['exporterComponent'],exporterArtifactLockSha256=target['exporterArtifactLockSha256'])
    return value


def validate_session_intent(intent, *, fixture=False):
    schema_validate(intent,'SessionIntent')
    require(canonical(intent)==canonical(session_intent(intent['target'],fixture=fixture)), 'ACQUISITION_TARGET_MISMATCH')
    return intent['target']


def validate_session_host(host,user,target,*,fixture=False):
    validate_session_target(target,fixture=fixture)
    require(type(host) is str and type(user) is str,'ACQUISITION_CREDENTIAL_BINDING')
    pattern=r'uply-pa-source-[a-f0-9]{32}' if fixture else r'aws-[0-9]+-[a-z0-9-]+[.]pooler[.]supabase[.]com'
    require(re.fullmatch(pattern,host) is not None and sha(canonical(host))==target['hostIdentitySha256'] and
            sha(canonical(user))==target['frontendUserIdentitySha256'],'ACQUISITION_CREDENTIAL_BINDING')
    if fixture:
        m=re.fullmatch(r'postgres[.]([a-f0-9]{32})',user)
        require(m is not None and sha(canonical(m[1]))==target['projectIdentitySha256'],'ACQUISITION_CREDENTIAL_BINDING')
    else:
        m=re.fullmatch(r'postgres[.]([a-z0-9]{20})',user)
        require(m is not None and sha(canonical(m[1]))==target['projectIdentitySha256'],'ACQUISITION_CREDENTIAL_BINDING')
    return host


def validate_bindings(auth, *, fixture=False):
    _validate_authorization_envelope(auth,fixture=fixture)
    b=auth['bindings'];schema_validate(b,'ApprovalBindings3')
    require(b['sessionDesignSha256']==SESSION_DESIGN_SHA and
            canonical(b['operationalLineage'])==canonical(operational_lineage(fixture=fixture)), 'ACQUISITION_AUTH_INVALID')
    target=(validate_direct_intent if b['transportKind']=='DIRECT' else validate_session_intent)(b['acquisitionIntent'],fixture=fixture)
    require(b['acquisitionIntentSha256']==sha(canonical(b['acquisitionIntent'])) and
            b['acquisitionSourceDigest']==sha(canonical(b['acquisitionSourceHashes'])),'ACQUISITION_CAPTURE_BINDING')
    require(b['credentialIdentitySha256']==sha(canonical(b['credentialFileHashes'])) and
            b['caIdentitySha256']==b['credentialFileHashes']['root.crt'],'ACQUISITION_CREDENTIAL_BINDING')
    if b['transportKind']=='SESSION':
        ref=b['exporterArtifactLockRef']
        require(ref['path']==str(ARTIFACT_LOCK_PATH.relative_to(ROOT)) and ref['sha256']==b['exporterArtifactLockSha256'] and
                target['exporterArtifactLockSha256']==ref['sha256'] and
                b['rolesGateRegistrySha256']==ROLES_REGISTRY_SHA,'ACQUISITION_CAPTURE_BINDING')
    return target


def _validate_direct_bindings(auth, *, fixture=False):
    target=validate_bindings(auth,fixture=fixture)
    require(auth['bindings']['transportKind']=='DIRECT','ACQUISITION_TARGET_MISMATCH')
    return target


def _evidence_common(package,sources,context,lock_raw):
    validate_artifact_lock(strict_json(lock_raw))
    return dict(d19DesignSha256=DESIGN_SHA,d26DesignSha256=FORWARD_DESIGN_SHA,sessionDesignSha256=SESSION_DESIGN_SHA,
        operationalPackageHashes=package,operationalPackageDigest=PACKAGE_DIGEST,acquisitionSourceHashes=sources,
        acquisitionSourceDigest=sha(canonical(sources)),validationContextHashes=context,queryRegistrySha256=QUERY_SHA,
        rolesGateRegistrySha256=ROLES_REGISTRY_SHA,acquisitionProfileSha256={'DIRECT':DIRECT_PROFILE_SHA,'SESSION':SESSION_PROFILE_SHA},
        transportPolicySha256={'DIRECT':DIRECT_TRANSPORT_SHA,'SESSION':SESSION_TRANSPORT_SHA},exporterArtifactLockSha256=sha(lock_raw),
        exactTestSelectionSha256=SESSION_DESIGN['validationPlan']['selectionSha256'])


def _validate_admission_bundle(leaf, implementation_raw, validation_raw, package, sources, context, *, build_raw=None, lock_raw=None):
    """Current /4 only; a historical /3 leaf never grants current eligibility."""
    require(type(build_raw) is bytes and type(lock_raw) is bytes,'ACQUISITION_AUTHORITY_INVALID')
    schema_validate(leaf,'Completion4');imp=strict_json(implementation_raw);build=strict_json(build_raw);v=strict_json(validation_raw)
    schema_validate(imp,'FinalImplementationEvidence');schema_validate(build,'BuildEvidence');schema_validate(v,'FreshValidation3')
    schema_validate(sources,'SourceClosure17');schema_validate(context,'Context2')
    require(canonical(package)==canonical(SESSION_DESIGN['protectedOperationalPackageHashes']) and
            sha(canonical(package))==PACKAGE_DIGEST,'ACQUISITION_SOURCE_DRIFT')
    lock=validate_artifact_lock(strict_json(lock_raw));common=_evidence_common(package,sources,context,lock_raw)
    for item in (leaf,imp,build,v):
        for k,want in common.items():require(canonical(item[k])==canonical(want),'ACQUISITION_AUTHORITY_INVALID')
    for key,stage,raw in [('implementationEvidenceRef','implementation',implementation_raw),('buildEvidenceRef','build',build_raw),('validationEvidenceRef','validation',validation_raw),('artifactLockRef',None,lock_raw)]:
        want=str(ARTIFACT_LOCK_PATH.relative_to(ROOT)) if stage is None else SESSION_SLOTS[stage]
        require(leaf[key]=={'path':want,'sha256':sha(raw),'bytes':len(raw)},'ACQUISITION_AUTHORITY_INVALID')
    lockref=leaf['artifactLockRef']
    require(build['artifactLockRef']==lockref and v['artifactLockRef']==lockref and
            canonical(build['actualOutputs'])==canonical(lock['outputs']) and
            build['actualRuntimeImageId']==lock['outputs']['runtimeImageId'] and
            v['implementationEvidenceSha256']==sha(implementation_raw) and v['buildEvidenceSha256']==sha(build_raw), 'ACQUISITION_AUTHORITY_INVALID')
    after=dict(sources,**context)
    changes=[{'path':p,'beforeSha256':SESSION_DESIGN['repositoryBeforeBindings'][p]['sha256'],'afterSha256':after[p]} for p in SESSION_DESIGN['futureImplementation']['modifyPaths']]
    changes += [{'path':p,'beforeSha256':None,'afterSha256':sources[p]} for p in SESSION_DESIGN['futureImplementation']['addPaths']]
    require(canonical(imp['fileChanges'])==canonical(changes) and
            imp['recordedAt']<=v['recordedAt']<=leaf['publishedAt'] and build['recordedAt']<=v['recordedAt'], 'ACQUISITION_AUTHORITY_INVALID')
    for key in ['buildCommandTranscriptRef','dependencyInspectionRef','smokeValidationRef']:
        ref=build[key]
        require(ref['path'].startswith('docs/evidence/teaching-agent-stage-1f-r7d-c/') and
                '..' not in Path(ref['path']).parts and not Path(ref['path']).is_absolute(),'ACQUISITION_AUTHORITY_INVALID')
    require(build['buildCommandTranscriptRef']['sha256']==lock['outputs']['buildCommandTranscriptRawSha256'],'ACQUISITION_AUTHORITY_INVALID')
    return v


def eligibility(plan):
    require(sha(safe_file(DESIGN_PATH))==DESIGN_SHA and sha(safe_file(FORWARD_DESIGN_PATH))==FORWARD_DESIGN_SHA and
            sha(safe_file(SESSION_DESIGN_PATH))==SESSION_DESIGN_SHA and sha(canonical(pc.package_hashes()))==PACKAGE_DIGEST,'ACQUISITION_SOURCE_DRIFT')
    require(ca.BackupLifecycle(plan).authority()['digest']==PACKAGE_DIGEST,'ACQUISITION_AUTHORITY_INVALID')
    lock,lock_raw=load_artifact_lock()
    try:
        leaf_raw=safe_file(ELIGIBILITY_PATH,private=True);leaf=strict_json(leaf_raw);schema_validate(leaf,'Completion4')
        values={k:safe_file(ROOT/SESSION_SLOTS[k],private=True) for k in ('implementation','build','validation')}
        for ref in SESSION_DESIGN['predecessorEvidenceBindings'].values():
            raw=safe_file(ROOT/ref['path'],private=True)
            require(len(raw)==ref['bytes'] and sha(raw)==ref['sha256'],'ACQUISITION_AUTHORITY_INVALID')
        v=_validate_admission_bundle(leaf,values['implementation'],values['validation'],pc.package_hashes(),closure(),context_hashes(),build_raw=values['build'],lock_raw=lock_raw)
        for key in ['buildCommandTranscriptRef','dependencyInspectionRef','smokeValidationRef']:
            ref=strict_json(values['build'])[key];raw=safe_file(ROOT/ref['path'],private=True)
            require(sha(raw)==ref['sha256'] and len(raw)==ref['bytes'],'ACQUISITION_AUTHORITY_INVALID')
        validate_validation_evidence(v,sha(values['implementation']),sha(values['build']))
        return sha(leaf_raw)
    except (OSError,Failure,ValueError,TypeError,KeyError):
        raise Failure('ACQUISITION_FAILED','ACQUISITION_AUTHORITY_INVALID') from None


def integer(x, low=0):
    return type(x) is int and x >= low


def moment(x):
    return type(x) in (int, float) and math.isfinite(x)


def closed(value, name):
    if name in ('ApprovalBindings/3','source-provenance-approval-bindings/3'):return schema_validate(value,'ApprovalBindings3')
    if name=='source-provenance-client-proof/3':return schema_validate(value,'ClientProof3')
    if name in _CURRENT_CONTRACTS:return schema_validate(value,_CURRENT_CONTRACTS[name])
    require(type(value) is dict and set(value)==FIELDS[name])
    if name.startswith('source-provenance-'):
        require(value['contract']==name and type(value['schemaVersion']) is int and value['schemaVersion']==int(name.rsplit('/',1)[1]))
    return value


def obj(contract, **kw):
    value = dict(contract=contract, schemaVersion=int(contract.rsplit('/', 1)[1]), **kw)
    closed(value, contract)
    return value


def hashes(paths):
    return {p: sha(safe_file(ROOT / p)) for p in paths}


def closure():
    load_artifact_lock()
    return hashes(CLOSURE_PATHS)


def context_hashes():
    return hashes(CONTEXT_PATHS)


def _ref(path):
    raw = safe_file(path, private=True)
    return {'path': Path(path).name, 'sha256': sha(raw), 'bytes': len(raw)}


def _private_dir(path, create=False):
    """Walk without following symlinks; only private owned descendants are made."""
    path = Path(path).absolute()
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in path.parts[1:]:
            try:
                new = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            except FileNotFoundError:
                require(create, 'ACQUISITION_FILE_IDENTITY')
                os.mkdir(part, 0o700, dir_fd=fd)
                os.fsync(fd)
                new = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = new
        s = os.fstat(fd)
        require(s.st_uid == os.getuid() and stat.S_IMODE(s.st_mode) == 0o700, 'ACQUISITION_FILE_IDENTITY')
        return fd
    except BaseException:
        os.close(fd)
        raise


def private_read(path, maximum=134217728):
    path = Path(path)
    d = _private_dir(path.parent)
    try:
        f = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=d)
        try:
            s = os.fstat(f)
            require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_uid == os.getuid() and
                    stat.S_IMODE(s.st_mode) == 0o600 and s.st_size <= maximum, 'ACQUISITION_FILE_IDENTITY')
            with os.fdopen(f, 'rb', closefd=False) as stream:
                raw = stream.read(maximum + 1)
            identity=lambda v:(v.st_dev,v.st_ino,v.st_mode,v.st_uid,v.st_gid,v.st_nlink,v.st_size,v.st_mtime_ns,v.st_ctime_ns)
            require(len(raw) <= maximum and identity(os.fstat(f)) == identity(s) and
                    identity(os.stat(path.name, dir_fd=d, follow_symlinks=False)) == identity(s), 'ACQUISITION_FILE_IDENTITY')
            return raw
        finally:
            os.close(f)
    finally:
        os.close(d)


def durable(path, raw):
    """Private exclusive file publication; no replace, no cleanup-on-failure lie."""
    require(type(raw) is bytes, 'ACQUISITION_DURABILITY_FAILED')
    path = Path(path)
    d = _private_dir(path.parent, create=True)
    try:
        f = os.open(path.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=d)
        try:
            view = memoryview(raw)
            while view:
                n = os.write(f, view)
                require(n > 0, 'ACQUISITION_DURABILITY_FAILED')
                view = view[n:]
            os.fsync(f)
            written = os.fstat(f)
        finally:
            os.close(f)
        os.fsync(d)
        readback = private_read(path, max(len(raw), 1))
        seen = os.stat(path.name, dir_fd=d, follow_symlinks=False)
        require(readback == raw and sha(readback) == sha(raw) and
                (seen.st_ino, seen.st_dev) == (written.st_ino, written.st_dev), 'ACQUISITION_DURABILITY_FAILED')
        return {'path': path.name, 'sha256': sha(raw), 'bytes': len(raw)}
    finally:
        os.close(d)


def write_json(path, value):
    return durable(path, canonical(value) + b'\n')


def _file_identity(s):
    return (s.st_dev,s.st_ino,s.st_mode,s.st_uid,s.st_gid,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)


def _aux_parent(auth_root,acquisition_id,invocation_id,create=False):
    require(type(acquisition_id) is str and HEX32.fullmatch(acquisition_id) and
            type(invocation_id) is str and HEX32.fullmatch(invocation_id) and os.geteuid()!=0,'ACQUISITION_FILE_IDENTITY')
    root=Path(auth_root);fd=_private_dir(root)
    try:
        for part in ('proof-staging',acquisition_id,invocation_id):
            try:new=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=fd)
            except FileNotFoundError:
                require(create,'ACQUISITION_FILE_IDENTITY');os.mkdir(part,0o700,dir_fd=fd);os.fsync(fd)
                new=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=fd)
            s=os.fstat(new)
            try:require(s.st_gid==os.getegid() and s.st_uid==os.geteuid() and stat.S_IMODE(s.st_mode)==0o700,'ACQUISITION_FILE_IDENTITY')
            except BaseException:os.close(new);raise
            os.close(fd);fd=new
        return root/'proof-staging'/acquisition_id/invocation_id,fd
    except BaseException:os.close(fd);raise


def read_auxiliary_staging(auth_root, acquisition_id, invocation_id, name, *, held_parent_fd=None):
    require(name in ('producer.env','readonly.json'),'ACQUISITION_FILE_IDENTITY')
    path,checkfd=_aux_parent(auth_root,acquisition_id,invocation_id)
    fd=checkfd if held_parent_fd is None else held_parent_fd
    maximum=1024 if name=='producer.env' else 8192
    try:
        parent=os.fstat(fd)
        require((parent.st_dev,parent.st_ino)==(os.fstat(checkfd).st_dev,os.fstat(checkfd).st_ino) and
                parent.st_uid==os.geteuid() and parent.st_gid==os.getegid() and
                stat.S_IMODE(parent.st_mode)==0o700,'ACQUISITION_FILE_IDENTITY')
        f=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=fd)
        try:
            s=os.fstat(f)
            require(stat.S_ISREG(s.st_mode) and s.st_uid==os.geteuid() and s.st_gid==os.getegid() and
                    stat.S_IMODE(s.st_mode)==0o600 and s.st_nlink==1 and 0<s.st_size<=maximum,'ACQUISITION_FILE_IDENTITY')
            chunks=bytearray()
            while True:
                b=os.read(f,min(65536,maximum+1-len(chunks)))
                if not b:break
                chunks.extend(b);require(len(chunks)<=maximum,'ACQUISITION_SIZE_LIMIT')
            require(_file_identity(os.fstat(f))==_file_identity(s) and
                    _file_identity(os.stat(name,dir_fd=fd,follow_symlinks=False))==_file_identity(s),'ACQUISITION_FILE_IDENTITY')
            other=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=fd)
            try:require(_file_identity(os.fstat(other))==_file_identity(s),'ACQUISITION_FILE_IDENTITY')
            finally:os.close(other)
            _,finalparent=_aux_parent(auth_root,acquisition_id,invocation_id)
            try:require((os.fstat(finalparent).st_dev,os.fstat(finalparent).st_ino)==(parent.st_dev,parent.st_ino),'ACQUISITION_FILE_IDENTITY')
            finally:os.close(finalparent)
            raw=bytes(chunks)
            ref={'path':str((path/name).relative_to(auth_root)),'bytes':len(raw),'sha256':sha(raw)}
            schema_validate(ref,'ProducerEnvironmentRef' if name=='producer.env' else 'MeasurementReceiptRef')
            return raw,ref
        finally:os.close(f)
    finally:os.close(checkfd)


def _write_producer_environment(parentfd, raw):
    require(type(raw) is bytes and 0<len(raw)<=1024,'ACQUISITION_SIZE_LIMIT')
    f=os.open('producer.env',os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600,dir_fd=parentfd)
    try:
        s=os.fstat(f)
        require(stat.S_ISREG(s.st_mode) and s.st_uid==os.geteuid() and s.st_gid==os.getegid() and
                stat.S_IMODE(s.st_mode)==0o600 and s.st_nlink==1,'ACQUISITION_FILE_IDENTITY')
        view=memoryview(raw)
        while view:
            n=os.write(f,view);require(n>0,'ACQUISITION_DURABILITY_FAILED');view=view[n:]
        os.fsync(f);os.fsync(parentfd);os.lseek(f,0,os.SEEK_SET)
        readback=bytearray()
        while True:
            b=os.read(f,1025-len(readback))
            if not b:break
            readback.extend(b);require(len(readback)<=1024,'ACQUISITION_SIZE_LIMIT')
        done=os.fstat(f)
        require(bytes(readback)==raw and (done.st_dev,done.st_ino)==(s.st_dev,s.st_ino) and
                _file_identity(os.stat('producer.env',dir_fd=parentfd,follow_symlinks=False))==_file_identity(done),'ACQUISITION_DURABILITY_FAILED')
    finally:os.close(f)


def validate_historical_authorization(auth, *, offline=False):
    """Explicit read-only history parsing; never accepted by current acquisition."""
    require(offline is True,'ACQUISITION_AUTHORITY_INVALID')
    closed(auth,'source-provenance-authorization/2')
    closed(auth['bindings'],'ApprovalBindings/2')
    validate_direct_intent(auth['bindings']['acquisitionIntent'],fixture=auth['scope']==TEST_SCOPE)
    require(canonical(auth['permissions'])==canonical(permissions()) and canonical(auth['budgets'])==canonical(BUDGETS))
    return auth


def validate_session_bootstrap(value):
    ba._identity(value)
    require(type(value['serverVersionNum']) is int and value['serverVersionNum']==170006 and
            value['serverEncoding']=='UTF8' and value['clientEncoding']=='UTF8' and
            value['database']=='postgres' and value['session_user']=='postgres' and value['current_user']=='postgres','ACQUISITION_PROFILE_UNSUPPORTED')
    return value


def validate_session_identity(value):
    require(type(value) is dict and set(value)=={'database','role','currentRole','serverMajor','readOnly','roleExpiry'} and
            value['database']=='postgres' and value['role']=='postgres' and value['currentRole']=='postgres' and
            type(value['serverMajor']) is int and value['serverMajor']==17 and value['readOnly']=='on' and
            value['roleExpiry'] is None,'ACQUISITION_TARGET_MISMATCH')
    return value


def _decode_output(item, key):
    require(type(item[key + 'Base64']) is str, 'ACQUISITION_AUTHORITY_INVALID')
    try:
        raw = base64.b64decode(item[key + 'Base64'], validate=True)
    except ValueError:
        raise Failure('ACQUISITION_FAILED', 'ACQUISITION_AUTHORITY_INVALID') from None
    require(sha(raw) == item[key + 'Sha256'], 'ACQUISITION_AUTHORITY_INVALID')
    return raw


def expected_selections():
    return strict_json(canonical(SESSION_DESIGN['validationPlan']['exactPhases']))


def _unittest_pass_ids(raw):
    """Closed verbose-unittest transcript check; no invented result-only totals."""
    text=raw.decode('utf-8',errors='strict')
    summary=re.search(r'\n-{10,}\nRan ([0-9]+) tests? in [^\n]+\n\nOK\s*\Z',text)
    require(summary is not None,'ACQUISITION_AUTHORITY_INVALID')
    body=text[:summary.start()]
    headers=list(re.finditer(r'^([a-zA-Z0-9_]+) \(([a-zA-Z0-9_.]+)\)',body,re.M))
    require(len(headers)==int(summary[1]),'ACQUISITION_AUTHORITY_INVALID')
    result=[]
    for i,header in enumerate(headers):
        segment=body[header.end():headers[i+1].start() if i+1<len(headers) else len(body)]
        require(header[1].startswith('test_') and header[2].split('.')[-1]==header[1] and
                re.search(r'(?:\.\.\. |\n)ok\s*\Z',segment) is not None,'ACQUISITION_AUTHORITY_INVALID')
        result.append(header[2])
    require(len(result)==len(set(result)),'ACQUISITION_AUTHORITY_INVALID')
    return result


def validate_validation_evidence(v, implementation, build=None):
    """Verify actual per-method receipts and raw phase outputs, not leaf totals."""
    schema_validate(v,'FreshValidation3')
    lock,lock_raw=load_artifact_lock()
    common=_evidence_common(pc.package_hashes(),closure(),context_hashes(),lock_raw)
    for k,want in common.items():require(canonical(v[k])==canonical(want),'ACQUISITION_AUTHORITY_INVALID')
    require(v['implementationEvidenceSha256']==implementation and type(build) is str and
            HEX64.fullmatch(build) and v['buildEvidenceSha256']==build,'ACQUISITION_AUTHORITY_INVALID')
    expected = expected_selections()
    require(sha(canonical(expected)) == SESSION_DESIGN['validationPlan']['selectionSha256'], 'ACQUISITION_SOURCE_DRIFT')
    require(type(v['phases']) is list and len(v['phases']) == len(expected), 'ACQUISITION_AUTHORITY_INVALID')
    executions = []
    for phase, want in zip(v['phases'], expected):
        require(type(phase) is dict and set(phase) == {'name','startedAt','endedAt','returnCode','command','stdoutBase64',
                'stdoutSha256','stderrBase64','stderrSha256','results'}, 'ACQUISITION_AUTHORITY_INVALID')
        require(phase['name'] == want['name'] and moment(phase['startedAt']) and moment(phase['endedAt']) and
                phase['startedAt'] <= phase['endedAt'] and type(phase['returnCode']) is int and phase['returnCode'] == 0 and
                type(phase['command']) is list and all(type(x) is str for x in phase['command']), 'ACQUISITION_AUTHORITY_INVALID')
        _decode_output(phase, 'stdout')
        stderr=_decode_output(phase, 'stderr')
        require(_unittest_pass_ids(stderr)==want['testIds'],'ACQUISITION_AUTHORITY_INVALID')
        require(type(phase['results']) is list and len(phase['results']) == len(want['testIds']), 'ACQUISITION_AUTHORITY_INVALID')
        for result, test_id in zip(phase['results'], want['testIds']):
            require(type(result) is dict and set(result) == {'testId','result','startedAt','endedAt','errorTextSha256'} and
                    result['testId'] == test_id and result['result'] == 'PASS' and
                    result['errorTextSha256'] == sha(b'') and moment(result['startedAt']) and moment(result['endedAt']) and
                    phase['startedAt'] <= result['startedAt'] <= result['endedAt'] <= phase['endedAt'], 'ACQUISITION_AUTHORITY_INVALID')
            executions.append(test_id)
    require(len(executions) == 915 and len(set(executions)) == 613, 'ACQUISITION_AUTHORITY_INVALID')


def _admission_require(ok):
    require(ok, 'ACQUISITION_AUTHORITY_INVALID')


def _admission_closed(value, fields):
    _admission_require(type(value) is dict and set(value) == set(fields))


def _admission_equal(actual, expected):
    # JSON equality must not treat bool as int, or float as schema integer.
    _admission_require(canonical(actual) == canonical(expected))


def _admission_sha(value):
    _admission_require(type(value) is str and HEX64.fullmatch(value) is not None)


def _admission_time(value):
    _admission_require(moment(value) and value >= 0)


def _admission_ref(ref, stage):
    _admission_closed(ref, ('path', 'sha256', 'bytes'))
    _admission_require(ref['path'] == FORWARD_SLOTS[stage] and integer(ref['bytes'], 1))
    _admission_sha(ref['sha256'])








def validate_direct_profile(profile, transport):
    require(canonical(profile) == canonical(DIRECT_PROFILE) and
            canonical(transport) == canonical(DIRECT_TRANSPORT), 'ACQUISITION_TARGET_MISMATCH')
    return DIRECT_PROFILE_SHA, DIRECT_TRANSPORT_SHA


def direct_target(host_sha, *, fixture=False, project_sha=DIRECT_PROJECT_SHA):
    """Pure target builder; never constructs or resolves a production hostname."""
    target = dict(contract='source-provenance-direct-target/1', schemaVersion=1,
        targetProfile='OWNED_TEST_SOURCE_PROVENANCE_DIRECT/1' if fixture else DIRECT_PROFILE_ID,
        projectIdentitySha256=project_sha, hostIdentitySha256=host_sha, database='postgres',
        role='postgres', currentRole='postgres', port=5432, serverMajor=17, imageId=IMAGE,
        sslmode='verify-full', fixture=fixture, connectionKind='DIRECT_POSTGRES',
        directProfileSha256=DIRECT_PROFILE_SHA, transportPolicySha256=DIRECT_TRANSPORT_SHA)
    validate_direct_target(target, fixture=fixture)
    return target


def validate_direct_target(target, *, fixture=False):
    require(type(fixture) is bool and type(target) is dict and
            set(target) == set(DIRECT_SCHEMAS['DirectTarget']['requiredFields']), 'ACQUISITION_TARGET_MISMATCH')
    for key in ('hostIdentitySha256', 'projectIdentitySha256'):
        require(type(target[key]) is str and HEX64.fullmatch(target[key]), 'ACQUISITION_TARGET_MISMATCH')
    constants = dict(contract='source-provenance-direct-target/1', schemaVersion=1,
        targetProfile='OWNED_TEST_SOURCE_PROVENANCE_DIRECT/1' if fixture else DIRECT_PROFILE_ID,
        database='postgres', role='postgres', currentRole='postgres', port=5432, serverMajor=17,
        imageId=IMAGE, sslmode='verify-full', fixture=fixture, connectionKind='DIRECT_POSTGRES',
        directProfileSha256=DIRECT_PROFILE_SHA, transportPolicySha256=DIRECT_TRANSPORT_SHA)
    if not fixture:
        constants['projectIdentitySha256'] = DIRECT_PROJECT_SHA
    require(all(canonical(target[k]) == canonical(v) for k, v in constants.items()), 'ACQUISITION_TARGET_MISMATCH')
    return target


def validate_direct_host(host, target, *, fixture=False):
    validate_direct_target(target, fixture=fixture)
    require(type(host) is str, 'ACQUISITION_CREDENTIAL_BINDING')
    match = re.fullmatch(r'uply-pa-source-[a-f0-9]{32}' if fixture else r'db\.([a-z0-9]{20})\.supabase\.co', host)
    require(match is not None and sha(canonical(host)) == target['hostIdentitySha256'], 'ACQUISITION_CREDENTIAL_BINDING')
    if not fixture:
        require(sha(canonical(match[1])) == target['projectIdentitySha256'], 'ACQUISITION_CREDENTIAL_BINDING')
    return host


def direct_intent(target, *, fixture=False):
    validate_direct_target(target, fixture=fixture)
    return dict(contract='source-provenance-direct-intent/1', schemaVersion=1,
        scope=TEST_SCOPE if fixture else SCOPE, target=target, sourceTargetId=sha(canonical(target)),
        directProfileSha256=DIRECT_PROFILE_SHA, transportPolicySha256=DIRECT_TRANSPORT_SHA,
        directTransportExplicitlyApproved=True, outputPolicy='PRIVATE_SOURCE_ACQUISITION_ONLY',
        productionAdoptionReady=False, AgentRunAuthorized=False)


def validate_direct_intent(intent, *, fixture=False):
    require(type(intent) is dict and set(intent) == set(DIRECT_SCHEMAS['DirectIntent']['requiredFields']), 'ACQUISITION_TARGET_MISMATCH')
    expected = direct_intent(intent['target'], fixture=fixture)
    require(canonical(intent) == canonical(expected), 'ACQUISITION_TARGET_MISMATCH')
    return intent['target']


def operational_lineage(*, fixture=False):
    """The unchanged pooled authority is lineage, never direct transport permission."""
    return dict(planId='acl-000-v1',
        planSha256='5b1c0d794b28f5f5fa3c85ccc4d3f461d51af95a57a820b9889b16bdf7b369fd',
        registrySha256='70663e781f13cf350e07822bdb304dcf74fa4a61a1adf1e1a0c1cd42956b2610',
        targetProfile='uply-canonical-maintenance/1', target=dict(DESIGN['targetBinding'], currentRole='postgres', fixture=False),
        d17LeafBindings=DESIGN['D17SuccessLeafBindings'], operationalPackageHashes=FORWARD_DESIGN['protectedOperationalPackageHashes'],
        operationalPackageDigest=PACKAGE_DIGEST, transportRiskAcceptance={'fixture': True} if fixture else pc.RISK_BINDING,
        recoveryCandidateName=ba.RECOVERY_CANDIDATE, recoveryCandidateVersion=4)


def application_name(kind, invocation_id):
    require(kind in ('PRE', 'ROLES', 'POST') and type(invocation_id) is str and HEX32.fullmatch(invocation_id),
            'ACQUISITION_SCOPE_MISMATCH')
    return 'spa_' + kind.lower() + '_' + invocation_id





@dataclass(frozen=True)
class _Context:
    """No public CLI route to fixture contexts; source/credential identity stays exact."""
    root: Path
    credentials: Path
    target: dict
    profile: dict
    fixture: bool = False
    network: str = 'host'
    fixture_label: str = ''
    transport_kind: str = 'DIRECT'
    fixture_pooler_input_sha256: str = ''

    def check(self):
        require(self.transport_kind in ('DIRECT','SESSION') and all(',' not in str(p) and '\n' not in str(p) for p in (self.root,self.credentials)),'ACQUISITION_TARGET_MISMATCH')
        (validate_direct_target if self.transport_kind=='DIRECT' else validate_session_target)(self.target,fixture=self.fixture)
        require(type(self.fixture) is bool and self.target['fixture'] is self.fixture, 'ACQUISITION_TARGET_MISMATCH')
        if self.fixture:
            if self.transport_kind=='SESSION':
                require(type(self.fixture_pooler_input_sha256) is str and HEX64.fullmatch(self.fixture_pooler_input_sha256),'ACQUISITION_TARGET_MISMATCH')
            else:require(self.fixture_pooler_input_sha256=='','ACQUISITION_TARGET_MISMATCH')
            require(self.target['targetProfile'] == ('OWNED_TEST_SOURCE_PROVENANCE_DIRECT/1' if self.transport_kind=='DIRECT' else 'OWNED_TEST_SOURCE_PROVENANCE_SESSION/1') and
                    re.fullmatch(r'uply-pa-test-[a-f0-9]{32}', self.network) and self.fixture_label == self.network and
                    self.root.is_absolute() and self.credentials.is_absolute() and
                    '..' not in self.root.parts and '..' not in self.credentials.parts and
                    self.root.resolve()==self.root and self.credentials.resolve()==self.credentials and
                    self.root.is_relative_to(Path('/tmp')) and self.credentials.is_relative_to(Path('/tmp')), 'ACQUISITION_TARGET_MISMATCH')
        else:
            require(self.network == 'host' and self.fixture_label == '' and self.fixture_pooler_input_sha256=='' and
                    self.profile['projectIdentitySha256'] == DIRECT_PROJECT_SHA and
                    self.root == Path(self.profile['authorizationDirectory']) / ('source-bootstrap-provenance-direct' if self.transport_kind=='DIRECT' else 'source-bootstrap-provenance-session') and
                    self.credentials == Path(self.profile['connectionDirectory']).parent / ('db-source-provenance-direct' if self.transport_kind=='DIRECT' else 'db-source-provenance-session'), 'ACQUISITION_TARGET_MISMATCH')


def production_context(approval_id, approval_sha, *, transport_kind='DIRECT'):
    require(type(approval_id) is str and HEX32.fullmatch(approval_id) and
            type(approval_sha) is str and HEX64.fullmatch(approval_sha))
    require(transport_kind in ('DIRECT','SESSION'))
    load_artifact_lock()
    plan = pc.load_plan('acl-000-v1')
    require(not plan.fixture and plan.data['status'] == 'READY_FOR_INSTALL', 'ACQUISITION_TARGET_MISMATCH')
    profile = strict_json(safe_file(pc.PROFILE_PATH))['profiles']['uply-canonical-maintenance/1']
    root = Path(profile['authorizationDirectory']) / ('source-bootstrap-provenance-direct' if transport_kind=='DIRECT' else 'source-bootstrap-provenance-session')
    # The future human-authorized target is read only from this fixed approval slot.
    # No credential read, guessed host, or connection is needed to form the context.
    raw = private_read(root / 'approvals' / (approval_id + '.json'), 1048576)
    require(sha(raw) == approval_sha)
    auth = strict_json(raw)
    target = validate_bindings(auth)
    require(auth['bindings']['transportKind']==transport_kind,'ACQUISITION_TARGET_MISMATCH')
    ctx = _Context(root, Path(profile['connectionDirectory']).parent / ('db-source-provenance-direct' if transport_kind=='DIRECT' else 'db-source-provenance-session'),target,profile,transport_kind=transport_kind)
    ctx.check()
    return ctx, plan


def _time_gate(value, now=None):
    now = time.time() if now is None else now
    require(all(moment(value[k]) for k in ['issuedAt','notBefore','expiresAt']) and
            value['issuedAt'] <= value['notBefore'] <= now < value['expiresAt'] and
            value['expiresAt'] - value['issuedAt'] <= 900, 'ACQUISITION_AUTH_EXPIRED')


def permissions():
    return {k: (v == 'const true') for k, v in DESIGN['authorizationAndLifecycleSchemas']['Permissions']['fieldTypesAndConstants'].items()}


def _validate_authorization_envelope(value, *, human=False, fixture=False):
    """Current /3 only; historical /2 requires the explicit offline reader."""
    require(type(human) is bool and type(fixture) is bool)
    closed(value, 'source-provenance-human-approval/3' if human else 'source-provenance-authorization/3')
    require(value['scope'] == (TEST_SCOPE if fixture else SCOPE), 'ACQUISITION_SCOPE_MISMATCH')
    for key in ('approvalId', 'acquisitionId') if human else ('approvalId', 'acquisitionId', 'nonce'):
        require(type(value[key]) is str and HEX32.fullmatch(value[key]))
    require(integer(value['operatorUid'],1))
    require(all(moment(value[k]) for k in ('issuedAt', 'notBefore', 'expiresAt')) and
            value['issuedAt'] <= value['notBefore'] < value['expiresAt'] and
            value['expiresAt'] - value['issuedAt'] <= 900, 'ACQUISITION_AUTH_EXPIRED')
    require(canonical(value['permissions']) == canonical(permissions()) and
            canonical(value['budgets']) == canonical(BUDGETS))
    if human:
        require(value['explicitApproval'] is True and value['outputPolicy'] == 'PRIVATE_SOURCE_ACQUISITION_ONLY')
    else:
        require(type(value['humanApprovalSha256']) is str and HEX64.fullmatch(value['humanApprovalSha256']))
    return value


def _validate_approval_pair(auth, human, human_sha, *, fixture=False):
    """Validate both envelopes independently before their immutable joins."""
    _validate_authorization_envelope(auth, fixture=fixture)
    _validate_authorization_envelope(human, human=True, fixture=fixture)
    require(type(human_sha) is str and HEX64.fullmatch(human_sha) and auth['humanApprovalSha256'] == human_sha)
    common = (FIELDS['source-provenance-authorization/3'] & FIELDS['source-provenance-human-approval/3']) - {'contract'}
    require(all(canonical(auth[k]) == canonical(human[k]) for k in common))


def validate_authorization(auth, human, human_sha, ctx, eligible_sha, plan=None):
    ctx.check()
    _validate_approval_pair(auth, human, human_sha, fixture=ctx.fixture)
    _time_gate(auth); _time_gate(human)
    require(auth['operatorUid'] == os.getuid())
    target = validate_bindings(auth, fixture=ctx.fixture)
    b = auth['bindings']; lineage = b['operationalLineage']
    require(b['transportKind']==ctx.transport_kind,'ACQUISITION_TARGET_MISMATCH')
    if ctx.transport_kind=='SESSION':
        lock,lockraw=load_artifact_lock()
        require(b['exporterArtifactLockRef']=={'path':str(ARTIFACT_LOCK_PATH.relative_to(ROOT)),'sha256':sha(lockraw),'bytes':len(lockraw)} and
                target['rolesRuntimeImageId']==lock['outputs']['runtimeImageId'],'ACQUISITION_CAPTURE_BINDING')
    require(b['acquisitionEligibilitySha256'] == eligible_sha and
            lineage['operationalPackageHashes'] == pc.package_hashes() and
            b['acquisitionSourceHashes'] == closure() and b['acquisitionSourceDigest'] == sha(canonical(closure())) and
            b['validationContextHashes'] == context_hashes() and b['queryRegistrySha256'] == QUERY_SHA, 'ACQUISITION_SOURCE_DRIFT')
    require(canonical(target) == canonical(ctx.target), 'ACQUISITION_TARGET_MISMATCH')
    d18 = strict_json(safe_file(ROOT / DESIGN['bindings']['D18']['path']))
    require(lineage['planSha256'] == d18['actualPlanState']['sha256'] and
            lineage['registrySha256'] == pc.package_hashes()['plan_registry.json'], 'ACQUISITION_TARGET_MISMATCH')
    files = b['credentialFileHashes']
    require(type(files) is dict and set(files) == {'pg_service.conf','pgpass','root.crt'} and
            all(type(v) is str and HEX64.fullmatch(v) for v in files.values()) and
            b['credentialIdentitySha256'] == sha(canonical(files)) and b['caIdentitySha256'] == files['root.crt'], 'ACQUISITION_CREDENTIAL_BINDING')
    if not ctx.fixture:
        require(plan is not None and plan.digest == lineage['planSha256'])
        require(ca.BackupLifecycle(plan).authority()['digest'] == PACKAGE_DIGEST, 'ACQUISITION_AUTHORITY_INVALID')
        pc.risk_guard(plan, {'transportRiskAcceptance': lineage['transportRiskAcceptance']})


def _raw_snapshot(responses):
    return {key: next(r['canonicalResponse'] for r in responses if r['queryId'] == key) for key in BODY_IDS}


def source_profile(responses):
    values = _raw_snapshot(responses)
    bootstrap = [r['canonicalResponse'] for r in responses if r['queryId'] == 'bootstrapIdentity'][-1]
    identity = ba._identity(bootstrap)
    catalog = values['sourceCatalogAndMigrationLedger']
    ba._source_collision(catalog)
    members=catalog['memberships']; names={r[0] for r in catalog['roles']}
    require(type(members) is list, 'ACQUISITION_PROFILE_UNSUPPORTED')
    seen_members=set()
    for row in members:
        require(type(row) is list and len(row)==6 and all(type(x) is str and x in names for x in row[:3]) and
                all(type(x) is bool for x in row[3:]) and tuple(row) not in seen_members, 'ACQUISITION_PROFILE_UNSUPPORTED')
        seen_members.add(tuple(row))
    require([x for x in catalog['roles'] if x[0] == identity['bootstrapName']] == [bootstrap['bootstrapRows'][0]['roleTuple']], 'ACQUISITION_SOURCE_DRIFT')
    ba._plpgsql_profile(values['plpgsqlExpectedState']); ba._unsupported_families(values['unsupportedRoleFamilies'])
    envelope = ba._extension_envelope(values['extensionRecoveryExpectedState.extensionState'], values['extensionRecoveryExpectedState.archiveAclContextGuard'])
    ba._extension_prerequisite(envelope, catalog, identity)
    ba._database_acl_profile(values['databaseAclBeforeCapture'], identity, catalog['roles'])
    settings = values['globalRoleSettings']; roles = {r[0]: r[10] for r in catalog['roles']}
    require(type(settings) is list, 'ACQUISITION_PROFILE_UNSUPPORTED')
    seen = set(); oids = set()
    for row in settings:
        require(type(row) is list and len(row) == 4 and row[0] == '0' and type(row[1]) is str and
                re.fullmatch(r'[1-9][0-9]*', row[1]) and row[2] in roles and row[2] not in seen and row[1] not in oids and
                canonical(row[3]) == canonical(roles[row[2]]), 'ACQUISITION_PROFILE_UNSUPPORTED')
        seen.add(row[2]); oids.add(row[1])
    require(all(v in (None, []) or k in seen for k, v in roles.items()), 'ACQUISITION_PROFILE_UNSUPPORTED')
    loc = values['localeCatalog']
    require(type(loc) is dict and set(loc) == {'lcCollate','lcCtype','localeProvider','localeName'} and
            all(type(loc[k]) is str for k in ['lcCollate','lcCtype','localeProvider']) and
            (loc['localeName'] is None or type(loc['localeName']) is str), 'ACQUISITION_QUERY_SHAPE')
    namespaces = values['schemaEnvironment']; names = set(); namespace_oids = set()
    require(type(namespaces) is list, 'ACQUISITION_QUERY_SHAPE')
    for row in namespaces:
        require(type(row) is list and len(row) == 3 and all(type(x) is str for x in row) and
                re.fullmatch(r'[1-9][0-9]*', row[0]) and row[0] not in namespace_oids and row[1] not in names and row[2] in roles, 'ACQUISITION_QUERY_SHAPE')
        namespace_oids.add(row[0]); names.add(row[1])
    environment = []
    for name, config in roles.items():
        for item in config or []:
            if item.startswith('search_path='):
                parts = item.split('=', 1)[1].split(', ')
                environment.append({'role':name,'orderedComponents':parts,'componentExists':[p in names for p in parts]})
    return identity, values, environment


def lexical_precheck(raw, identity):
    require(type(raw) is bytes and len(raw) <= BUDGETS['rolesBytesMaximum'], 'ACQUISITION_SIZE_LIMIT')
    require(not re.search(rb'\bPASSWORD\s+\S+', raw, re.I), 'ACQUISITION_ROLES_LEXICAL_UNSUPPORTED')
    parsed = ba._scan_roles(raw)
    hits = [s for s in parsed['statements'] if s['createRole'] == identity['bootstrapName']]
    require(len(hits) == 1 and not hits[0]['hasInternalComment'], 'ACQUISITION_ROLES_LEXICAL_UNSUPPORTED')
    item = hits[0]
    return {'matchCount':1,'span':[item['start'],item['end']],'statementSha256':sha(raw[item['start']:item['end']])}


class _Process:
    """Selector-driven bounded stdout/stderr; no thread queue or unbounded PIPE read."""
    def __init__(self, argv, deadline, cap, guard=lambda: None):
        self.deadline, self.cap, self.guard = deadline, cap, guard
        self.out, self.err = bytearray(), bytearray()
        self.proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, env=SAFE_ENV, start_new_session=True)
        os.set_blocking(self.proc.stdin.fileno(), False)
        self.selector = selectors.DefaultSelector()
        for stream, kind in [(self.proc.stdout, 'out'), (self.proc.stderr, 'err')]:
            os.set_blocking(stream.fileno(), False)
            self.selector.register(stream, selectors.EVENT_READ, kind)

    def pump(self):
        self.guard()
        require(time.monotonic() < self.deadline, 'ACQUISITION_TIMEOUT')
        for key, _ in self.selector.select(min(0.2, max(0, self.deadline-time.monotonic()))):
            data = os.read(key.fileobj.fileno(), 65536)
            if not data:
                self.selector.unregister(key.fileobj)
                continue
            buf = self.out if key.data == 'out' else self.err
            limit = self.cap if key.data == 'out' else BUDGETS['stderrBytesMaximumPerClient']
            require(len(buf) + len(data) <= limit, 'ACQUISITION_SIZE_LIMIT')
            buf.extend(data)

    def send(self, raw):
        self.guard()
        require(type(raw) is bytes and len(raw) <= 65536, 'ACQUISITION_QUERY_FAILED')
        try:
            view=memoryview(raw)
            while view:
                self.guard()
                require(time.monotonic()<self.deadline, 'ACQUISITION_TIMEOUT')
                try:
                    n=os.write(self.proc.stdin.fileno(),view)
                    require(n>0, 'ACQUISITION_QUERY_FAILED')
                    view=view[n:]
                except BlockingIOError:
                    select.select([], [self.proc.stdin.fileno()], [], .1)
        except (BrokenPipeError, OSError):
            raise Failure('ACQUISITION_FAILED', 'ACQUISITION_QUERY_FAILED') from None

    def exchange(self, raw):
        marker = ('UPLY_PA_' + uuid.uuid4().hex).encode()
        self.send(raw + b'\n\\echo ' + marker + b'\n')
        while True:
            end = self.out.find(marker + b'\n')
            if end >= 0:
                require(end == 0 or self.out[end-1] == 10, 'ACQUISITION_QUERY_SHAPE')
                reply = bytes(self.out[:end]); del self.out[:end+len(marker)+1]
                return reply
            require(bool(self.selector.get_map()), 'ACQUISITION_QUERY_FAILED')
            self.pump()

    def finish(self):
        if not self.proc.stdin.closed:
            self.proc.stdin.close()
        while self.selector.get_map():
            self.pump()
        require(time.monotonic() < self.deadline, 'ACQUISITION_TIMEOUT')
        return self.proc.wait(timeout=max(.01, self.deadline-time.monotonic())), bytes(self.out), bytes(self.err)

    def close(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.proc.kill(); self.proc.wait(timeout=2)
        self.selector.close()
        for s in (self.proc.stdin, self.proc.stdout, self.proc.stderr):
            if not s.closed:
                s.close()


def _bounded_command(argv, seconds=15, cap=1048576):
    p = _Process(argv, time.monotonic()+seconds, cap)
    try:
        return p.finish()
    finally:
        p.close()


class _Run:
    def __init__(self, ctx, approval_id, approval_sha, plan=None):
        require(type(approval_id) is str and HEX32.fullmatch(approval_id) and
                type(approval_sha) is str and HEX64.fullmatch(approval_sha))
        self.ctx, self.plan = ctx, plan
        ctx.check()
        self.artifact_lock,self.artifact_lock_raw=load_artifact_lock()
        self.aux_parents={}
        self.phase = 'PRECHECK'; self.lock_fd = None; self.consumed_ref = None
        self.auth_path = ctx.root / 'approvals' / (approval_id+'.json')
        self.human_path = ctx.root / 'approvals' / (approval_id+'.human.json')
        if ctx.fixture:
            # Separate local-only eligibility record, never admissible production authority.
            local = private_read(ctx.root/'fixture-eligibility.json')
            require(strict_json(local) == {'fixture':True,'scope':TEST_SCOPE,'designSha256':DESIGN_SHA,
                    'acquisitionSourceHashes':closure(),'validationContextHashes':context_hashes(),
                    'forwardDesignSha256':FORWARD_DESIGN_SHA,'sessionDesignSha256':SESSION_DESIGN_SHA,'transportKind':ctx.transport_kind,
                    'acquisitionProfileSha256':DIRECT_PROFILE_SHA if ctx.transport_kind=='DIRECT' else SESSION_PROFILE_SHA,
                    'transportPolicySha256':DIRECT_TRANSPORT_SHA if ctx.transport_kind=='DIRECT' else SESSION_TRANSPORT_SHA}, 'ACQUISITION_AUTHORITY_INVALID')
            self.eligible_sha = sha(local)
        else:
            self.eligible_sha = eligibility(plan)
        self.auth_raw = private_read(self.auth_path, 1048576)
        self.human_raw = private_read(self.human_path, 1048576)
        require(sha(self.auth_raw) == approval_sha)
        self.auth = strict_json(self.auth_raw); self.human = strict_json(self.human_raw)
        require(self.auth.get('approvalId') == approval_id)
        validate_authorization(self.auth, self.human, sha(self.human_raw), ctx, self.eligible_sha, plan)
        self.id = self.auth['acquisitionId']; self.auth_sha = approval_sha
        self.attempt = ctx.root/'acquisitions'/self.id
        require(not os.path.lexists(self.attempt), 'ACQUISITION_REPLAY')
        self.start = time.time(); self.mono = time.monotonic()
        self.deadline = self.mono + min(600, self.auth['expiresAt']-self.start)
        self.counter = {k:0 for k in COUNTERS}
        for k in ['toolInternalSQLStatements','physicalServerConnections']:
            self.counter[k] = 'NOT_OBSERVABLE'
        self.names = set(); self.owner_tokens = {}; self.processes = []; self.records = {}; self.dispatches = []
        self.responses_size = 0; self.endpoint = None; self.credential_sha = None

    def time_guard(self):
        now = time.time(); elapsed = time.monotonic()-self.mono
        require(self.auth['notBefore'] <= now < self.auth['expiresAt'] and
                now >= self.start + elapsed - 2 and time.monotonic() < self.deadline, 'ACQUISITION_AUTH_EXPIRED')

    def guard(self, credentials=False):
        self.time_guard()
        require(private_read(self.auth_path,1048576) == self.auth_raw and
                private_read(self.human_path,1048576) == self.human_raw, 'ACQUISITION_AUTH_INVALID')
        require(sha(safe_file(DESIGN_PATH)) == DESIGN_SHA and pc.package_hashes() == self.auth['bindings']['operationalLineage']['operationalPackageHashes'] and
                closure() == self.auth['bindings']['acquisitionSourceHashes'] and
                context_hashes() == self.auth['bindings']['validationContextHashes'], 'ACQUISITION_SOURCE_DRIFT')
        validate_bindings(self.auth, fixture=self.ctx.fixture)
        require(sha(safe_file(FORWARD_DESIGN_PATH))==FORWARD_DESIGN_SHA and sha(safe_file(SESSION_DESIGN_PATH))==SESSION_DESIGN_SHA and
                load_artifact_lock()[1]==self.artifact_lock_raw,'ACQUISITION_SOURCE_DRIFT')
        if not self.ctx.fixture:
            require(eligibility(self.plan) == self.eligible_sha, 'ACQUISITION_AUTHORITY_INVALID')
            pc.risk_guard(self.plan, {'transportRiskAcceptance':self.auth['bindings']['operationalLineage']['transportRiskAcceptance']})
            self.runtime_guard()
        if credentials:
            self.credentials()
            if self.ctx.fixture:
                self.fixture_guard()

    def fixture_guard(self):
        rc,raw,_=self.docker(['network','inspect',self.ctx.network])
        require(rc==0,'ACQUISITION_TARGET_MISMATCH')
        network=strict_json(raw)
        require(type(network) is list and len(network)==1 and network[0]['Internal'] is True and
                network[0]['Name']==self.ctx.network and
                (network[0].get('Labels') or {}).get('uply.provenance-test')==self.ctx.fixture_label, 'ACQUISITION_TARGET_MISMATCH')
        rc,raw,_=self.docker(['container','inspect',self.endpoint['host']])
        require(rc==0,'ACQUISITION_TARGET_MISMATCH')
        source=strict_json(raw)
        require(type(source) is list and len(source)==1,'ACQUISITION_TARGET_MISMATCH')
        source=source[0]
        require(source['Image']==(OWNED_SESSION_POOLER_IMAGE if self.ctx.transport_kind=='SESSION' else IMAGE) and source['HostConfig']['NetworkMode']==self.ctx.network and
                not source['HostConfig'].get('Binds') and not any((source['HostConfig'].get('PortBindings') or {}).values()) and
                (source['Config'].get('Labels') or {}).get('uply.provenance-test')==self.ctx.fixture_label, 'ACQUISITION_TARGET_MISMATCH')
        if self.ctx.transport_kind=='SESSION':
            host=source['HostConfig'];cid=source.get('Id');tmpfs=host.get('Tmpfs') or {}
            require(type(cid) is str and HEX64.fullmatch(cid) and source.get('Name')=='/'+self.endpoint['host'] and
                    type(host.get('Memory')) is int and host['Memory']==OWNED_SESSION_POOLER_MEMORY_BYTES and
                    host.get('ReadonlyRootfs') is True and set(tmpfs)=={'/tmp','/lab'} and
                    tmpfs=={'/tmp':'rw,mode=1777,size=268435456','/lab':'rw,mode=0700,uid=65534,gid=65534,size=1048576'} and
                    source['Config'].get('User')=='65534:65534' and
                    set((source.get('NetworkSettings') or {}).get('Networks') or {})=={self.ctx.network}, 'ACQUISITION_TARGET_MISMATCH')
            mounts=source.get('Mounts') or []
            require(type(mounts) is list and len(mounts)==2 and
                    {m.get('Destination') for m in mounts}=={'/tmp','/lab'} and
                    all(m.get('Type')=='tmpfs' for m in mounts),'ACQUISITION_TARGET_MISMATCH')
            # Private synthetic route input only. This is not an upstream TLS observation.
            rc,route,_=self.docker(['exec','--user','65534:65534',cid,'/bin/cat','/lab/input.json'])
            require(rc==0 and 0<len(route)<=1048576 and sha(route)==self.ctx.fixture_pooler_input_sha256,'ACQUISITION_TARGET_MISMATCH')


    def runtime_guard(self):
        p = self.ctx.profile
        raw = safe_file(Path(p['runtimePath']), True)
        require(sha(raw) == p['runtimeSha256'] and sha(safe_file(Path(p['launcherPath']),True)) == p['launcherSha256'] and
                safe_file(Path(p['buildPath'])).decode().strip() == p['buildId'], 'ACQUISITION_RUNTIME_BOUNDARY')
        runtime = strict_json(raw)
        require(runtime.get('TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED') in (None,False,'0','false','') and
                all(runtime.get(k) in (None,'',[]) for k in ['TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS']), 'ACQUISITION_RUNTIME_BOUNDARY')
        try:
            project = runtime['NEXT_PUBLIC_SUPABASE_URL'].split('//')[1].split('.')[0]
            require(sha(canonical(project)) == p['projectIdentitySha256'], 'ACQUISITION_RUNTIME_BOUNDARY')
        except (KeyError,IndexError,TypeError):
            raise Failure('ACQUISITION_FAILED', 'ACQUISITION_RUNTIME_BOUNDARY') from None

    def consume(self):
        self.phase = 'CLAIM'
        lock_root = self.ctx.root if self.ctx.fixture else self.ctx.root.parent / 'source-bootstrap-provenance'
        d = _private_dir(lock_root, create=True)
        try:
            self.lock_fd = os.open('acquisition.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600, dir_fd=d)
            s = os.fstat(self.lock_fd)
            require(stat.S_ISREG(s.st_mode) and s.st_uid == os.getuid() and s.st_nlink == 1 and stat.S_IMODE(s.st_mode) == 0o600, 'ACQUISITION_FILE_IDENTITY')
            os.fsync(self.lock_fd); os.fsync(d)
            try:
                fcntl.flock(self.lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Failure('ACQUISITION_FAILED', 'ACQUISITION_BUSY') from None
        finally:
            os.close(d)
        self.guard()
        refs = []
        claims = [('approvalId',self.auth['approvalId']),('authorizationSha256',self.auth_sha),
                  ('nonceSha256',sha(self.auth['nonce'].encode())),('acquisitionId',self.id)]
        claim_roots = [self.ctx.root] if self.ctx.fixture else [self.ctx.root.parent/name for name in SESSION_DESIGN['sessionProfilePolicies']['claimCollisionRoots']]
        require(not any(os.path.lexists(root/'claims'/k/(v+'.json')) for root in claim_roots for k,v in claims), 'ACQUISITION_REPLAY')
        require(not any(os.path.lexists(root/folder/(self.id + ('.json' if folder != 'acquisitions' else '')))
                        for root in claim_roots for folder in ('consumed', 'terminal', 'acquisitions')), 'ACQUISITION_REPLAY')
        for kind, key in claims:
            path = self.ctx.root/'claims'/kind/(key+'.json')
            value = obj('source-provenance-claim/1', claimKind=kind, claimKey=key, acquisitionId=self.id,
                        authorizationSha256=self.auth_sha, claimedAt=time.time())
            ref = write_json(path, value); ref['path'] = str(path.relative_to(self.ctx.root)); refs.append(ref)
        self.phase = 'CONSUME'
        value = obj('source-provenance-consumed/1', acquisitionId=self.id, authorizationSha256=self.auth_sha,
                    humanApprovalSha256=sha(self.human_raw), claimRefs=refs, consumedAt=time.time(),
                    acquisitionSourceDigest=self.auth['bindings']['acquisitionSourceDigest'], scope=self.auth['scope'])
        self.consumed_ref = write_json(self.ctx.root/'consumed'/(self.id+'.json'), value)
        d = _private_dir(self.attempt, create=True); os.close(d)

    def credentials(self):
        require(self.consumed_ref is not None, 'ACQUISITION_AUTH_INVALID')
        raw = {}
        for key in ['pg_service.conf','pgpass','root.crt']:
            raw[key]=private_read(self.ctx.credentials/key,1048576)
            self.counter['credentialFilesRead'] += 1
        wanted = self.auth['bindings']['credentialFileHashes']
        require({k:sha(v) for k,v in raw.items()} == wanted, 'ACQUISITION_CREDENTIAL_BINDING')
        try:
            c = configparser.ConfigParser(interpolation=None, strict=True); c.read_string(raw['pg_service.conf'].decode())
            require(set(c.sections()) == {'uply'} and not c.defaults(), 'ACQUISITION_CREDENTIAL_BINDING')
            s = c['uply']; host, user = s['host'], s['user']
            require(set(s) == {'host','port','dbname','user','sslmode','sslrootcert','passfile','connect_timeout'} and
                    s['port'] == '5432' and s['dbname'] == 'postgres' and s['sslmode'] == 'verify-full' and
                    s['sslrootcert'] == '/connection/root.crt' and s['passfile'] == '/connection/pgpass' and
                    s['connect_timeout'] == '15' and (self.ctx.transport_kind=='SESSION' or user=='postgres'), 'ACQUISITION_CREDENTIAL_BINDING')
            if self.ctx.transport_kind=='SESSION':validate_session_host(host,user,self.ctx.target,fixture=self.ctx.fixture)
            else:validate_direct_host(host,self.ctx.target,fixture=self.ctx.fixture)
            self.endpoint = {'host':host,'user':user,'port':5432}
        except (KeyError,ValueError,UnicodeError,configparser.Error):
            raise Failure('ACQUISITION_FAILED','ACQUISITION_CREDENTIAL_BINDING') from None
        self.credential_sha = sha(canonical(wanted))

    def docker(self, args, seconds=15):
        self.counter['DockerInvocations'] += 1
        return _bounded_command(['docker',*args], seconds)

    def image_preflight(self):
        owned_session = self.ctx.fixture is True and self.ctx.transport_kind=='SESSION'
        stock_memory_args = ['--memory',str(OWNED_SESSION_STOCK_CLIENT_MEMORY_BYTES)] if owned_session else []
        roles_memory_args = ['--memory',str(OWNED_SESSION_ROLES_RUNTIME_MEMORY_BYTES)] if owned_session else []
        rc, out, _ = self.docker(['image','inspect',IMAGE,'--format','{{.Id}}'])
        require(rc == 0 and out.decode().strip() == IMAGE, 'ACQUISITION_IMAGE_UNAVAILABLE')
        name = 'uply-provenance-'+self.id+'-version'; self.names.add(name)
        self.owner_tokens[name]=uuid.uuid4().hex
        rc, out, _ = self.docker(['run','--rm','--name',name,'--label','uply.provenance-acquisition='+self.id,
            '--label','uply.provenance-owner='+self.owner_tokens[name],'--pull=never','--read-only','--cap-drop=ALL',
            '--security-opt=no-new-privileges',*stock_memory_args,'--network','none','--entrypoint','/bin/sh',IMAGE,
            '-c','psql --version && pg_dumpall --version && pg_dump --version'])
        require(rc == 0 and len(out.decode().splitlines()) == 3 and all(re.fullmatch(
            r'(?:psql|pg_dumpall|pg_dump) \(PostgreSQL\) 17\.6(?: .*)?',s) for s in out.decode().splitlines()), 'ACQUISITION_CLIENT_VERSION')

        if self.ctx.transport_kind=='SESSION':
            outputs=self.artifact_lock['outputs'];image=outputs['runtimeImageId']
            rc,out,_=self.docker(['image','inspect',image,'--format','{{.Id}} {{.Os}} {{.Architecture}}'])
            require(rc==0 and out.decode().strip()==image+' linux amd64','ACQUISITION_IMAGE_UNAVAILABLE')
            files=[outputs[k] for k in ('exporter','companion','launcher','libpq')]
            files += [{'path':_runtime_dependency_path(r['name']),'bytes':r['bytes'],'sha256':r['sha256']} for r in outputs['runtimeDependencies']]
            # All path/name/digest operands were admitted by fixed closed lock schemas.
            commands=[]
            for item in files:
                path=item['path']
                require((path=='/lib64/ld-linux-x86-64.so.2' or re.fullmatch(r'/opt/teaching-agent/roles-exporter/pg17[.]6-v1/(?:bin|lib)/[A-Za-z0-9_.+-]+',path)) and
                        '..' not in Path(path).parts,'ACQUISITION_IMAGE_UNAVAILABLE')
                commands += ["test $(/usr/bin/stat -Lc %s '"+path+"') = "+str(item['bytes']),
                             "test $(/usr/bin/sha256sum '"+path+"' | /usr/bin/cut -d ' ' -f1) = "+item['sha256']]
            for key in ('exporter','companion','launcher'):
                commands.append("LD_LIBRARY_PATH='"+EXPORTER_PREFIX+"/lib' /usr/bin/ldd '"+outputs[key]['path']+"'")
            for dependency in outputs['runtimeDependencies']:
                path=_runtime_dependency_path(dependency['name'])
                commands += ["printf '\\nUPLY_RUNTIME_FILE="+dependency['name']+"\\n'",
                             "/usr/bin/readlink -f '"+path+"'", "/usr/bin/stat -Lc %s '"+path+"'",
                             "/usr/bin/sha256sum '"+path+"'"]
            name='uply-provenance-'+self.id+'-exporter-package';self.names.add(name);self.owner_tokens[name]=uuid.uuid4().hex
            rc,out,_=self.docker(['run','--rm','--name',name,'--label','uply.provenance-acquisition='+self.id,
                '--label','uply.provenance-owner='+self.owner_tokens[name],'--pull=never','--read-only','--cap-drop=ALL',
                '--security-opt=no-new-privileges','--user',str(os.geteuid())+':'+str(os.getegid()),*roles_memory_args,'--network','none',
                '--entrypoint','/bin/sh',image,'-ec','; '.join(commands)])
            require(rc==0,'ACQUISITION_IMAGE_UNAVAILABLE')
            loaded,actual_files=parse_runtime_loader_inspection(out)
            validate_runtime_loader_binding(outputs,loaded,actual_files)

    def argv(self, kind, invocation_id):
        require(kind in ('PRE','ROLES','POST') and self.endpoint is not None,'ACQUISITION_SCOPE_MISMATCH')
        session=self.ctx.transport_kind=='SESSION';e=self.endpoint;tag=application_name(kind,invocation_id)
        memory_bytes = OWNED_SESSION_ROLES_RUNTIME_MEMORY_BYTES if kind=='ROLES' else OWNED_SESSION_STOCK_CLIENT_MEMORY_BYTES
        memory_args = ['--memory',str(memory_bytes)] if self.ctx.fixture is True and session else []
        if session:validate_session_host(e['host'],e['user'],self.ctx.target,fixture=self.ctx.fixture)
        else:
            validate_direct_host(e['host'],self.ctx.target,fixture=self.ctx.fixture)
            require(e['user']=='postgres','ACQUISITION_CREDENTIAL_BINDING')
        require(e['port']==5432,'ACQUISITION_CREDENTIAL_BINDING')
        values=[('host',e['host']),('port','5432'),('dbname','postgres'),('user',e['user']),('sslmode','verify-full'),
                ('sslrootcert','/connection/root.crt'),('passfile','/connection/pgpass'),('gssencmode','disable'),
                ('connect_timeout','15'),('application_name',tag)]
        if session:values += [('client_encoding','UTF8'),('sslnegotiation','postgres')]
        conn=' '.join(k+"='"+v+"'" for k,v in values)
        name='uply-provenance-'+self.id+'-'+kind.lower();self.owner_tokens.setdefault(name,uuid.uuid4().hex)
        base=['docker','run','--rm','-i','--name',name,'--label','uply.provenance-acquisition='+self.id,
              '--label','uply.provenance-owner='+self.owner_tokens[name],'--pull=never','--read-only','--cap-drop=ALL',
              '--security-opt=no-new-privileges','--user',str(os.geteuid())+':'+str(os.getegid()),*memory_args,'--network',self.ctx.network]
        if session and kind=='ROLES':
            require(os.geteuid()!=0,'ACQUISITION_FILE_IDENTITY')
            path=self.ctx.root/'proof-staging'/self.id/invocation_id
            base += ['--mount','type=bind,src='+str(self.ctx.credentials)+',dst=/connection,readonly',
                     '--mount','type=bind,src='+str(path)+',dst=/proof','--env-file',str(path/'producer.env'),
                     '--entrypoint',EXPORTER_PREFIX+'/entrypoint-v1.sh',self.artifact_lock['outputs']['runtimeImageId']]
            return name,base+['--no-password','-d',conn,'-l','postgres','--roles-only','--no-role-passwords']
        base += ['-v',str(self.ctx.credentials)+':/connection:ro']
        env=DESIGN['transportContract']['envPolicy']
        for key in ['LC_ALL','PGSERVICEFILE','PGPASSFILE','PGSSLMODE','PGSSLROOTCERT','PGGSSENCMODE','PGOPTIONS']:
            base += ['-e',key+'='+env[key]]
        if session:base += ['-e','PGCLIENTENCODING=UTF8']
        base += ['--entrypoint','/usr/bin/env',IMAGE,'-u','PGSERVICE','-u','PGHOSTADDR','-u','PGPASSWORD']
        actual=(['pg_dumpall','--no-password','-d',conn,'-l','postgres','--roles-only','--no-role-passwords'] if kind=='ROLES'
                else ['psql','-XqAt','-w','-d',conn,'-v','ON_ERROR_STOP=on'])
        return name,base+actual

    def environment_policy_sha(self,kind):
        policy=(SESSION_DESIGN['runtimeEnvironment'] if self.ctx.transport_kind=='SESSION' and kind=='ROLES'
                else DESIGN['transportContract']['envPolicy'])
        return sha(canonical(policy))

    def producer_bindings(self,dispatch,ref):
        return dict(acquisitionId=self.id,invocationId=dispatch['invocationId'],dispatchSha256=ref['sha256'],
                    artifactLockSha256=sha(self.artifact_lock_raw),sourceTargetId=self.auth['bindings']['acquisitionIntent']['sourceTargetId'],
                    rolesGateRegistrySha256=ROLES_REGISTRY_SHA,argvSha256=dispatch['argvSha256'])

    def dispatch(self, kind):
        self.phase=kind;self.guard(credentials=True)
        require(len(self.dispatches)<3 and kind==['PRE','ROLES','POST'][len(self.dispatches)],'ACQUISITION_REPLAY')
        invocation=uuid.uuid4().hex;name,argv=self.argv(kind,invocation)
        if self.ctx.transport_kind=='SESSION' and kind=='ROLES':
            path,fd=_aux_parent(self.ctx.root,self.id,invocation,create=True)
            self.aux_parents[invocation]=fd
        value=obj('source-provenance-dispatch/1',acquisitionId=self.id,authorizationSha256=self.auth_sha,
                  consumedSha256=self.consumed_ref['sha256'],sequence=len(self.dispatches)+1,invocationId=invocation,kind=kind,
                  issuedAt=time.time(),argvSha256=sha(canonical(argv)),queryIds=PRE_ORDER if kind=='PRE' else POST_ORDER if kind=='POST' else [],
                  environmentPolicySha256=self.environment_policy_sha(kind))
        ref=write_json(self.ctx.root/'dispatches'/self.id/(f'{len(self.dispatches)+1:02d}-'+kind.lower()+'.json'),value)
        self.dispatches.append(value);self.names.add(name)
        if self.ctx.transport_kind=='SESSION' and kind=='ROLES':
            bindings=self.producer_bindings(value,ref);env=producer_environment(bindings)
            _write_producer_environment(self.aux_parents[invocation],env)
            actual,_=read_auxiliary_staging(self.ctx.root,self.id,invocation,'producer.env',held_parent_fd=self.aux_parents[invocation])
            parse_producer_environment(actual,bindings)
        self.counter['rolesToolInvocationAttempts' if kind=='ROLES' else 'measurementSessionAttempts']+=1
        self.counter['productionClientInvocations']+=0 if self.ctx.fixture else 1
        self.counter['DockerInvocations']+=1
        started=time.time();proc=_Process(argv,min(self.deadline,time.monotonic()+90) if kind=='ROLES' else self.deadline,
                    BUDGETS['rolesBytesMaximum'] if kind=='ROLES' else BUDGETS['queryResponseBytesMaximum'],self.time_guard)
        self.processes.append(proc)
        return proc,value,ref,started

    def proof(self, kind, dispatch, ref, started, rc, err, output, tls, backend, query_bindings, roles_proof=None):
        self.guard(credentials=True);session=self.ctx.transport_kind=='SESSION'
        require(type(rc) is int and rc==0 and len(err)<=1048576,'ACQUISITION_QUERY_FAILED')
        fields=dict(transportKind=self.ctx.transport_kind,acquisitionId=self.id,authorizationSha256=self.auth_sha,
            dispatchSha256=ref['sha256'],invocationId=dispatch['invocationId'],kind=kind,fixture=self.ctx.fixture,
            sourceTargetId=self.auth['bindings']['acquisitionIntent']['sourceTargetId'],targetProfile=self.ctx.target['targetProfile'],
            acquisitionSourceDigest=self.auth['bindings']['acquisitionSourceDigest'],operationalPackageDigest=PACKAGE_DIGEST,
            queryRegistrySha256=QUERY_SHA,toolImageId=self.artifact_lock['outputs']['runtimeImageId'] if session and kind=='ROLES' else IMAGE,
            tool='PG176_SESSION_READONLY_ROLES_EXPORTER' if session and kind=='ROLES' else 'pg_dumpall' if kind=='ROLES' else 'psql',
            clientVersion='17.6',startedAt=started,completedAt=time.time(),returnCode=rc,argvSha256=dispatch['argvSha256'],
            credentialIdentitySha256=self.credential_sha,caIdentitySha256=self.auth['bindings']['caIdentitySha256'],sslmode='verify-full',gssencmode='disable',
            proofKind='ACTUAL_OWN_PGCONN_INIT_GATE_PRIVATE_RECEIPT' if session and kind=='ROLES' else 'REAL_INVOCATION_LIBPQ_ENFORCEMENT' if kind=='ROLES' else 'PSQL_SAME_SESSION_METADATA',
            clientTlsObservation=tls,backendObservedSsl=backend,outputSha256=sha(output),outputBytes=len(output),stderrSha256=sha(err),
            truncated=False,profileInputBindings=query_bindings,acquisitionProfileSha256=SESSION_PROFILE_SHA if session else DIRECT_PROFILE_SHA,
            transportPolicySha256=SESSION_TRANSPORT_SHA if session else DIRECT_TRANSPORT_SHA,
            acquisitionIntentSha256=self.auth['bindings']['acquisitionIntentSha256'],applicationName=application_name(kind,dispatch['invocationId']),
            readOnlyEnforcement='OWN_PGCONN_THREE_SET_MEASURE_BEFORE_CATALOG' if session and kind=='ROLES' else
                                'OWN_SESSION_SET_BEFORE_BEGIN_AND_SAME_SESSION_MEASUREMENT' if session else 'FIXED_LIBPQ_OPTIONS_ON_EVERY_CONNECTION')
        if roles_proof is not None:fields['rolesExporterProof']=roles_proof
        value=obj('source-provenance-client-proof/3',**fields)
        self.records[kind]={'proof':value,'canonicalProofSha256':sha(canonical(value))}
        return value

    def roles(self):
        proc,dispatch,ref,started=self.dispatch('ROLES');rc,raw,err=proc.finish()
        require(rc==0 and 0<len(raw)<=BUDGETS['rolesBytesMaximum'],'ACQUISITION_ROLE_EXPORT_FAILED')
        if self.ctx.transport_kind=='SESSION':
            iid=dispatch['invocationId'];fd=self.aux_parents[iid];bindings=self.producer_bindings(dispatch,ref)
            env,envref=read_auxiliary_staging(self.ctx.root,self.id,iid,'producer.env',held_parent_fd=fd)
            parse_producer_environment(env,bindings)
            receipt_raw,receiptref=read_auxiliary_staging(self.ctx.root,self.id,iid,'readonly.json',held_parent_fd=fd)
            receipt=validate_producer_receipt(receipt_raw,bindings);tls=receipt['frontendTls']
            extra=dict(contract='source-provenance-roles-exporter-proof/1',schemaVersion=1,
                componentName='PG176_SESSION_READONLY_ROLES_EXPORTER',componentVersion=1,artifactLockRawSha256=sha(self.artifact_lock_raw),
                runtimeImageId=self.artifact_lock['outputs']['runtimeImageId'],sourceTargetId=bindings['sourceTargetId'],
                dispatchRawSha256=ref['sha256'],argvSha256=dispatch['argvSha256'],environmentPolicySha256=dispatch['environmentPolicySha256'],
                producerEnvironmentRef=envref,producerEnvironmentRawSha256=sha(env),measurementReceiptRef=receiptref,
                measurementReceiptRawSha256=sha(receipt_raw),measurementReceiptCanonicalSha256=sha(canonical(receipt)),measurementReceipt=receipt,
                returnCode=rc,rawRolesSha256=sha(raw),rawRolesBytes=len(raw),stderrSha256=sha(err),stderrBytes=len(err),truncated=False,
                measurementPoint='AFTER_THREE_SESSION_SET_BEFORE_CATALOG',fullSessionReadOnlyMeasured=False,
                frontendTlsProofBoundary='ACTUAL_EXPORTER_PGCONN_CLIENT_TO_SESSION_POOLER',backendTlsObservation=None,
                backendTlsObservationStatus='NOT_OBSERVABLE_BY_FIXED_GATE',logicalPgconnObjects=1,controllerRetries=0,
                physicalConnectionAttempts=None,physicalConnectionAttemptsStatus='NOT_OBSERVABLE')
            schema_validate(extra,'RolesExporterProof')
            self.proof('ROLES',dispatch,ref,started,rc,err,raw,{'version':tls['protocol'],'cipher':tls['cipher']},'unavailable',{'rawRolesSha256':sha(raw)},extra)
        else:self.proof('ROLES',dispatch,ref,started,rc,err,raw,{'version':None,'cipher':None},'unavailable',{'rawRolesSha256':sha(raw)})
        durable(self.attempt/'roles.sql',raw)
        return raw

    def cleanup(self):
        good = True; unknown = False
        for proc in self.processes:
            try:
                proc.close()
            except (OSError,subprocess.TimeoutExpired):
                good = False
        remaining = 0
        for name in sorted(self.names):
            try:
                rc, out, _ = self.docker(['container','ls','-a','--filter','name=^/'+name+'$','--format','{{.Names}}'])
                require(rc == 0, 'ACQUISITION_CLEANUP_FAILED')
                require(out.decode().strip() in ('',name), 'ACQUISITION_CLEANUP_FAILED')
                if out.strip():
                    rc,raw,_=self.docker(['container','inspect',name])
                    require(rc==0,'ACQUISITION_CLEANUP_FAILED')
                    inspected=strict_json(raw)
                    require(type(inspected) is list and len(inspected)==1,'ACQUISITION_CLEANUP_FAILED')
                    labels=inspected[0]['Config'].get('Labels') or {}
                    if (labels.get('uply.provenance-acquisition')!=self.id or
                            labels.get('uply.provenance-owner')!=self.owner_tokens.get(name)):
                        # Name collision is not resource ownership. Never remove it.
                        good=False
                        continue
                    rc, _, _ = self.docker(['container','rm','-f',name])
                    require(rc == 0, 'ACQUISITION_CLEANUP_FAILED')
                    rc, out, _ = self.docker(['container','ls','-a','--filter','name=^/'+name+'$','--format','{{.Names}}'])
                    require(rc == 0 and not out.strip(), 'ACQUISITION_CLEANUP_FAILED')
            except (Failure,OSError,subprocess.TimeoutExpired,KeyError,TypeError,ValueError):
                good = False; unknown = True
        # Do not turn an unobservable cleanup into an invented numeric count.
        require(not unknown,'ACQUISITION_CLEANUP_FAILED')
        self.counter['ownedContainersRemaining'] = remaining
        return {'status':'PASS' if good else 'FAIL','ownedContainersRemaining':remaining}

    def unlock(self):
        for fd in self.aux_parents.values():os.close(fd)
        self.aux_parents.clear()
        if self.lock_fd is not None:
            os.close(self.lock_fd); self.lock_fd = None


class _ReadonlySession:
    def __init__(self, run, kind):
        self.run, self.kind = run, kind
        self.proc,self.dispatch,self.ref,self.started = run.dispatch(kind)
        self.responses=[]; self.tls=None; self.backend=None; self.closed=False
        controls = [x for x in DESIGN['transportContract']['readonlySessionControls'] if x.startswith(('SET ', 'BEGIN '))]
        if run.ctx.transport_kind=='SESSION':controls.insert(0,'SET SESSION default_transaction_read_only = on;')
        for sql in controls:
            run.counter['controllerControlStatements'] += 1
            require(not self.proc.exchange(sql.encode()).strip(), 'ACQUISITION_QUERY_SHAPE')

    def query(self, key):
        order = PRE_ORDER if self.kind == 'PRE' else POST_ORDER
        require(len(self.responses) < len(order) and key == order[len(self.responses)], 'ACQUISITION_SCOPE_MISMATCH')
        query = QUERIES[key]; start = time.time()
        self.run.guard(); self.run.counter['controllerSelectStatements'] += 1
        raw = self.proc.exchange(query.encode()).strip()
        value = strict_json(raw)
        encoded = canonical(value); self.run.responses_size += len(encoded)
        require(self.run.responses_size <= BUDGETS['aggregateCanonicalMetadataBytesMaximum'], 'ACQUISITION_SIZE_LIMIT')
        receipt = {'queryId':key,'querySha256':sha(query.encode()),'sequence':len(self.responses)+1,
                   'startedAt':start,'completedAt':time.time(),'canonicalResponse':value,'canonicalResponseSha256':sha(encoded),'sqlstate':'00000'}
        closed(receipt,'QueryReceipt'); self.responses.append(receipt)
        if key == 'sessionReadOnly':
            require(value == {'transactionReadOnly':'on','defaultTransactionReadOnly':'on','transactionIsolation':'repeatable read'}, 'ACQUISITION_READONLY_REQUIRED')
        if key == 'sessionIdentity':
            actual = dict(value, **{k:v for k,v in self.run.ctx.target.items() if k not in value})
            if self.run.ctx.transport_kind=='SESSION':validate_session_identity(value)
            else:validate_identity(actual,self.run.ctx.target)
            self.tls = _conninfo(self.proc.exchange(b'\\conninfo').decode().strip(), self.run.endpoint['host'],self.run.endpoint['user'])
        if key == 'backendTlsObservation':
            require(value is True, 'ACQUISITION_CLIENT_TLS')
            self.backend = 'unavailable' if value is None else value
        if key=='bootstrapIdentity':
            if self.run.ctx.transport_kind=='SESSION':validate_session_bootstrap(value)
            else:ba._identity(value)
        return value

    def measure(self):
        order = PRE_ORDER if self.kind == 'PRE' else POST_ORDER
        for key in order:
            if self.kind == 'PRE' and len(self.responses) == len(order)-1:
                source_profile(self.responses)
            self.query(key)
        initial = next(r['canonicalResponse'] for r in self.responses if r['queryId']=='bootstrapIdentity')
        last = [r['canonicalResponse'] for r in self.responses if r['queryId']=='bootstrapIdentity'][-1]
        require(canonical(initial) == canonical(last), 'ACQUISITION_SOURCE_DRIFT')
        source_profile(self.responses)
        row = last['bootstrapRows'][0]
        self.observation = obj('source-provenance-observation/1',acquisitionId=self.run.id,phase=self.kind,
            sourceTargetId=self.run.auth['bindings']['acquisitionIntent']['sourceTargetId'],invocationId=self.dispatch['invocationId'],
            queryRegistrySha256=QUERY_SHA,responses=self.responses,canonicalSnapshotSha256=sha(canonical(_raw_snapshot(self.responses))),
            bootstrapRawOid=row['bootstrapOid'],bootstrapRawOidType=type(row['bootstrapOid']).__name__,normalizedBootstrapOid=10,
            rawResponseAvailable=False,rawResponseSha256=None)
        write_json(self.run.attempt/(self.kind.lower()+'.json'),self.observation)
        return self.observation

    def close(self):
        if self.closed:
            return
        self.closed=True
        self.run.counter['controllerControlStatements'] += 1
        require(not self.proc.exchange(b'ROLLBACK;').strip(),'ACQUISITION_QUERY_SHAPE')
        self.proc.send(b'\\q\n')
        rc,out,err = self.proc.finish()
        require(rc == 0 and not out.strip(),'ACQUISITION_QUERY_FAILED')
        self.run.proof(self.kind,self.dispatch,self.ref,self.started,rc,err,canonical(self.responses),
                       {'version':self.tls['version'],'cipher':self.tls['cipher']},self.backend,
                       [{'queryId':r['queryId'],'querySha256':r['querySha256']} for r in self.responses])


def _validate_observation(obs, phase, target_id, acquisition_id):
    closed(obs,'source-provenance-observation/1')
    order = PRE_ORDER if phase=='PRE' else POST_ORDER
    require(obs['phase'] == phase and obs['acquisitionId'] == acquisition_id and obs['sourceTargetId'] == target_id and
            type(obs['invocationId']) is str and HEX32.fullmatch(obs['invocationId']) and obs['queryRegistrySha256'] == QUERY_SHA and
            obs['rawResponseAvailable'] is False and obs['rawResponseSha256'] is None and
            type(obs['normalizedBootstrapOid']) is int and obs['normalizedBootstrapOid'] == 10 and
            type(obs['responses']) is list and len(obs['responses']) == len(order), 'ACQUISITION_ARTIFACT_INVALID')
    previous = 0
    for i,(receipt,key) in enumerate(zip(obs['responses'],order)):
        closed(receipt,'QueryReceipt')
        require(receipt['queryId'] == key and receipt['querySha256'] == sha(QUERIES[key].encode()) and
                type(receipt['sequence']) is int and receipt['sequence'] == i+1 and receipt['sqlstate'] == '00000' and
                receipt['canonicalResponseSha256'] == sha(canonical(receipt['canonicalResponse'])) and
                moment(receipt['startedAt']) and moment(receipt['completedAt']) and
                previous <= receipt['startedAt'] <= receipt['completedAt'], 'ACQUISITION_ARTIFACT_INVALID')
        previous = receipt['completedAt']
    responses = obs['responses']; bootstraps = [r['canonicalResponse'] for r in responses if r['queryId']=='bootstrapIdentity']
    for b in bootstraps:
        ba._identity(b)
        require(canonical(b) == canonical(bootstraps[0]), 'ACQUISITION_SOURCE_DRIFT')
    raw_oid=bootstraps[0]['bootstrapRows'][0]['bootstrapOid']
    require(type(obs['bootstrapRawOid']) is type(raw_oid) and obs['bootstrapRawOid'] == raw_oid and
            obs['bootstrapRawOidType'] == type(raw_oid).__name__ and
            obs['canonicalSnapshotSha256'] == sha(canonical(_raw_snapshot(responses))), 'ACQUISITION_ARTIFACT_INVALID')
    require(responses[0]['canonicalResponse'] == {'transactionReadOnly':'on','defaultTransactionReadOnly':'on','transactionIsolation':'repeatable read'}, 'ACQUISITION_READONLY_REQUIRED')
    require(responses[2]['canonicalResponse'] is True, 'ACQUISITION_CLIENT_TLS')
    return source_profile(responses)


def profile_report(pre, post, raw):
    identity, values, env = _validate_observation(pre,'PRE',pre['sourceTargetId'],pre['acquisitionId'])
    after_identity,after_values,after_env = _validate_observation(post,'POST',pre['sourceTargetId'],pre['acquisitionId'])
    require(canonical(identity)==canonical(after_identity) and canonical(values)==canonical(after_values) and canonical(env)==canonical(after_env), 'ACQUISITION_SOURCE_DRIFT')
    # Full raw bootstrap measurements, not just normalized identity, must agree.
    bp = [r['canonicalResponse'] for r in pre['responses'] if r['queryId']=='bootstrapIdentity'][-1]
    ap = next(r['canonicalResponse'] for r in post['responses'] if r['queryId']=='bootstrapIdentity')
    require(canonical(bp)==canonical(ap),'ACQUISITION_SOURCE_DRIFT')
    catalog=values['sourceCatalogAndMigrationLedger']
    return obj('source-provenance-profile-review/1',acquisitionId=pre['acquisitionId'],
        recoveryCandidateName=ba.RECOVERY_CANDIDATE,recoveryCandidateVersion=4,sourceTargetId=pre['sourceTargetId'],
        preObservationSha256=sha(canonical(pre)+b'\n'),postObservationSha256=sha(canonical(post)+b'\n'),
        rawRolesSha256=sha(raw),rawRolesBytes=len(raw),identitySha256=sha(canonical(identity)),
        roleFamilySha256=sha(canonical(catalog['roles'])),membershipFamilySha256=sha(canonical(catalog['memberships'])),
        catalogSha256=sha(canonical(catalog)),prerequisitesSha256=sha(canonical({k:values[k] for k,q in ba._prerequisite_queries()})),
        globalRoleSettingsSha256=sha(canonical(values['globalRoleSettings'])),schemaEnvironmentSha256=sha(canonical(values['schemaEnvironment'])),
        localeSha256=sha(canonical(values['localeCatalog'])),rolesLexicalProfile=ba.ROLES_PROFILE,roleConfigProfile=ba.ROLE_CONFIG_PROFILE,
        extensionProfile=ba.EXTENSION_PROFILE,databaseAclProfile=ba.DATABASE_ACL_PROFILE,
        bootstrapCreatePrecheck=lexical_precheck(raw,identity),referencedSchemaEnvironment=env,profileAccepted=True,failureCodes=[])


def validate_payloads(pre,post,raw,bundle,review,auth,authorization_sha,fixture=False):
    """Pure current/3 joins; auxiliary bytes are independently reread by artifact reader."""
    target=validate_bindings(auth,fixture=fixture);b=auth['bindings'];aid=auth['acquisitionId'];target_sha=sha(canonical(target))
    session=b['transportKind']=='SESSION'
    require(type(fixture) is bool and fixture is (auth['scope']==TEST_SCOPE),'ACQUISITION_SCOPE_MISMATCH')
    for obs,phase in [(pre,'PRE'),(post,'POST')]:
        _validate_observation(obs,phase,target_sha,aid)
        actual=next(r['canonicalResponse'] for r in obs['responses'] if r['queryId']=='sessionIdentity')
        if session:
            validate_session_identity(actual)
            for r in obs['responses']:
                if r['queryId']=='bootstrapIdentity':validate_session_bootstrap(r['canonicalResponse'])
        else:validate_identity(dict(actual,**{k:v for k,v in target.items() if k not in actual}),target)
    expected=profile_report(pre,post,raw);closed(review,'source-provenance-profile-review/1')
    require(canonical(review)==canonical(expected),'ACQUISITION_ARTIFACT_INVALID')
    closed(bundle,'source-provenance-proof-bundle/3')
    require(bundle['acquisitionId']==aid and bundle['sourceTargetId']==target_sha and bundle['authorizationSha256']==authorization_sha,'ACQUISITION_CAPTURE_BINDING')
    invocations=set()
    for kind,record in bundle['records'].items():
        proof=closed(record['proof'],'source-provenance-client-proof/3')
        common={'kind':kind,'acquisitionId':aid,'authorizationSha256':authorization_sha,'sourceTargetId':target_sha,
                'targetProfile':target['targetProfile'],'fixture':fixture,'transportKind':b['transportKind'],
                'acquisitionSourceDigest':b['acquisitionSourceDigest'],'credentialIdentitySha256':b['credentialIdentitySha256'],
                'caIdentitySha256':b['caIdentitySha256'],'acquisitionIntentSha256':b['acquisitionIntentSha256']}
        require(record['canonicalProofSha256']==sha(canonical(proof)) and
                all(canonical(proof[k])==canonical(v) for k,v in common.items()),'ACQUISITION_CAPTURE_BINDING')
        require(proof['invocationId'] not in invocations and
                auth['notBefore']<=proof['startedAt']<=proof['completedAt']<=auth['expiresAt'] and
                proof['completedAt']-proof['startedAt']<=600 and proof['applicationName']==application_name(kind,proof['invocationId']), 'ACQUISITION_CAPTURE_BINDING')
        invocations.add(proof['invocationId'])
        if kind=='ROLES':
            require(proof['outputSha256']==sha(raw) and proof['outputBytes']==len(raw) and 0<len(raw)<=BUDGETS['rolesBytesMaximum'] and
                    proof['profileInputBindings']=={'rawRolesSha256':sha(raw)},'ACQUISITION_CAPTURE_BINDING')
            if session:
                extra=proof['rolesExporterProof'];schema_validate(extra,'RolesExporterProof')
                bindings=dict(acquisitionId=aid,invocationId=proof['invocationId'],dispatchSha256=proof['dispatchSha256'],
                    artifactLockSha256=b['exporterArtifactLockSha256'],sourceTargetId=target_sha,rolesGateRegistrySha256=ROLES_REGISTRY_SHA,argvSha256=proof['argvSha256'])
                rr=canonical(extra['measurementReceipt'])+b'\n';receipt=validate_producer_receipt(rr,bindings);env=producer_environment(bindings)
                equal=dict(artifactLockRawSha256=b['exporterArtifactLockSha256'],runtimeImageId=target['rolesRuntimeImageId'],sourceTargetId=target_sha,
                    dispatchRawSha256=proof['dispatchSha256'],argvSha256=proof['argvSha256'],environmentPolicySha256=sha(canonical(SESSION_DESIGN['runtimeEnvironment'])),
                    producerEnvironmentRawSha256=sha(env),measurementReceiptRawSha256=sha(rr),measurementReceiptCanonicalSha256=sha(canonical(receipt)),
                    rawRolesSha256=sha(raw),rawRolesBytes=len(raw),stderrSha256=proof['stderrSha256'])
                require(all(canonical(extra[k])==canonical(v) for k,v in equal.items()) and
                        proof['toolImageId']==target['rolesRuntimeImageId'] and proof['clientTlsObservation']=={'version':receipt['frontendTls']['protocol'],'cipher':receipt['frontendTls']['cipher']},'ACQUISITION_CAPTURE_BINDING')
                for key,name,content in [('producerEnvironmentRef','producer.env',env),('measurementReceiptRef','readonly.json',rr)]:
                    require(extra[key]=={'path':'proof-staging/'+aid+'/'+proof['invocationId']+'/'+name,'sha256':sha(content),'bytes':len(content)},'ACQUISITION_CAPTURE_BINDING')
        else:
            obs=pre if kind=='PRE' else post
            require(proof['invocationId']==obs['invocationId'] and proof['startedAt']<=obs['responses'][0]['startedAt'] and
                    proof['completedAt']>=obs['responses'][-1]['completedAt'] and
                    proof['outputSha256']==sha(canonical(obs['responses'])) and proof['outputBytes']==len(canonical(obs['responses'])), 'ACQUISITION_CAPTURE_BINDING')
    rp=bundle['records']['ROLES']['proof'];post_start=next(r['startedAt'] for r in post['responses'] if r['queryId']=='bootstrapIdentity')
    require(pre['responses'][-1]['completedAt']<=rp['startedAt']<=rp['completedAt']<=post_start,'ACQUISITION_CAPTURE_BINDING')
    return expected


def validate_artifacts(directory, auth_raw, *, fixture=False, require_terminal=True):
    """No Docker, DB, credentials or writes. Check the complete private success tree."""
    directory=Path(directory)
    require(type(auth_raw) is bytes, 'ACQUISITION_ARTIFACT_INVALID')
    auth=closed(strict_json(auth_raw),'source-provenance-authorization/3')
    validate_bindings(auth, fixture=fixture)
    auth_sha=sha(auth_raw)
    require(auth['bindings']['acquisitionSourceHashes']==closure() and
            auth['bindings']['validationContextHashes']==context_hashes(),'ACQUISITION_SOURCE_DRIFT')
    d=_private_dir(directory);os.close(d)
    require(set(p.name for p in directory.iterdir())==set(PAYLOADS)|{'acquisition.json'},'ACQUISITION_ARTIFACT_INVALID')
    raw={name:private_read(directory/name) for name in [*PAYLOADS,'acquisition.json']}
    report=closed(strict_json(raw['acquisition.json']),'source-provenance-acquisition/1')
    require(report['status']==SUCCESS and report['acquisitionId']==auth['acquisitionId'] and
            report['authorizationSha256']==auth_sha and report['humanApprovalSha256']==auth['humanApprovalSha256'] and
            report['acquisitionSourceDigest']==auth['bindings']['acquisitionSourceDigest'] and
            report['operationalPackageDigest']==PACKAGE_DIGEST and report['queryRegistrySha256']==QUERY_SHA and
            report['sourceTargetId']==auth['bindings']['acquisitionIntent']['sourceTargetId'] and report['recoveryCandidateName']==ba.RECOVERY_CANDIDATE and
            type(report['recoveryCandidateVersion']) is int and report['recoveryCandidateVersion']==4 and
            report['productionAdoptionReady'] is False and report['backupAuthorized'] is False and report['restoreAuthorized'] is False and
            report['failurePhase'] is None and report['failureCode'] is None and
            canonical(report['cleanup'])==canonical({'status':'PASS','ownedContainersRemaining':0}) and
            moment(report['startedAt']) and moment(report['completedAt']) and
            auth['notBefore']<=report['startedAt']<=report['completedAt']<=auth['expiresAt'] and
            report['completedAt']-report['startedAt']<=600, 'ACQUISITION_ARTIFACT_INVALID')
    require(type(report['consumedSha256']) is str and HEX64.fullmatch(report['consumedSha256']),'ACQUISITION_ARTIFACT_INVALID')
    expected={name:{'sha256':sha(raw[name]),'bytes':len(raw[name])} for name in PAYLOADS}
    require(canonical(report['files'])==canonical(expected),'ACQUISITION_ARTIFACT_INVALID')
    counters=report['observedCounters']
    validate_observed_counters(counters)
    for key,value in {'measurementSessionAttempts':2,'rolesToolInvocationAttempts':1,'productionClientInvocations':0 if fixture else 3,
                      'controllerSelectStatements':27,'DockerPulls':0,'clustersCreated':0,'destinationClusters':0,
                      'fullDumpInvocations':0,'schemaDumpInvocations':0,'pgRestoreInvocations':0,'automaticRetries':0,'ownedContainersRemaining':0}.items():
        require(counters[key]==value,'ACQUISITION_ARTIFACT_INVALID')
    bundle=strict_json(raw['transport-proofs.json'])
    validate_payloads(strict_json(raw['pre.json']),strict_json(raw['post.json']),raw['roles.sql'],
                      bundle,strict_json(raw['profile-review.json']),auth,auth_sha,fixture)
    root=directory.parent.parent
    require(directory.parent.name=='acquisitions' and directory.name==auth['acquisitionId'], 'ACQUISITION_ARTIFACT_INVALID')
    consumed_raw=private_read(root/'consumed'/(auth['acquisitionId']+'.json'))
    consumed=closed(strict_json(consumed_raw),'source-provenance-consumed/1')
    require(sha(consumed_raw)==report['consumedSha256'] and consumed['acquisitionId']==auth['acquisitionId'] and
            consumed['authorizationSha256']==auth_sha and consumed['humanApprovalSha256']==auth['humanApprovalSha256'] and
            consumed['scope']==auth['scope'] and consumed['acquisitionSourceDigest']==auth['bindings']['acquisitionSourceDigest'] and
            moment(consumed['consumedAt']), 'ACQUISITION_CAPTURE_BINDING')
    human_raw = private_read(root/'approvals'/(auth['approvalId']+'.human.json'))
    human = strict_json(human_raw)
    _validate_approval_pair(auth, human, sha(human_raw), fixture=fixture)
    require(private_read(root/'approvals'/(auth['approvalId']+'.json'))==auth_raw, 'ACQUISITION_CAPTURE_BINDING')
    expected_claims=[('approvalId',auth['approvalId']),('authorizationSha256',auth_sha),
                     ('nonceSha256',sha(auth['nonce'].encode())),('acquisitionId',auth['acquisitionId'])]
    require(type(consumed['claimRefs']) is list and len(consumed['claimRefs'])==4, 'ACQUISITION_CAPTURE_BINDING')
    for ref,(kind,key) in zip(consumed['claimRefs'],expected_claims):
        path='claims/'+kind+'/'+key+'.json'
        require(type(ref) is dict and set(ref)=={'path','sha256','bytes'} and ref['path']==path, 'ACQUISITION_CAPTURE_BINDING')
        claim_raw=private_read(root/path);claim=closed(strict_json(claim_raw),'source-provenance-claim/1')
        require(sha(claim_raw)==ref['sha256'] and type(ref['bytes']) is int and len(claim_raw)==ref['bytes'] and
                claim['claimKind']==kind and claim['claimKey']==key and claim['acquisitionId']==auth['acquisitionId'] and
                claim['authorizationSha256']==auth_sha and moment(claim['claimedAt']) and
                claim['claimedAt']<=consumed['consumedAt'], 'ACQUISITION_CAPTURE_BINDING')
    for i,kind in enumerate(['PRE','ROLES','POST'],1):
        dispatch_raw=private_read(root/'dispatches'/auth['acquisitionId']/(f'{i:02d}-'+kind.lower()+'.json'))
        dispatch=closed(strict_json(dispatch_raw),'source-provenance-dispatch/1');proof=bundle['records'][kind]['proof']
        require(sha(dispatch_raw)==proof['dispatchSha256'] and dispatch['kind']==kind and type(dispatch['sequence']) is int and
                dispatch['sequence']==i and dispatch['authorizationSha256']==auth_sha and dispatch['acquisitionId']==auth['acquisitionId'] and
                dispatch['consumedSha256']==report['consumedSha256'] and dispatch['invocationId']==proof['invocationId'] and
                dispatch['argvSha256']==proof['argvSha256'] and dispatch['queryIds']==(PRE_ORDER if kind=='PRE' else POST_ORDER if kind=='POST' else []) and
                dispatch['environmentPolicySha256']==sha(canonical(SESSION_DESIGN['runtimeEnvironment'] if auth['bindings']['transportKind']=='SESSION' and kind=='ROLES' else DESIGN['transportContract']['envPolicy'])) and moment(dispatch['issuedAt']) and
                consumed['consumedAt']<=dispatch['issuedAt']<=proof['startedAt'], 'ACQUISITION_CAPTURE_BINDING')
    if auth['bindings']['transportKind']=='SESSION':
        proof=bundle['records']['ROLES']['proof'];extra=proof['rolesExporterProof'];iid=proof['invocationId']
        env,envref=read_auxiliary_staging(root,auth['acquisitionId'],iid,'producer.env')
        rr,rrref=read_auxiliary_staging(root,auth['acquisitionId'],iid,'readonly.json')
        require(extra['producerEnvironmentRef']==envref and extra['measurementReceiptRef']==rrref and
                extra['producerEnvironmentRawSha256']==sha(env) and extra['measurementReceiptRawSha256']==sha(rr),'ACQUISITION_CAPTURE_BINDING')
        receipt=validate_producer_receipt(rr,extra['measurementReceipt']['bindings'])
        parse_producer_environment(env,receipt['bindings'])
        require(canonical(receipt)==canonical(extra['measurementReceipt']),'ACQUISITION_CAPTURE_BINDING')
    if require_terminal:
        terminal=closed(strict_json(private_read(root/'terminal'/(auth['acquisitionId']+'.json'))),'source-provenance-terminal/1')
        require(terminal['acquisitionId']==auth['acquisitionId'] and terminal['authorizationSha256']==auth_sha and
                terminal['consumedSha256']==report['consumedSha256'] and terminal['status']==SUCCESS and terminal['cleanupStatus']=='PASS' and
                terminal['failureCode'] is None and moment(terminal['terminalAt']) and terminal['terminalAt']>=report['completedAt'] and
                terminal['reportRef']=={'path':'acquisitions/'+auth['acquisitionId']+'/acquisition.json',
                                       'sha256':sha(raw['acquisition.json']),'bytes':len(raw['acquisition.json'])}, 'ACQUISITION_CAPTURE_BINDING')
    return report


def _failure_code(error):
    code=getattr(error,'code','ACQUISITION_INTERNAL_FAILURE')
    if code in ERRORS:
        return code
    if 'PROFILE' in code or code.startswith('ROLE_FIDELITY'):
        return 'ACQUISITION_PROFILE_UNSUPPORTED'
    if code.startswith(('ROLE_SCRIPT','BOOTSTRAP_CREATE','ROLE_PASSWORD')):
        return 'ACQUISITION_ROLES_LEXICAL_UNSUPPORTED'
    if code.startswith(('SOURCE_BOOTSTRAP','SOURCE_')):
        return 'ACQUISITION_SOURCE_DRIFT'
    if code.startswith(('TARGET_','CLIENT_TLS')):
        return 'ACQUISITION_CLIENT_TLS'
    if isinstance(error,FileExistsError):
        return 'ACQUISITION_REPLAY'
    if isinstance(error,(OSError,UnicodeError,ValueError,KeyError,TypeError)):
        return 'ACQUISITION_INTERNAL_FAILURE'
    return 'ACQUISITION_INTERNAL_FAILURE'


def acquire(ctx, approval_id, approval_sha, plan=None):
    """One attempt, no retry. Errors after consumption produce private terminal evidence."""
    run=None; sessions=[]; failure=None; failed_phase=None; clean={'status':'PASS','ownedContainersRemaining':0}
    try:
        run=_Run(ctx,approval_id,approval_sha,plan)
        run.image_preflight()
        run.consume();run.phase='CREDENTIALS';run.guard(credentials=True)
        pre=_ReadonlySession(run,'PRE');sessions.append(pre);before=pre.measure()
        roles=run.roles();pre.close()
        post=_ReadonlySession(run,'POST');sessions.append(post);after=post.measure();post.close()
        run.phase='PROFILE_REVIEW'
        review=profile_report(before,after,roles)
        bundle=obj('source-provenance-proof-bundle/3',acquisitionId=run.id,authorizationSha256=run.auth_sha,
                   sourceTargetId=run.auth['bindings']['acquisitionIntent']['sourceTargetId'],records=run.records)
        validate_payloads(before,after,roles,bundle,review,run.auth,run.auth_sha,ctx.fixture)
        write_json(run.attempt/'transport-proofs.json',bundle)
        write_json(run.attempt/'profile-review.json',review)
    except (Exception,KeyboardInterrupt) as error:
        failure=error;failed_phase=run.phase if run else 'PRECHECK'
    finally:
        if run:
            for session in reversed(sessions):
                try:
                    session.close()
                except (Exception,KeyboardInterrupt) as error:
                    if failure is None:
                        failure=error;failed_phase='CLEANUP'
            try:
                clean=run.cleanup()
            except Exception:
                try:
                    if run.consumed_ref is not None:
                        write_json(run.attempt/'cleanup-incomplete.json',{
                            'phase':'CLEANUP','failureCode':'ACQUISITION_CLEANUP_FAILED',
                            'ownedContainersRemaining':'NOT_OBSERVABLE','ownedCandidateNames':sorted(run.names)})
                        write_json(ctx.root/'terminal'/(run.id+'.json'),obj('source-provenance-terminal/1',
                            acquisitionId=run.id,authorizationSha256=run.auth_sha,consumedSha256=run.consumed_ref['sha256'],
                            reportRef=None,status=FAILED,terminalAt=time.time(),cleanupStatus='FAIL',failureCode='ACQUISITION_CLEANUP_FAILED'))
                finally:
                    run.unlock()
                raise Failure('ACQUISITION_FAILED','ACQUISITION_CLEANUP_FAILED') from None
            if clean['status']!='PASS':
                failure=Failure('ACQUISITION_FAILED','ACQUISITION_CLEANUP_FAILED');failed_phase='CLEANUP'
    if run is None:
        raise Failure('ACQUISITION_FAILED',_failure_code(failure)) from None
    try:
        if run.consumed_ref is None:
            raise Failure('ACQUISITION_FAILED',_failure_code(failure)) from None
        if failure is not None:
            # Completed partial observations/proofs remain truthful; no fake success bundle.
            for session in sessions:
                path=run.attempt/(session.kind.lower()+'.partial.json')
                if not os.path.lexists(run.attempt/(session.kind.lower()+'.json')):
                    write_json(path,{'phase':session.kind,'responses':session.responses,'complete':False})
            write_json(run.attempt/'partial-proofs.json',{'records':run.records,'complete':False})
            write_json(run.attempt/'failure.json',{'phase':failed_phase,'code':_failure_code(failure),
                'errorTextSha256':sha(str(failure).encode()),'stderrSha256':[sha(bytes(p.err)) for p in run.processes]})
        code=_failure_code(failure) if failure else None
        status=SUCCESS if failure is None else REJECTED if code in ('ACQUISITION_PROFILE_UNSUPPORTED','ACQUISITION_ROLES_LEXICAL_UNSUPPORTED') else FAILED
        files={}
        for p in sorted(run.attempt.iterdir()):
            raw=private_read(p);files[p.name]={'sha256':sha(raw),'bytes':len(raw)}
        report=obj('source-provenance-acquisition/1',acquisitionId=run.id,authorizationSha256=run.auth_sha,
            humanApprovalSha256=sha(run.human_raw),consumedSha256=run.consumed_ref['sha256'],
            acquisitionSourceDigest=run.auth['bindings']['acquisitionSourceDigest'],operationalPackageDigest=PACKAGE_DIGEST,
            queryRegistrySha256=QUERY_SHA,sourceTargetId=run.auth['bindings']['acquisitionIntent']['sourceTargetId'],
            recoveryCandidateName=ba.RECOVERY_CANDIDATE,recoveryCandidateVersion=4,status=status,startedAt=run.start,
            completedAt=time.time(),files=files,observedCounters=run.counter,failurePhase=failed_phase,failureCode=code,
            cleanup=clean,productionAdoptionReady=False,backupAuthorized=False,restoreAuthorized=False)
        ref=write_json(run.attempt/'acquisition.json',report)
        if status==SUCCESS:
            validate_artifacts(run.attempt,run.auth_raw,fixture=ctx.fixture,require_terminal=False)
        terminal=obj('source-provenance-terminal/1',acquisitionId=run.id,authorizationSha256=run.auth_sha,
            consumedSha256=run.consumed_ref['sha256'],reportRef=dict(ref,path='acquisitions/'+run.id+'/acquisition.json'),
            status=status,terminalAt=time.time(),cleanupStatus=clean['status'],failureCode=code)
        write_json(ctx.root/'terminal'/(run.id+'.json'),terminal)
        return {'status':status,'acquisitionId':run.id,'reportSha256':ref['sha256'],'phase':failed_phase,'failureCode':code}
    finally:
        run.unlock()


class _ClosedParser(argparse.ArgumentParser):
    def error(self, message):
        # argparse's default error echoes rejected argv, potentially a pasted DSN.
        self.exit(2, 'ACQUISITION_AUTH_INVALID\n')


def main(argv=None):
    parser=_ClosedParser(description='Dedicated source-only acquisition; separate one-use approval required.',allow_abbrev=False)
    parser.add_argument('command',choices=['acquire','acquire-session'])
    parser.add_argument('--approval-id',required=True)
    parser.add_argument('--approval-sha256',required=True)
    supplied=list(sys.argv[1:] if argv is None else argv)
    if '--help' not in supplied and '-h' not in supplied:
        if len(supplied)!=5 or supplied.count('--approval-id')!=1 or supplied.count('--approval-sha256')!=1:
            parser.error('closed argument set')
    args=parser.parse_args(supplied)
    try:
        ctx,plan=production_context(args.approval_id,args.approval_sha256,transport_kind='SESSION' if args.command=='acquire-session' else 'DIRECT')
        result=acquire(ctx,args.approval_id,args.approval_sha256,plan)
    except (Exception,KeyboardInterrupt) as error:
        result={'status':'REJECTED','failureCode':_failure_code(error)}
    print(json.dumps(result,sort_keys=True))
    return 0 if result['status']==SUCCESS else 2


if __name__=='__main__':
    raise SystemExit(main())
