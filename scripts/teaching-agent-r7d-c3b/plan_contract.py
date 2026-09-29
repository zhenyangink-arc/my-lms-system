"""Finite reviewed plan registry, raw byte seals and operator trust boundary."""
import copy
import os
from pathlib import Path
import re
import time
from receipts import Failure, sha, canonical, strict_json, safe_file

OPS = Path(__file__).resolve().parent
ROOT = OPS.parents[1]
REGISTRY_PATH = OPS / 'plan_registry.json'
PROFILE_PATH = OPS / 'target_profiles.json'
TOKEN = object()
TRANSPORT_CONTRACT = 'maintenance-transport-security/pooled-provider-managed-risk-accepted/1'
RISK_ID = 'r7d-c3b-pooled-transport-risk-acceptance/1'
RISK_PATH = 'docs/evidence/teaching-agent-stage-1f-r7d-c/approval-r7d-c3b-runner-pooled-transport-risk-acceptance.json'
RISK_SHA = '280b802f02130434553a8304675858376d47fb3728691b12a98e4b469c8b3957'
RISK_BINDING = {'contractId': TRANSPORT_CONTRACT, 'riskAcceptanceId': RISK_ID,
                'riskArtifactSha256': RISK_SHA, 'scope': 'R7D-C3B_ONLY',
                'releaseId': 'R7D-C3B', 'stageActive': True, 'completionObserved': False}


def transport_policy(profile):
    return {'contractId': TRANSPORT_CONTRACT, 'riskAcceptanceId': RISK_ID,
            'riskArtifactPath': RISK_PATH, 'riskArtifactSha256': RISK_SHA,
            'scope': 'R7D-C3B_ONLY', 'releaseId': 'R7D-C3B',
            'hostIdentitySha256': profile['hostIdentitySha256'],
            'projectIdentitySha256': profile['projectIdentitySha256'],
            'port': 5432, 'poolMode': 'SESSION', 'transport': 'TCP',
            'sslmode': 'verify-full', 'gssencmode': 'disable',
            'caPolicy': 'PINNED_CREDENTIAL_IDENTITY_ROOT_CRT',
            'backendObservation': 'BACKEND_OBSERVATION_ONLY',
            'providerHop': 'PROVIDER_MANAGED_UNVERIFIED',
            'closureMarker': 'R7D-C3B.release-completed.json'}


def risk_guard(plan, auth):
    """No credentials; operator attestation and closure override proposal booleans.

    The artifact records risk acceptance, never operation authorization. Callers
    must also pass the distinct READY/capture authorization and freshness gates.
    """
    if plan.fixture:
        if 'transportRiskAcceptance' in auth:
            raise Failure('TARGET_IDENTITY_MISMATCH', 'FIXTURE_RISK_FORBIDDEN')
        return None
    if (plan.data['targetProfile'] != 'uply-canonical-maintenance/1' or
        canonical(auth.get('transportRiskAcceptance')) != canonical(RISK_BINDING)):
        raise Failure('APPROVAL_MISSING', 'PROVIDER_HOP_RISK_NOT_ACCEPTED')
    profile = strict_json(safe_file(PROFILE_PATH))['profiles']['uply-canonical-maintenance/1']
    if canonical(profile.get('transportSecurity')) != canonical(transport_policy(profile)):
        raise Failure('TARGET_IDENTITY_MISMATCH', 'TRANSPORT_PROFILE_MISMATCH')
    marker = ROOT / profile['receiptRoot'] / 'R7D-C3B.release-completed.json'
    # lexists includes dangling symlinks. Never open, interpret, repair or delete it.
    if os.path.lexists(marker):
        raise Failure('APPROVAL_MISSING', 'RISK_ACCEPTANCE_SCOPE_EXPIRED')
    for parent in marker.parents:
        if parent.is_symlink() or (parent.exists() and not parent.is_dir()):
            raise Failure('APPROVAL_MISSING', 'RISK_ACCEPTANCE_SCOPE_EXPIRED')
    try:
        raw = safe_file(ROOT / RISK_PATH)
        if sha(raw) != RISK_SHA: raise ValueError()
        risk = strict_json(raw)
        bound = risk['target']
        if (bound['profile'] != plan.data['targetProfile'] or bound['port'] != 5432 or
            bound['poolMode'] != 'SESSION' or any(bound[k] != profile[k] for k in
                ('hostIdentitySha256','projectIdentitySha256','database','role','imageId'))):
            raise ValueError()
        if not any(x['sha256'] == plan.migration['rawSha256'] and
                   x['path'] == plan.migration['path'] for x in risk['allowedMigrationLocks']):
            raise ValueError()
    except (OSError, ValueError, KeyError, Failure):
        raise Failure('APPROVAL_MISSING', 'PROVIDER_HOP_RISK_NOT_ACCEPTED') from None
    return RISK_BINDING.copy()


