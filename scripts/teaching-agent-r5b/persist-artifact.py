"""Copy only the exact approved artifact to a new persistent directory; never deploy."""
import hashlib,json,os,stat,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path('/tmp/uply-r3d-release-candidate/candidate-build.tar.gz')
DEST=Path('/home/yangzhen/artifacts/uply-teaching-agent-foundation-r3d')
LOCK='1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28'
BUILD='6IhDHN8Dm1nCewiCEZnV5'
def digest(fd):
 os.lseek(fd,0,os.SEEK_SET);h=hashlib.sha256()
 while data:=os.read(fd,1024*1024):h.update(data)
 return h.hexdigest()
def main():
 os.umask(0o077)
 # No symlink traversal or replacement of any release.
 for p in reversed(DEST.parents):
  if not p.exists():p.mkdir(mode=0o700)
  if p.is_symlink() or not p.is_dir():raise RuntimeError('UNSAFE_PARENT')
  if p!=Path('/') and p.stat().st_mode & 0o022:raise RuntimeError('WRITABLE_PARENT')
 source=os.open(SOURCE,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  source_stat=os.fstat(source)
  if not stat.S_ISREG(source_stat.st_mode) or digest(source)!=LOCK:raise RuntimeError('SOURCE_DRIFT')
  DEST.mkdir(mode=0o700) # exist_ok deliberately false: do not overwrite.
  target=DEST/SOURCE.name
  fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  try:
   os.lseek(source,0,os.SEEK_SET)
   while data:=os.read(source,1024*1024):
    view=memoryview(data)
    while view: view=view[os.write(fd,view):]
   os.fsync(fd)
  finally:os.close(fd)
  verify=os.open(target,os.O_RDONLY|os.O_NOFOLLOW)
  try:assert digest(verify)==LOCK
  finally:os.close(verify)
  assert digest(source)==LOCK and os.fstat(source).st_size==source_stat.st_size
  with tarfile.open(target,'r:gz') as archive:
   members=archive.getmembers();names=[m.name for m in members]
   assert len(names)==len(set(names))
   assert all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in names)
   assert all(m.isfile() or m.isdir() for m in members)
   for m in members:
    if m.isfile():
     with archive.extractfile(m) as f:
      while f.read(1024*1024):pass
   assert archive.extractfile('.next/BUILD_ID').read().decode().strip()==BUILD
  receipt={'status':'READY','candidateDurability':'PERSISTENT','source':str(SOURCE),'destination':str(target),'sourceRegular':True,'sourceSymlink':False,'sourceSha256':LOCK,'destinationSha256':LOCK,'bytes':target.stat().st_size,'buildId':BUILD,'fsyncFile':True,'fsyncDirectory':True,'archiveReadable':True,'sourceRetained':SOURCE.exists(),'existingReleaseOverwritten':False}
  metadata=DEST/'artifact-seal.json'
  with metadata.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
  for p in (DEST,DEST.parent):
   dfd=os.open(p,os.O_RDONLY|os.O_DIRECTORY)
   try:os.fsync(dfd)
   finally:os.close(dfd)
  (ROOT/'docs/evidence/teaching-agent-stage-1f-r5b/persistent-artifact.json').write_text(json.dumps(receipt,indent=2)+'\n')
  print(json.dumps(receipt))
 finally:os.close(source)
if __name__=='__main__':main()
