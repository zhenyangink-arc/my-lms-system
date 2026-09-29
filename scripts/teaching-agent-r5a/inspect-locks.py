"""Read-only file/archive audit. Writes only R5A sanitized evidence; no apply/deploy."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tarfile

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/teaching-agent-stage-1f-r5a'
def sha(p):
    with p.open('rb') as f: return hashlib.file_digest(f,'sha256').hexdigest()
def digest(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def read(p): return json.loads(p.read_text())
def save(n,o): (OUT/n).write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')

metadata=read(ROOT/'docs/evidence/teaching-agent-stage-1f-r4a/release-metadata-manifest.json')
locked=metadata['payload'];baseline=read(ROOT/'supabase/bootstrap/baseline-manifest.json')
versions=[f'20260914000{i}' for i in range(8)]
entries=locked['postBaselineMigrations']
checks={'metadataDigest':digest(locked)==metadata['metadataDigest'],
 'cutover':baseline['baselineCutoverVersion']==locked['baselineCutoverVersion']=='202609130003',
 'count':baseline['preCutoverLedgerCount']==locked['preCutoverLedgerCount']==449,
 'detail':baseline['postBaselineMigrations']==entries,
 'versions':baseline['postBaselineMigrationVersions']==locked['postBaselineMigrationVersions']==versions,
 'baselineManifestSha':sha(ROOT/'supabase/bootstrap/baseline-manifest.json')==locked['baselineManifestSha256'],
 'baselineSqlSha':sha(ROOT/'supabase/bootstrap/app-schema-baseline.sql')==locked['baselineSqlDigest'],
 'baselineLedgerSha':sha(ROOT/'supabase/bootstrap/migration-ledger-baseline.json')==locked['preCutoverLedgerDigest']}
active=sorted(p.name for p in (ROOT/'supabase/migrations').glob('*.sql') if p.name[:12]>'202609130003')
checks['activeRangeExact']=active==[m['filename'] for m in entries]
rows=[]
for m in entries:
    p=ROOT/'supabase/migrations'/m['filename']; current=sha(p)
    rows.append({**m,'currentSha256':current,'lockedSha256':m['sha256'],'status':'MATCH' if current==m['sha256'] else 'DRIFT'})
checks['allHashes']=all(m['status']=='MATCH' for m in rows)
inventory=[{k:m[k] for k in ['filename','version','sha256']} for m in entries]
checks['inventoryDigest']=digest(inventory)==locked['migrationInventoryDigest']
save('migration-package.json',{'status':'LOCKED' if all(checks.values()) else 'DRIFTED','checks':checks,'migrations':rows,
 'baseline':{k:locked[k] for k in ['baselineCutoverVersion','baselineManifestSha256','baselineSqlDigest','preCutoverLedgerCount','preCutoverLedgerDigest']},
 'metadataDigest':metadata['metadataDigest'],'baselineReplayAllowed':False})
assert all(checks.values()),'STOP — Migration Package DRIFTED'

old=read(ROOT/'docs/evidence/teaching-agent-stage-1f-r4g/operator-bundle.json')
op={k:sha(ROOT/p) for k,p in old['paths'].items()}
save('operator-bundle.json',{'status':'LOCKED' if all(op[k]==old[k] for k in op) else 'DRIFTED',**op,
 'paths':old['paths'],'reconcilerVersion':old['reconcilerVersion'],'receiptVersion':old['receiptVersion'],'executionPermitted':False})
assert all(op[k]==old[k] for k in op),'STOP — Operator Bundle DRIFTED'

archive=Path('/tmp/uply-r3d-release-candidate/candidate-build.tar.gz')
assert archive.exists(),'STOP — Artifact MISSING'
assert stat.S_ISREG(archive.lstat().st_mode) and not archive.is_symlink(),'STOP — Artifact unsafe file type'
archive_sha=sha(archive)
assert archive_sha==locked['applicationArchiveSha256'],'STOP — Artifact DRIFTED'
source_paths=[p for name in ('src','public') for p in (ROOT/name).rglob('*') if p.is_file()]
source_paths += [ROOT/name for name in ('package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs')]
sources={str(p.relative_to(ROOT)):sha(p) for p in sorted(source_paths)}
source_digest=digest(sources)
source_old=read(ROOT/'docs/evidence/teaching-agent-stage-1f-r4/release-integrity.json')['sourceInputs']
with tarfile.open(archive,'r:gz') as t:
    members=t.getmembers()
    names=[m.name for m in members]
    assert len(set(names))==len(names) and all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in names),'Unsafe archive paths'
    assert all(m.isfile() or m.isdir() for m in members),'Unexpected archive special file'
    files={m.name:hashlib.sha256(t.extractfile(m).read()).hexdigest() for m in members if m.isfile()}
    build=t.extractfile('.next/BUILD_ID').read().decode().strip()
    required=read_required=json.loads(t.extractfile('.next/required-server-files.json').read())
    pkg=json.loads(t.extractfile('package.json').read())
    nextfiles={k:v for k,v in files.items() if k.startswith('.next/') and 'cache' not in Path(k).parts}
    extras={k:v for k,v in files.items() if not k.startswith('.next/')}
    required_missing=[n for n in required['files'] if n not in files]
    artifact_digest=digest(nextfiles)
    archive_checks={'archiveSha':True,'buildId':build==locked['applicationBuildId'],
      'artifactDigest':artifact_digest==locked['applicationArtifactDigest'],
      'sourceDigest':source_digest==locked['applicationSourceDigest'],'sourceInputs':sources==source_old,
      'extraFilesMatch':all((ROOT/k).is_file() and sha(ROOT/k)==v for k,v in extras.items()),
      'requiredServerFilesPresent':not required_missing}
    save('artifact-lock.json',{'status':'LOCKED' if all(archive_checks.values()) else 'DRIFTED',
      'path':str(archive),'regularFile':True,'symlink':False,'size':archive.stat().st_size,'sha256':archive_sha,
      'tarReadable':True,'memberCount':len(members),'buildId':build,'artifactFiles':len(nextfiles),
      'artifactDigest':artifact_digest,'applicationSourceDigest':source_digest,'sourceInputCount':len(sources),
      'sourceScope':['src/**','public/**','package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs'],
      'sourceMapReference':'docs/evidence/teaching-agent-stage-1f-r4/release-integrity.json#sourceInputs',
      'requiredServerFiles':{'version':required['version'],'count':len(required['files']),'missing':required_missing,
         'output':required['config'].get('output'),'distDir':required['config'].get('distDir'),
         'buildWorkspaceExists':Path(required['appDir']).exists()},
      'packageNextVersion':pkg['dependencies'].get('next'),'installedBuilderNextVersion':read(ROOT/'node_modules/next/package.json')['version'],
      'nodeModulesIncluded':any(n.startswith('node_modules/') for n in names),
      'publicPackageConfigFileCount':len(extras),'checks':archive_checks,
      'definitionDigestLockedMetadata':locked['definitionDigest'],
      'definitionVerification':'Definition manifest metadata unchanged and all source inputs match; no runtime pin/Provider executed',
      'candidatePersistence':'TEMPORARY LOCATION / DURABILITY RISK','archiveExtractedCopiedMoved':False})
    assert all(archive_checks.values()),'STOP — Artifact/source DRIFTED'

known=Path('/home/yangzhen/releases/uply-first-enable-20260910/source')
save('known-good-release.json',{'path':str(known),'directory':known.is_dir(),'symlink':known.is_symlink(),
 'buildId':(known/'.next/BUILD_ID').read_text().strip(),'nextVersion':read(known/'node_modules/next/package.json')['version'],
 'packageSha256':sha(known/'package.json'),'lockfileSha256':sha(known/'package-lock.json'),
 'candidateDependencyLockMatchesKnownGood':sha(known/'package-lock.json')==sha(ROOT/'package-lock.json'),
 'requiredServerFilesExists':(known/'.next/required-server-files.json').is_file(),
 'sourceAvailable':(known/'src').is_dir(),'launcher':'/home/yangzhen/.config/uply-first-enable-20260910/start.mjs',
 'launcherSha256':sha(Path('/home/yangzhen/.config/uply-first-enable-20260910/start.mjs')),
 'runtimeSha256':sha(Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json')),
 'rollbackExecutionTestedThisStage':False})
assert (known/'.next/BUILD_ID').read_text().strip()=='LuAZe2VMY32YjOo1WvtrC','STOP — Known-good Build changed'
print(json.dumps({'migrations':'LOCKED','artifact':'LOCKED','operator':'LOCKED','sourceInputs':len(sources),'artifactFiles':len(nextfiles),'requiredMissing':required_missing,'knownGood':'MATCH'}))