def validate(value, schema):
    if 'anyOf' in schema:
        for branch in schema['anyOf']:
            try:
                validate(value, branch); return
            except Failure:
                pass
        raise Failure('PRECHECK_FAILED', 'SCHEMA_ANYOF')
    types = {'object': dict, 'array': list, 'string': str, 'integer': int, 'null': type(None)}
    if 'type' in schema and type(value) is not types[schema['type']]:
        raise Failure('PRECHECK_FAILED', 'SCHEMA_TYPE')
    if 'const' in schema and (type(value) is not type(schema['const']) or value != schema['const']):
        raise Failure('PRECHECK_FAILED', 'SCHEMA_CONST')
    if 'enum' in schema and value not in schema['enum']:
        raise Failure('PRECHECK_FAILED', 'SCHEMA_ENUM')
    if isinstance(value, dict):
        props = schema.get('properties', {})
        if not set(schema.get('required', [])).issubset(value):
            raise Failure('PRECHECK_FAILED', 'SCHEMA_REQUIRED')
        if schema.get('additionalProperties') is False and set(value) - set(props):
            raise Failure('PRECHECK_FAILED', 'UNKNOWN_FIELD')
        for k, v in value.items():
            if k in props: validate(v, props[k])
    if isinstance(value, list):
        if len(value) < schema.get('minItems', 0): raise Failure('PRECHECK_FAILED')
        if schema.get('uniqueItems') and len({canonical(x) for x in value}) != len(value):
            raise Failure('PRECHECK_FAILED', 'DUPLICATES')
        for x in value: validate(x, schema.get('items', {}))
    if type(value) is int and value < schema.get('minimum', value): raise Failure('PRECHECK_FAILED')
    if isinstance(value, str):
        if len(value) < schema.get('minLength', 0) or ('pattern' in schema and not re.fullmatch(schema['pattern'], value)):
            raise Failure('PRECHECK_FAILED', 'SCHEMA_STRING')


def registry():
    return strict_json(safe_file(REGISTRY_PATH))


def below(root, relative):
    p = Path(relative)
    if p.is_absolute() or '..' in p.parts or '.' in p.parts:
        raise Failure('PRECHECK_FAILED', 'PATH_ESCAPE')
    candidate = root / p
    if not candidate.resolve().is_relative_to(root.resolve()):
        raise Failure('PRECHECK_FAILED', 'PATH_ESCAPE')
    safe_file(candidate)
    return candidate


def package_hashes():
    paths = ['runner.py', 'plan_contract.py', 'plan_registry.json', 'checks.py', 'transaction.py',
             'maintenance_transport.py', 'backup_adapter.py', 'receipts.py', 'target_profiles.json', 'capture_authorization.py']
    return {p: sha(safe_file(OPS / p)) for p in paths}


