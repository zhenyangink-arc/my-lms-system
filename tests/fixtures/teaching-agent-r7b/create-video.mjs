// Reproducible synthetic decoder/seek fixture, not course media or a production asset.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=480x270:rate=12','-t','30','-vf',"drawtext=text='DEVELOPMENT FIXTURE ONLY':fontcolor=white:fontsize=20:box=1:boxcolor=black:x=20:y=20",'-an','-c:v','libvpx','-b:v','160k','-g','12','-threads','2',fileURLToPath(new URL('./video.webm',import.meta.url))],{stdio:'inherit'});
