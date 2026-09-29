#!/usr/bin/env python3
"""Read existing backup metadata and archive TOCs only. No restore/dump/SQL."""
import datetime as dt
import json
import os
from pathlib import Path
import pwd
import re
import tarfile
from inventory import ROOT, EVIDENCE, IMAGE, sha, digest, run, save

BASE=Path('/home/yangzhen/backups/uply-first-enable-20260910')
now=dt.datetime.now(dt.timezone.utc)
paths=sorted(BASE.glob('*/database.dump'))
paths+=sorted(Path('/tmp/uply-stage1f-readonly').glob('*.dump'))
paths+=[Path('/tmp/uply-r1b-snapshot/schema.dump')]
records=[]
for path in paths:
    row={'path':str(path),'filename':path.name,'exists':path.is_file()}
    if not path.is_file(): records.append(row);continue
    stat=path.stat()
    row.update(bytes=stat.st_size,mtime=dt.datetime.fromtimestamp(stat.st_mtime,dt.timezone.utc).isoformat(),
               owner=pwd.getpwuid(stat.st_uid).pw_name,mode=oct(stat.st_mode&0o777),
               directoryMode=oct(path.parent.stat().st_mode&0o777),sha256=sha(path))
    toc=run(['docker','run','--rm','--pull=never','--read-only','--network=none','--cap-drop=ALL',
             '--security-opt=no-new-privileges','--user',str(os.getuid())+':'+str(os.getgid()),
             '-v',str(path)+':/backup/archive:ro','--entrypoint','pg_restore',IMAGE,'--list','/backup/archive'])
    row['tocReadable']=True
    row['tocHeader']={}
    for line in toc.splitlines():
        for label in ['Archive created at','Dump Version','Format','Compression','Dumped from database version','Dumped by pg_dump version']:
            if label in line: row['tocHeader'][label]=line.split(label,1)[1].lstrip(': ').strip()
    data_lines=[line for line in toc.splitlines() if re.match(r'^\d+; \d+ \d+ TABLE DATA ',line)]
    row['tableDataEntries']=len(data_lines)
    row['tocEntryCount']=sum(bool(re.match(r'^\d+;',line)) for line in toc.splitlines())
    row['dataSchemas']=sorted({line.split(' TABLE DATA ',1)[1].split()[0] for line in data_lines})
    row['classification']='B — FULL LOGICAL BACKUP (historical scope)' if data_lines else 'A — SCHEMA-ONLY'
    row['freshRecoveryPoint']=False
    row['freshnessClassification']='D — STALE: predates current Teaching Agent change'
    for name in ['BACKUP_MANIFEST.json','PRE_MIGRATION_BACKUP_SHA256.json','FINAL_BACKUP_FILES_SHA256.json']:
        file=path.parent/name
        if not file.exists():continue
        sealed=json.loads(file.read_text());checks=[]
        for item in sealed['files']:
            relative=item.get('path',item.get('file'))
            target=path.parent/relative
            assert target.resolve().is_relative_to(path.parent.resolve())
            checks.append({'path':relative,'exists':target.is_file(),'hashMatches':target.is_file() and sha(target)==item['sha256']})
            if relative=='database.dump':row.setdefault('archiveSealChecks',{})[name]=sha(path)==item['sha256']
        row.setdefault('sealInventory',{})[name]={'checked':len(checks),'mismatches':[x for x in checks if not x['hashMatches']]}
        if sealed.get('snapshotTime'):row['snapshotTime']=sealed['snapshotTime']
    timing=path.parent/'backup-timing.json'
    if timing.exists():row.setdefault('snapshotTime',json.loads(timing.read_text())['startedAt'])
    freshness=path.parent/'FRESHNESS.json'
    if freshness.exists():
        f=json.loads(freshness.read_text());row['checkpointEvidence']={k:f[k] for k in ['at','fullRestoreSqlEqual','newArchiveRestoredSeparately']}
        row['archiveSealChecks']={'FRESHNESS.json':f['freshFileSha256']==sha(path)}
        row['checkpointComparedAt']=f['at']
    if row.get('snapshotTime'):
        row['ageHoursAtInventory']=(now-dt.datetime.fromisoformat(row['snapshotTime'].replace('Z','+00:00'))).total_seconds()/3600
    final=path.parent/'FINAL_VERIFICATION.json'
    if final.exists():
        verification=json.loads(final.read_text())
        row['historicalRestore']={k:verification.get(k) for k in ['verifiedAt','archiveReadable','actualDatabaseRestorePassed','allChecksPassed','checks','mediaObjectsBackedUp']}
        result=path.parent/'verified-restore-result.json'
        if result.exists():row['historicalRestore']['exitReceipt']=json.loads(result.read_text())
    records.append(row)