class Plan:
    def __init__(self, raw, expected_hash, *, _fixture=False):
        if sha(raw) != expected_hash: raise Failure('PRECHECK_FAILED', 'PLAN_RAW_HASH')
        self.raw, self.digest, self.fixture = raw, expected_hash, _fixture
        self.data = strict_json(raw)
        reg = registry()
        schema = copy.deepcopy(reg['schema'])
        if _fixture: schema['properties']['targetProfile']['const'] = 'OWNED_ISOLATED_FIXTURE'
        validate(self.data, schema)
        m = self.data['migration']; v = m['version']
        if v not in reg['migrations']: raise Failure('PRECHECK_FAILED', 'UNKNOWN_MIGRATION')
        self.migration = reg['migrations'][v]
        if (m['path'], m['sha256'], m['name']) != (self.migration['path'], self.migration['rawSha256'], self.migration['name']):
            raise Failure('PRECHECK_FAILED', 'MIGRATION_TUPLE')
        # These finite exact parameter templates are closed schemas as well as required sets.
        for phase in ['preflightChecks', 'postconditionChecks']:
            if canonical(self.data[phase]) != canonical(reg['checkTemplates'][v][phase]):
                raise Failure('PRECHECK_FAILED', 'CHECK_SET_OR_PARAMETERS')
        if self.data['scope']['allowedDeltaProfile'] != {'202609180000':'chapter-practice-acl/1', '202609180001':'agent-completion-v2/1', '202609180002':'native-publication-v2/1'}[v]:
            raise Failure('PRECHECK_FAILED', 'SCOPE')
        l = self.data['ledger']; vs = l['expectedPriorVersions']
        if vs != sorted(set(vs)) or len(vs) != l['expectedCount'] or vs[-1] != l['expectedLatest'] or v <= vs[-1]:
            raise Failure('PRECHECK_FAILED', 'LEDGER_ORDER')
        if sha(canonical(vs)) != l['versionsSha256']:
            raise Failure('PRECHECK_FAILED', 'VERSION_DIGEST')
        if l['followingAbsent'] != [x for x in reg['migrations'] if x > v]:
            raise Failure('PRECHECK_FAILED', 'FOLLOWING_VERSIONS')
        if self.data['status'] == 'READY_FOR_INSTALL' and not l['sourcePrefixSha256']:
            raise Failure('PRECHECK_FAILED', 'PREFIX_REQUIRED')
        approval = self.data['createdFromApproval']
        if v == '202609180000':
            ref = next(x for x in reg['readOnlyLocks'] if x['path'].endswith('approval-r7d-c3b-acl-forward-fix-install.json'))
            if approval['artifactPath'] != ref['path'] or approval['sha256'] != ref['sha256']:
                raise Failure('APPROVAL_MISSING', 'APPROVAL_TUPLE')
            if sha(safe_file(ROOT / ref['path'])) != ref['sha256']:
                raise Failure('APPROVAL_MISSING', 'APPROVAL_HASH')
        elif not _fixture:
            raise Failure('APPROVAL_MISSING', 'PRODUCTION_PLAN_NOT_REGISTERED')
        self._token = TOKEN
        self._source_path = None

    def ensure_ready(self):
        if self._source_path is not None and sha(safe_file(self._source_path)) != self.digest:
            raise Failure('PRECHECK_FAILED', 'PLAN_FILE_CHANGED')
        if self.data['status'] != 'READY_FOR_INSTALL':
            raise Failure('APPROVAL_MISSING', 'DRAFT_NOT_EXECUTABLE')
        if sha(self.raw) != self.digest or canonical(strict_json(self.raw)) != canonical(self.data):
            raise Failure('PRECHECK_FAILED', 'PLAN_CHANGED')

    def source(self):
        if self.migration != registry()['migrations'][self.data['migration']['version']]:
            raise Failure('PRECHECK_FAILED', 'REGISTRY_TUPLE_CHANGED')
        from transaction import reviewed_body
        raw = safe_file(below(ROOT, self.migration['path']))
        return raw, reviewed_body(raw, self.migration)

    def inventory(self):
        prior = set(self.data['ledger']['expectedPriorVersions'])
        pending = []
        for p in (ROOT / 'supabase/migrations').iterdir():
            if not re.fullmatch(r'[0-9]{12}_[a-z0-9_]+\.sql', p.name):
                raise Failure('PRECHECK_FAILED', 'UNRECOGNIZED_MIGRATION_FILENAME')
            v = p.name[:12]
            if v < self.data['migration']['version'] and v not in prior: pending.append(v)
        if pending: raise Failure('PRECHECK_FAILED', 'PENDING_EARLIER_VERSION')


def load_plan(name):
    r = registry()
    if name not in r['plans']: raise Failure('PRECHECK_FAILED', 'UNKNOWN_PLAN')
    entry = r['plans'][name]
    path = below(OPS, entry['path'])
    p = Plan(safe_file(path), entry['sha256'])
    if p.fixture or p.data['planId'] != name or p.data['status'] != entry['status']:
        raise Failure('PRECHECK_FAILED', 'REGISTRY_BINDING')
    p._source_path = path
    return p


AUTH_FIELDS = {'contract', 'scope', 'planId', 'planSha256', 'migrationVersion', 'migrationSha256',
               'packageHashes', 'targetProfile', 'targetIdentity', 'observedAt', 'expiresAt',
               'operatorUid', 'userApprovalRef', 'userApprovalSha256', 'nonce', 'ledgerDescriptorSha256',
               'catalogBeforeSha256', 'backupManifestSha256', 'backupDirectory', 'runtimeBoundary',
               'credentialIdentitySha256'}


