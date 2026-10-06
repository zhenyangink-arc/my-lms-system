# TASK — Selected teaching video intake

## Identity
TASK ID: COURSE-VIDEO-SELECTED-ASSET-15
TITLE: Inspect and bind the user-selected sample01.mp4 for the course video pilot
STATUS: COMPLETED — selected asset technical intake PASS; production binding NOT VALIDATED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — read-only media inspection and intake, no runtime or public contract changes
VERIFICATION PROFILE: NOT_REQUIRED — no implementation; Supervisor reviews actual metadata and representative frames
MODEL ROUTING REASON: Bounded local media inspection, modest judgment about teaching-content suitability.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User explicitly selected /home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4 for the video pilot. Confirm immutable file identity, technical decode suitability and observed content. Produce a safe intake record identifying which further binding inputs are still unknown. Task14 consumer core is already independently validated (262+7 tests); do not redo it. Existing live chapter and old historical content remain untouched.

## Scope
WRITABLE SCOPE: one private /tmp/course-video-selected-asset-* directory; report/metadata and extracted representative JPEG frames only. Root owns this Task metadata.
READABLE DEPENDENCIES: selected exact source file; parent directory filenames for related subtitles/transcript only; directly corresponding non-secret metadata/transcript if clearly associated. Project AGENTS/CODEX_WORKER rules; completed COURSE-VIDEO-PUBLISHED-MEDIA-14 task for accepted boundaries.
FORBIDDEN: all repository edits, other-project source edits, modifying/moving/transcoding selected video, env/credentials, production DB/API/browser, media upload/publication, network/providers, package installs, generated video, research/recovery work, deleting avatar assets or changing old live entry.

## Contracts / Data
MAY CHANGE PUBLIC CONTRACT: NO
DATABASE IMPACT: NONE
RLS IMPACT: NO
AUTH IMPACT: NO
No actual publication or course draft database binding in this intake task. Source selection and diagnostic frames do not mean trusted runtime media registration.

## Requirements
1. stat, SHA256, ffprobe exact output; stable stat/hash before and after; use installed tools only.
2. Decode entire 30-second file to null with ffmpeg -v error -i exact-path -f null - if installed; capture rc/stderr, no production action.
3. Extract at most 6 representative frames at explicit timestamps within duration (e.g. 0,5,10,15,20,25s) into private dir. Inspect images via view_image. Do not edit imagery or run AI image generation.
4. Describe actual visible content and text, source timestamp provenance; distinguish observed visual facts from unverified narration. Do not invent a Korean transcript or lesson question. Check existing embedded subtitles and adjacent matching subtitle/transcript filenames only.
5. If sample contains unrelated media, say so. User selected it, so it remains usable as playback-interaction test material, but do not claim it is a Korean teaching video or pair with a falsely relevant graded question.
6. Recommend precise next binding inputs (duration/hash known; teaching transcript, real cue/Activity relevance, subtitles unknown where appropriate). No made-up cue times as formal teaching authority.
7. Do not copy MP4 into public/ or Git. Preserve all existing work. No new Task14 tests/typecheck needed.

## Acceptance / Validation
File exists, stable exact identity and metadata recorded; decode result actual; at most6 frames inspected; content/unknowns honestly classified; source unmodified; full Worker Report with commands and exits in private dir. Final source video not changed; no application/publication readiness claim.
TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION: NOT_REQUIRED.

## Parallelism
CAN RUN IN PARALLEL: NO need. Only this inspection worker. Shared repository has other accepted modifications; do not revert or clean them.

## Escalation
Missing tools: record rather than install. Unreadable/changed media: stop and report. Requirement for additional production writes/public contract or paid provider is outside scope.

## Worker Report
Follow CODEX_WORKER.md. Include selected absolute path, SHA, size/duration/video/audio/subtitle metadata, frame paths/timestamps and observations, decode receipt, no-mutation evidence, unverified content, next bounded action.


## Supervisor review / 素材选择记录

Decision: PASS — bounded source selection and technical intake only.
用户选择：使用本文件作为新视频播放模式的试点素材。不是新的数据库media登记、已发布课程或课程题目绑定。

Selected source: `/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4`
SHA256: `68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe`
Bytes: 5487747
Container duration: 30.016 s; video timeline: 30.000 s, 720 frames, 24 fps.
Video: H.264 High, 1280x720. Audio: AAC LC, 48 kHz, stereo.
Whole-file null decode: exit0, empty stderr. Source hash/stat stable before/after.

Root reviewed the Worker Report and directly inspected the 15-second frame: presenter facing the camera in a studio, no visible subtitle/text. Worker inspected 6 sampled frames; these are technical sampling times, not approved question cues. Language, narration/transcript, actual teaching objective and question relevance remain unknown. No embedded subtitle or adjacent matching subtitle found; no claim of no transcript elsewhere.

