"""Private fixture copy only; no test route/bypass is installed in product source."""
import json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
d=pathlib.Path(sys.argv[1]);dest=d/'next'
result=json.loads((d/'candidate-build-result.json').read_text())
if result['exit'] or result['instrumented']:raise ValueError('ORIGINAL_BUILD_REQUIRED')
subprocess.run(['python3',str(ROOT/'scripts/teaching-agent-r2/next.py'),'instrument',str(d)],check=True)
(dest/'src/app/r2-lesson/page.tsx').unlink()
(dest/'src/app/r2-lesson').rmdir()
p=dest/'src/instrumentation-r2-node.ts';s=p.read_text()
s=s.replace("};sync();fs.watchFile(d+'/control.json',{interval:100},sync);", "};if(process.env.UPLY_R3_STARTUP_ONLY!=='1'){sync();fs.watchFile(d+'/control.json',{interval:100},sync);}")
p.write_text(s)
print(json.dumps({'privateRouteRemoved':True,'formalRouteUnchanged':True,'startupOnlyModeAvailable':True}))