full=[r for r in records if r.get('tableDataEntries')]
latest=max(full,key=lambda r:r.get('snapshotTime',r['mtime']))
save('backup-inventory.json',{'observedAt':now.isoformat(),'scanScope':'Only known backup root direct children and prior stage schema archives; no business rows read',
    'records':records,'latestFullBackup':latest['path'],'latestFullBackupAgeHours':latest['ageHoursAtInventory'],
    'freshRecoveryPointCreated':False,'restoreExecuted':False})

filesystem=os.statvfs(BASE)
size=json.loads((EVIDENCE/'database-start.json').read_text())['databaseBytes']
capacity={'observedAt':now.isoformat(),'existingBase':str(BASE),'availableBytes':filesystem.f_bavail*filesystem.f_frsize,
          'availableInodes':filesystem.f_favail,'databaseBytes':size,'proposedMinimumDatabaseBudgetBytes':3*size,
          'budgetFormula':'DB size + 1x temporary overhead + 1x safety margin; planning estimate, not dump upper bound',
          'proposedOperationalReserveBytes':1024**3,'dfHuman':run(['df','-h',str(BASE)]),'dfInodes':run(['df','-i',str(BASE)]),
          'proposedDestination':'/home/yangzhen/backups/uply/<approved-UTC-timestamp>/','destinationCreated':False,
          'offHost':'NOT CONFIRMED','sameHostBackupIsOffHost':False}
save('capacity.json',capacity)

release=Path('/home/yangzhen/releases/uply-first-enable-20260910/source')
artifact=json.loads((ROOT/'docs/evidence/teaching-agent-stage-1f-r4a/release-integrity.json').read_text())
archive=Path(artifact['archivePath'])
current_build=(release/'.next/BUILD_ID').read_text().strip()
with tarfile.open(archive,'r:gz') as tar:
    member=next(m for m in tar.getmembers() if m.name.endswith('.next/BUILD_ID'))
    candidate_build=tar.extractfile(member).read().decode().strip()
frozen=json.loads((ROOT/'docs/evidence/teaching-agent-stage-1f-r4/release-integrity.json').read_text())
frozen_inputs=frozen['sourceInputs']
changes=[name for name,value in frozen_inputs.items() if not (ROOT/name).is_file() or sha(ROOT/name)!=value]
manifest=json.loads((ROOT/'supabase/bootstrap/baseline-manifest.json').read_text())
migrations=[{'filename':m['filename'],'matches':sha(ROOT/'supabase/migrations'/m['filename'])==m['sha256']} for m in manifest['postBaselineMigrations']]
metadata=json.loads((ROOT/'docs/evidence/teaching-agent-stage-1f-r4a/release-metadata-manifest.json').read_text())
app={'knownGood':{'path':str(release),'exists':release.is_dir(),'buildId':current_build,'buildIdMatchesR3':current_build=='LuAZe2VMY32YjOo1WvtrC',
     'nextPackageVersion':json.loads((release/'node_modules/next/package.json').read_text())['version'],
     'nodeModulesSymlink':(release/'node_modules').is_symlink(),'nodeModulesResolved':str((release/'node_modules').resolve()),
     'requiredServerFilesExists':(release/'.next/required-server-files.json').is_file(),
     'releaseDirectoryWritableInCurrentSandbox':os.access(release,os.W_OK),
     'rollbackExecutionAuthorized':False,'fullHistoricalBinaryDigestAvailable':False},
     'r3dCandidate':{'path':str(archive),'exists':archive.is_file(),'bytes':archive.stat().st_size,'sha256':sha(archive),
     'archiveHashMatchesR4A':sha(archive)==artifact['archiveSHA256'],'buildId':candidate_build,'deployed':False},
     'currentSourceFilesChecked':len(frozen_inputs),'changedFrozenSourceFiles':changes,
     'migrationChecks':migrations,'releaseMetadataDigestMatches':digest(metadata['payload'])==metadata['metadataDigest'],
     'fullDependenciesSealed':False,'startedOrReplacedRelease':False}
save('application-inventory.json',app)
print(json.dumps({'backups':len(records),'latestFullBackup':latest['path'],'ageHours':latest['ageHoursAtInventory'],
                  'availableBytes':capacity['availableBytes'],'application':app},ensure_ascii=False,indent=2))