本轮做完的是：登记用户选定的原视频、检查文件完整性、保存文件指纹和画面检查结果。原片没改；没有上传、没有复制进public或Git、没有创建付费服务。
下一步：以该文件作为播放器试点内容，在后续可信接线与发布设计中使用其实际duration/content revision；核对讲解文本后再安排正式Activity和字幕时间轴。若只做播放交互演示，必须明确是演示题，不记作正式学习成绩。既有Task14独立通过的播放器核心不重复重写。当前线上旧入口与历史学习记录保持原状；旧形象停用仍待新入口验收。

No operational/source/test/config changes in this Task. Root Task metadata only. No browser/course preview, server/DB binding, upload/publication, provider calls, generation, commit/push or production operations.

RecordedAt: 2026-10-05T09:30:02.895368+00:00
Worker report: /tmp/course-video-selected-asset-84dy8f6n/WorkerReport.md
SHA256: 9c97ad824c53a952b03fc274f1605d81e717b51a93ad76a10f1dd88d5fc82ae2

## Retained metadata receipts

```json
{
  "identity-before.json": {
    "path": "/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4",
    "size": 5487747,
    "device": 66306,
    "inode": 2774630,
    "mode": "0o100664",
    "mtime_ns": 1789186849200571208,
    "ctime_ns": 1789186849200571208,
    "sha256": "68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe"
  },
  "identity-after.json": {
    "path": "/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4",
    "size": 5487747,
    "device": 66306,
    "inode": 2774630,
    "mode": "0o100664",
    "mtime_ns": 1789186849200571208,
    "ctime_ns": 1789186849200571208,
    "sha256": "68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe"
  },
  "ffprobe-receipt.json": {
    "command": [
      "/usr/bin/ffprobe",
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      "/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4"
    ],
    "exit_code": 0
  },
  "decode-receipt.json": {
    "command": [
      "/usr/bin/ffmpeg",
      "-v",
      "error",
      "-i",
      "/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4",
      "-f",
      "null",
      "-"
    ],
    "exit_code": 0,
    "stderr_bytes": 0
  }
}
```

## Embedded Worker Report

## WORKER REPORT

TASK ID: COURSE-VIDEO-SELECTED-ASSET-15
PROFILE: worker_medium | GPT-6.1 Sol medium (Task routing)
OBJECTIVE: Inspect exact user-selected source for local course-video pilot intake; identify trusted facts and missing binding inputs.

ACTUAL SCOPE:
Read exact source and parent matching subtitle/transcript filenames; read project agent/worker/task boundaries. Wrote only this private /tmp/course-video-selected-asset-84dy8f6n directory. No repository or source-video writes. No network, provider, publication, upload, production DB/API/browser, package installation, generated video or runtime/course binding.

SOURCE:
- Absolute path: /home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4
- SHA256: 68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe
- Size: 5,487,747 bytes.
- Container: MP4 / QuickTime, major_brand isom, compatible_brands isomiso2avc1mp41, encoder tag Google. Encoder metadata does not establish authorship or content provenance.
- Container duration 30.016 seconds, start 0, bitrate 1,462,619 bit/s.
- Video: H.264 High / avc1, 1280 x 720, yuv420p progressive, 24/1 fps, 720 frames, duration 30.000 seconds, bitrate 1,327,510 bit/s, language und.
- Audio: AAC LC, 48,000 Hz, stereo 2 channels, duration 30.016 seconds, bitrate 128,032 bit/s, language und. Audio decoded successfully; speech/language/content not listened to or transcribed.
- Subtitles: ffprobe lists only video index0 and audio index1; no embedded subtitle stream. Parent filename-only check found no directly matching adjacent subtitle/transcript/metadata candidate. This does not prove transcripts never exist elsewhere; no broader search performed.

CHANGES / FILES:
- identity-before.json / identity-after.json: complete stat identity and SHA256 receipts.
- ffprobe.stdout.json: exact ffprobe JSON stdout, unaltered.
- ffprobe.stderr.txt / ffprobe-receipt.json: exact stderr and command/exit.
- decode.stdout.txt / decode.stderr.txt / decode-receipt.json: exact full-decode output and command/exit.
- tools.json / adjacent-matching-files.json: installed tool paths and matching filenames.
- frame-00s.jpg, frame-05s.jpg, frame-10s.jpg, frame-15s.jpg, frame-20s.jpg, frame-25s.jpg: exactly six extracted source frames, no imagery edits.
- frame-receipts.json: exact extraction commands, requested source timestamps, image hashes, stderr and exits.
- frame-observations.json: actual view_image observations for all six frames.
- Commands.json: command receipt index.
- WorkerReport.md: this report; Manifest.json: artifact hashes (excluding itself).
- Directory mode0700; every artifact mode0600.

OBSERVED CONTENT:
All six images were actually inspected via view_image. Same person with long dark hair, dark blazer/light top and clip-on microphone faces the camera, hands clasped; pale photography/studio backdrop with equipment edges and small white four-point symbol at lower-right. Sampled facial/mouth expressions vary. No readable on-screen text, Korean lettering, subtitles, slides, equations or instructional diagrams observed in these samples. This is a presenter-style clip visually, but its subject, identity, narration, spoken language and pedagogical purpose cannot be inferred from appearance or encoder tags. Neither verified Korean teaching content nor verified unrelated subject matter. Remains usable as user-selected playback-interaction test material.