def authorize(plan, auth, mode):
    plan.ensure_ready()
    fields = AUTH_FIELDS if plan.fixture else AUTH_FIELDS | {'transportRiskAcceptance'}
    version = '1' if plan.fixture else '2'
    if type(auth) is not dict or set(auth) != fields or auth['contract'] != 'exact-single-operator-authorization/' + version:
        raise Failure('APPROVAL_MISSING', 'AUTH_SCHEMA')
    risk_guard(plan, auth)
    if mode not in {'SINGLE_MIGRATION_APPLY','READ_ONLY_PREFLIGHT','READ_ONLY_VERIFY','BACKUP_READ_EXPORT'}:
        raise Failure('APPROVAL_MISSING')
    if auth['scope'] != mode or auth['operatorUid'] != os.getuid(): raise Failure('APPROVAL_MISSING')
    if not auth['userApprovalRef'] or not re.fullmatch('[a-f0-9]{64}', auth['userApprovalSha256']):
        raise Failure('APPROVAL_MISSING')
    if any(type(auth[k]) not in (int,float) for k in ('observedAt','expiresAt')):
        raise Failure('APPROVAL_MISSING', 'AUTH_TIME_TYPE')
    now = time.time()
    if not (auth['observedAt'] <= now < auth['expiresAt']) or auth['expiresAt'] - auth['observedAt'] > 900:
        raise Failure('APPROVAL_MISSING', 'AUTH_WINDOW' if plan.fixture else 'RISK_ACCEPTANCE_SCOPE_EXPIRED')
    for key, value in [('planId', plan.data['planId']), ('planSha256', plan.digest),
                       ('migrationVersion', plan.data['migration']['version']),
                       ('migrationSha256', plan.migration['rawSha256']), ('targetProfile', plan.data['targetProfile'])]:
        if auth[key] != value: raise Failure('APPROVAL_MISSING', 'AUTH_BINDING')
    if auth['packageHashes'] != package_hashes(): raise Failure('APPROVAL_MISSING', 'PACKAGE_HASH')
    for key in ['ledgerDescriptorSha256', 'catalogBeforeSha256']:
        if not re.fullmatch('[a-f0-9]{64}', auth[key] or ''): raise Failure('APPROVAL_MISSING')
    if not re.fullmatch('[a-f0-9]{32}', auth['nonce']): raise Failure('APPROVAL_MISSING')
    if plan.fixture != (auth['targetProfile'] == 'OWNED_ISOLATED_FIXTURE'):
        raise Failure('TARGET_IDENTITY_MISMATCH')
    return sha(canonical(auth))


CAPTURE_MODE = 'READ_ONLY_BASELINE_CAPTURE'
CAPTURE_APPROVAL = 'docs/evidence/teaching-agent-stage-1f-r7d-c/approval-r7d-c3b-runner-controlled-preflight-v5.json'
CAPTURE_FIELDS = {'contract', 'scope', 'planId', 'planSha256', 'migrationSha256',
                  'bodySha256', 'packageHashes', 'targetProfile', 'targetIdentity',
                  'observedAt', 'expiresAt', 'operatorUid', 'userApprovalRef',
                  'userApprovalSha256', 'explicitCaptureAuthorization', 'nonce',
                  'credentialIdentitySha256', 'expectedLedgerPrefixSha256'}


