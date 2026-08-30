import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

import { stripRichText } from "../src/lib/rich-teaching-text.ts";

const VOICES = {
  "zh-CN": "zh-CN-XiaoxiaoNeural",
  "ko-KR": "ko-KR-SunHiNeural",
};
const LOCALES = ["zh-CN", "ko-KR"];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve(stdout.trim())
      : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`)));
  });
}

function localized(value, locale) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String(value[locale] ?? value["zh-CN"] ?? "").trim();
}

function teacherScriptSegments(value, locale) {
  const content = localized(value, locale);
  return content.split(/\n\s*\n/).map((segment) => segment.trim()).filter(Boolean);
}

function scriptPerformance(configuration, segmentIndex) {
  const value = Array.isArray(configuration?.scriptPerformances)
    ? configuration.scriptPerformances[segmentIndex]
    : null;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function edgeRate(value) {
  const percent = Math.round((Math.max(0.75, Math.min(1.25, Number(value) || 1)) - 1) * 100);
  return `${percent >= 0 ? "+" : ""}${percent}%`;
}

function chunkLanguage(character, locale, lastLanguage) {
  if (/\p{Script=Hangul}/u.test(character)) return "ko-KR";
  if (/\p{Script=Han}/u.test(character) || /[A-Za-z0-9]/.test(character)) return "zh-CN";
  return lastLanguage ?? locale;
}

function splitBySpokenLanguage(text, locale) {
  const chunks = [];
  let currentLanguage = null;
  let currentText = "";
  for (const character of Array.from(text)) {
    const language = chunkLanguage(character, locale, currentLanguage);
    if (currentLanguage && language !== currentLanguage) {
      chunks.push({ language: currentLanguage, text: currentText });
      currentText = "";
    }
    currentLanguage = language;
    currentText += character;
  }
  if (currentText) chunks.push({ language: currentLanguage ?? locale, text: currentText });
  return chunks.filter((chunk) => chunk.text.trim());
}

function objectUrl(accountId, bucketName, objectKey) {
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucketName)}/${encodedKey}`;
}

async function uploadAndVerify({ signer, accountId, bucketName, objectKey, filePath }) {
  const body = await readFile(filePath);
  const url = objectUrl(accountId, bucketName, objectKey);
  const upload = await signer.sign(new Request(url, {
    method: "PUT",
    headers: { "Content-Type": "audio/mpeg" },
    body,
  }));
  const uploaded = await fetch(upload);
  if (!uploaded.ok) throw new Error(`R2 upload failed (${uploaded.status}) for ${objectKey}`);
  const head = await signer.sign(new Request(url, { method: "HEAD" }));
  const verified = await fetch(head);
  if (!verified.ok || Number(verified.headers.get("content-length")) !== body.byteLength) {
    throw new Error(`R2 verification failed for ${objectKey}`);
  }
}

async function durationMs(filePath) {
  const output = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath,
  ]);
  return Math.max(1, Math.round(Number(output) * 1000));
}