FRAME TIMESTAMP PROVENANCE:
Timestamps 0,5,10,15,20,25 seconds are diagnostic sampling offsets from source start0, explicitly selected within video duration30s. ffmpeg input -ss with one decoded 0:v:0 frame per command; 24 fps source has a frame at each integer-second sampling offset. These sampling offsets are not approved teaching cues or completion authority. Exact extracted-frame receipts and hashes are recorded. Frame-by-frame observations:
- 0s: /tmp/course-video-selected-asset-84dy8f6n/frame-00s.jpg — Person with long dark hair, dark blazer and light top, facing camera with clasped hands; pale studio background and small white four-point symbol near lower-right. No readable text or subtitle visible.
- 5s: /tmp/course-video-selected-asset-84dy8f6n/frame-05s.jpg — Same presenter and studio framing; mouth open and eyes closed in this sampled instant. No readable text or subtitle visible.
- 10s: /tmp/course-video-selected-asset-84dy8f6n/frame-10s.jpg — Same presenter and studio framing; mouth closed, eyes closed in this sampled instant. No readable text or subtitle visible.
- 15s: /tmp/course-video-selected-asset-84dy8f6n/frame-15s.jpg — Same presenter and studio framing; mouth rounded/open. No readable text or subtitle visible.
- 20s: /tmp/course-video-selected-asset-84dy8f6n/frame-20s.jpg — Same presenter and studio framing; smiling with mouth closed. No readable text or subtitle visible.
- 25s: /tmp/course-video-selected-asset-84dy8f6n/frame-25s.jpg — Same presenter and studio framing; smiling with mouth open and hands lower. No readable text or subtitle visible.

VALIDATION / TEST RESULTS:
- stat/hash before and after: exact dictionaries equal, including size, device66306, inode2774630, mode0o100664, mtime_ns1789186849200571208, ctime_ns1789186849200571208 and SHA256. Source byte identity and these stat fields unchanged; access time not used as mutation criterion. Python receipt-producing commands exit0.
- Command: /usr/bin/ffprobe -v error -show_format -show_streams -of json /home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4
  Result: 2 streams, metadata above; empty stderr. Exit code: 0.
- Command: /usr/bin/ffmpeg -v error -i /home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4 -f null -
  Result: Entire source decoded to null, both default video/audio selected, empty stdout/stderr; stderr_bytes0. Exit code: 0.
- Commands (six, exact argv retained in frame-receipts.json): /usr/bin/ffmpeg -v error -ss T -i /home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4 -map 0:v:0 -frames:v 1 -q:v 2 /tmp/course-video-selected-asset-84dy8f6n/frame-TTs.jpg, T=0,5,10,15,20,25.
  Result: Exactly six JPEGs created; all stderr empty. Exit codes: 0,0,0,0,0,0.
- view_image: All six paths succeeded and were visually reviewed; tool success has no shell exit code.
- No repository command edited files; every output command target is this private directory or null. Existing source/runtime work preserved. No MP4 copy into public/ or Git.

NOT RUN / NOT VALIDATED:
- Narration/language/audio transcript or comprehensive visual chronology; only six sampled frames observed.
- Browser playback, cross-browser compatibility, video control integration, actual cue pause/seek/submit/readback.
- Course/Activity pedagogical relevance, graded question/answer keys, published identities, trusted media registration, production services, DB binding and release readiness.
- Task14 tests, typecheck/lint/unit/integration/E2E/migration, full suite and build: explicitly not required for this read-only intake, not repeated.

NEXT BOUNDED INPUTS:
1. Source duration, size, codecs and immutable SHA256 are now known. Preserve this exact source identity in later authorized intake; a different hash requires reinspection.
2. Obtain user-confirmed transcript/script and narration language, ideally with source-linked timestamps, or explicitly authorized local transcription in a separate task. No missing content or Korean lesson text is inferred here.
3. Confirm actual teaching objective and target course chapter/Activity relevance against that transcript. Content-author approved cue positions must reference actual teaching segments; 0/5/10/15/20/25 sampling offsets must never become formal cues by default.
4. If relevant: approved Activity revision, options/answer semantics and completion policy, plus genuine media reference and trusted publication/session/scope identities from future authorized platform boundary. If relevance is absent, use this only for isolated playback interaction testing with clearly nonformal demonstration interactions.
5. Supply source-matched subtitle file/timing if subtitles are intended; current embedded/adjacent matching subtitle evidence is absent. Separate runtime/publication design and authorization remain necessary; this report does not install or authorize them.

ISSUES: No technical inspection failure. Teaching content/transcript/relevance and trusted binding inputs remain unknown.
RISKS: Decodability alone does not establish lesson suitability, browser/runtime integration, rights/provenance or trusted publication readiness. No formal scoring question or cue authority manufactured.
SCOPE CHANGE: None.
ESCALATION: None.
CONCLUSION: COMPLETED — bounded technical/visual intake only. Source unmodified, full null decode PASS, six samples inspected. Application/publication/teaching readiness NOT VALIDATED.