def authorize_capture(plan, auth):
    """Operator-owned private artifact is the trust boundary, never an auto approval.

    No READY transition, install authorization or future baseline hash is required.
    Fixture plans are valid only for the separate owned transport, never production.
    """
    fields = CAPTURE_FIELDS if plan.fixture else CAPTURE_FIELDS | {'transportRiskAcceptance'}
    version = '1' if plan.fixture else '2'
    if (type(auth) is not dict or set(auth) != fields or
        auth['contract'] != 'readonly-baseline-capture-authorization/' + version or
        auth['scope'] != CAPTURE_MODE or auth['explicitCaptureAuthorization'] is not True or
        type(auth['operatorUid']) is not int or auth['operatorUid'] != os.getuid()):
        raise Failure('APPROVAL_MISSING', 'CAPTURE_AUTH_SCHEMA')
    risk_guard(plan, auth)
    if (plan.data['status'] != 'DRAFT_NOT_EXECUTABLE' or
        plan.data['migration']['version'] != '202609180000' or
        sha(plan.raw) != plan.digest or canonical(strict_json(plan.raw)) != canonical(plan.data)):
        raise Failure('APPROVAL_MISSING', 'CAPTURE_DRAFT_REQUIRED')
    if plan._source_path is not None and sha(safe_file(plan._source_path)) != plan.digest:
        raise Failure('PRECHECK_FAILED', 'PLAN_FILE_CHANGED')
    if not plan.fixture:
        registered = load_plan('acl-000-v1')
        if plan.digest != registered.digest or plan.data != registered.data:
            raise Failure('APPROVAL_MISSING', 'CAPTURE_REGISTERED_DRAFT')
    if any(type(auth[k]) not in (int, float) for k in ('observedAt', 'expiresAt')):
        raise Failure('APPROVAL_MISSING', 'CAPTURE_AUTH_TIME')
    now = time.time()
    if not (auth['observedAt'] <= now < auth['expiresAt'] and
            0 < auth['expiresAt'] - auth['observedAt'] <= 900):
        raise Failure('APPROVAL_MISSING', 'CAPTURE_AUTH_WINDOW' if plan.fixture else 'RISK_ACCEPTANCE_SCOPE_EXPIRED')
    for k, value in [('planId', plan.data['planId']), ('planSha256', plan.digest),
                     ('migrationSha256', plan.migration['rawSha256']),
                     ('bodySha256', plan.migration['bodySha256']),
                     ('packageHashes', package_hashes()), ('targetProfile', plan.data['targetProfile'])]:
        if auth[k] != value: raise Failure('APPROVAL_MISSING', 'CAPTURE_STATIC_BINDING')
    for key in ('nonce', 'userApprovalSha256'):
        if type(auth[key]) is not str or not re.fullmatch('[a-f0-9]{%d}' % (32 if key == 'nonce' else 64), auth[key]):
            raise Failure('APPROVAL_MISSING', 'CAPTURE_AUTH_IDENTITY')
    prefix = auth['expectedLedgerPrefixSha256']
    if prefix is not None and (type(prefix) is not str or not re.fullmatch('[a-f0-9]{64}', prefix)):
        raise Failure('APPROVAL_MISSING', 'CAPTURE_PREFIX_TYPE')
    if plan.fixture:
        if (auth['targetProfile'] != 'OWNED_ISOLATED_FIXTURE' or
            auth['userApprovalRef'] != 'OWNED_ISOLATED_FIXTURE' or
            auth['userApprovalSha256'] != sha(b'OWNED_ISOLATED_FIXTURE') or
            auth['credentialIdentitySha256'] is not None):
            raise Failure('TARGET_IDENTITY_MISMATCH', 'CAPTURE_FIXTURE_AUTH')
    else:
        if auth['userApprovalRef'] != CAPTURE_APPROVAL:
            raise Failure('APPROVAL_MISSING', 'CAPTURE_APPROVAL_REFERENCE')
        if sha(safe_file(ROOT / CAPTURE_APPROVAL)) != auth['userApprovalSha256']:
            raise Failure('APPROVAL_MISSING', 'CAPTURE_APPROVAL_HASH')
        if (type(auth['credentialIdentitySha256']) is not str or
            not re.fullmatch('[a-f0-9]{64}', auth['credentialIdentitySha256'])):
            raise Failure('APPROVAL_MISSING', 'CAPTURE_CREDENTIAL_IDENTITY')
    profiles = strict_json(safe_file(PROFILE_PATH))['profiles']
    profile = profiles['uply-canonical-maintenance/1']
    expected = {'database': 'postgres', 'role': 'postgres', 'currentRole': 'postgres',
                'serverMajor': 17, 'targetProfile': plan.data['targetProfile'],
                'imageId': profile['imageId'], 'fixture': plan.fixture,
                'sslmode': None if plan.fixture else 'verify-full',
                'projectIdentitySha256': None if plan.fixture else profile['projectIdentitySha256'],
                'hostIdentitySha256': None if plan.fixture else profile['hostIdentitySha256']}
    if canonical(auth['targetIdentity']) != canonical(expected):
        raise Failure('TARGET_IDENTITY_MISMATCH', 'CAPTURE_FIXED_TARGET')
    plan.source()  # Raw hash + reviewed envelope/body hash, without executing it.
    return sha(canonical(auth))