async function generateSegment({ workDir, node, locale, segmentIndex, text }) {
  const performance = scriptPerformance(node.configuration, segmentIndex);
  const chunks = splitBySpokenLanguage(text, locale);
  const rate = edgeRate(performance.voiceRate);
  const generated = [];
  let characterOffset = 0;

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const prefix = `${locale}-${segmentIndex}-${chunkIndex}`;
    const audioPath = join(workDir, `${prefix}.mp3`);
    const cuePath = join(workDir, `${prefix}.json`);
    await run("python3", [
      "scripts/generate-teacher-kim-speech.py",
      "--text", chunk.text,
      "--voice", VOICES[chunk.language],
      "--rate", rate,
      "--output", audioPath,
      "--cues", cuePath,
    ], { env: process.env });
    const chunkDuration = await durationMs(audioPath);
    const rawCues = JSON.parse(await readFile(cuePath, "utf8"));
    generated.push({ ...chunk, audioPath, durationMs: chunkDuration, characterOffset, rawCues });
    characterOffset += chunk.text.length;
  }

  const outputPath = join(workDir, `${locale}-${segmentIndex}.mp3`);
  if (generated.length === 1) {
    await run("ffmpeg", ["-y", "-i", generated[0].audioPath, "-c", "copy", outputPath]);
  } else {
    const concatPath = join(workDir, `${locale}-${segmentIndex}-concat.txt`);
    await writeFile(concatPath, generated.map((chunk) => `file '${chunk.audioPath.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", outputPath]);
  }

  let elapsedMs = 0;
  const rawTimeline = [];
  for (const chunk of generated) {
    for (const cue of chunk.rawCues) {
      rawTimeline.push({
        startMs: elapsedMs + Number(cue.startMs),
        endMs: Math.min(elapsedMs + chunk.durationMs, elapsedMs + Number(cue.endMs)),
        charStart: chunk.characterOffset + Number(cue.charStart),
        charEnd: chunk.characterOffset + Number(cue.charEnd),
        text: String(cue.text),
      });
    }
    elapsedMs += chunk.durationMs;
  }
  const finalDurationMs = await durationMs(outputPath);
  const cueTimeline = rawTimeline.map((cue, index) => ({
    ...cue,
    charStart: index === 0 ? 0 : cue.charStart,
    charEnd: index === rawTimeline.length - 1
      ? text.length
      : Math.max(cue.charEnd, rawTimeline[index + 1].charStart),
  }));
  if (cueTimeline.length === 0) {
    cueTimeline.push({ startMs: 0, endMs: finalDurationMs, charStart: 0, charEnd: text.length, text });
  }
  return {
    outputPath,
    durationMs: finalDurationMs,
    cueTimeline,
    voiceManifest: {
      teacher: "UPLY 韩语-金老师",
      voices: [...new Set(generated.map((chunk) => VOICES[chunk.language]))],
      rate,
      mixedLanguage: generated.length > 1,
    },
  };
}

async function main() {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const signer = new AwsClient({
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  const r2 = {
    signer,
    accountId: requiredEnv("R2_ACCOUNT_ID"),
    bucketName: requiredEnv("R2_BUCKET_NAME"),
  };
  const { data: versions, error: versionError } = await supabase
    .from("learning_agent_script_versions")
    .select("id")
    .in("status", ["published", "draft"]);
  if (versionError) throw versionError;
  const versionIds = (versions ?? []).map((version) => version.id);
  if (!versionIds.length) throw new Error("No active learning-agent scripts found");
  const { data: nodes, error: nodeError } = await supabase
    .from("learning_agent_script_nodes")
    .select("id,node_key,teacher_script,configuration")
    .in("script_version_id", versionIds)
    .order("sort_order");
  if (nodeError) throw nodeError;
  const nodeIds = (nodes ?? []).map((node) => node.id);
  const { data: existingAssets, error: existingAssetError } = nodeIds.length
    ? await supabase
        .from("learning_agent_script_audio_assets")
        .select("script_node_id,locale,segment_index,content_hash,object_key,duration_ms,cue_timeline,voice_manifest,production_status")
        .in("script_node_id", nodeIds)
    : { data: [], error: null };
  if (existingAssetError) throw existingAssetError;
  const existingBySlot = new Map((existingAssets ?? []).map((asset) => [
    `${asset.script_node_id}:${asset.locale}:${asset.segment_index}`,
    asset,
  ]));
  const reusableByVoice = new Map();
  for (const asset of existingAssets ?? []) {
    if (asset.production_status !== "ready") continue;
    reusableByVoice.set(
      `${asset.locale}:${asset.content_hash}:${String(asset.voice_manifest?.rate ?? "+0%")}`,
      asset,
    );
  }

  const workRoot = join(tmpdir(), `teacher-kim-speech-${process.pid}`);
  await mkdir(workRoot, { recursive: true });
  let generatedCount = 0;
  let reusedCount = 0;
  let unchangedCount = 0;
  try {
    for (const node of nodes ?? []) {
      for (const locale of LOCALES) {
        const segments = teacherScriptSegments(node.teacher_script, locale);
        for (const [segmentIndex, rawText] of segments.entries()) {
          // Voice generation and its cache hash must never see [b]/[u]/[color]
          // markup: TTS would read the tags aloud, and formatting-only edits
          // must not invalidate already-generated audio.
          const text = stripRichText(rawText);
          const performance = scriptPerformance(node.configuration, segmentIndex);
          if (performance.voiceEnabled === false) continue;
          const contentHash = createHash("sha256").update(text, "utf8").digest("hex");
          const rate = edgeRate(performance.voiceRate);
          const slotKey = `${node.id}:${locale}:${segmentIndex}`;
          const directAsset = existingBySlot.get(slotKey);
          if (
            directAsset?.production_status === "ready"
            && directAsset.content_hash === contentHash
            && String(directAsset.voice_manifest?.rate ?? "+0%") === rate
          ) {
            unchangedCount += 1;
            process.stdout.write(`unchanged ${node.node_key} ${locale} ${segmentIndex}\n`);
            continue;
          }
          const reusable = reusableByVoice.get(`${locale}:${contentHash}:${rate}`);
          if (reusable) {
            const { error: reuseError } = await supabase
              .from("learning_agent_script_audio_assets")
              .upsert({
                script_node_id: node.id,
                locale,
                segment_index: segmentIndex,
                content_hash: reusable.content_hash,
                object_key: reusable.object_key,
                duration_ms: reusable.duration_ms,
                cue_timeline: reusable.cue_timeline,
                voice_manifest: reusable.voice_manifest,
                production_status: "ready",
              }, { onConflict: "script_node_id,locale,segment_index" });
            if (reuseError) throw reuseError;
            reusedCount += 1;
            process.stdout.write(`reused ${node.node_key} ${locale} ${segmentIndex}\n`);
            continue;
          }
          const segmentDir = join(workRoot, node.id, locale, String(segmentIndex));
          await mkdir(segmentDir, { recursive: true });
          const generated = await generateSegment({ workDir: segmentDir, node, locale, segmentIndex, text });
          const objectKey = `learning-agent/speech/teacher-kim/v1/${node.node_key}/${locale}/${segmentIndex}-${contentHash.slice(0, 16)}.mp3`;
          await uploadAndVerify({ ...r2, objectKey, filePath: generated.outputPath });
          const { error: upsertError } = await supabase
            .from("learning_agent_script_audio_assets")
            .upsert({
              script_node_id: node.id,
              locale,
              segment_index: segmentIndex,
              content_hash: contentHash,
              object_key: objectKey,
              duration_ms: generated.durationMs,
              cue_timeline: generated.cueTimeline,
              voice_manifest: generated.voiceManifest,
              production_status: "ready",
            }, { onConflict: "script_node_id,locale,segment_index" });
          if (upsertError) throw upsertError;
          generatedCount += 1;
          process.stdout.write(`ready ${node.node_key} ${locale} ${segmentIndex}\n`);
        }
      }
    }
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
  process.stdout.write(`Teacher Kim speech assets ready: generated ${generatedCount}, reused ${reusedCount}, unchanged ${unchangedCount}\n`);
}

await main();
