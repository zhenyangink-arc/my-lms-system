import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const textbookSlug = "korean-level-one-smart";
const outputRoot = path.join(tmpdir(), "smart-textbook-listening");
const dryRun = process.argv.includes("--dry-run");
const requestedChapters = new Set(
  (process.argv.find((argument) => argument.startsWith("--chapters="))?.split("=")[1] ?? "")
    .split(",")
    .filter((value) => value.trim() !== "")
    .map(Number)
    .filter(Number.isInteger),
);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function objectUrl(accountId, bucketName, objectKey) {
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucketName)}/${encodedKey}`;
}

function spokenTranscript(transcript) {
  return transcript
    .replace(/(^|\s)[가-힣A-Za-z0-9 ]{1,12}:\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function generateAudio({ text, filePath, rate, voice }) {
  await run("python3", [
    "-m",
    "edge_tts",
    "--voice",
    voice,
    `--rate=${rate}`,
    "--text",
    spokenTranscript(text),
    "--write-media",
    filePath,
  ], { ...process.env, PYTHONPATH: "/tmp/lms-edge-tts" });
}

async function uploadR2({ signer, accountId, bucketName, objectKey, filePath }) {
  const body = await readFile(filePath);
  const request = await signer.sign(new Request(objectUrl(accountId, bucketName, objectKey), {
    method: "PUT",
    headers: { "Content-Type": "audio/mpeg" },
    body,
  }));
  const response = await fetch(request);
  if (!response.ok) throw new Error(`R2 upload failed (${response.status}) for ${objectKey}`);
}

function unwrapSingle(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucketName = requiredEnv("R2_BUCKET_NAME");
  const signer = new AwsClient({
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });

  const { data: textbook, error: textbookError } = await supabase
    .from("digital_textbooks")
    .select("id")
    .eq("slug", textbookSlug)
    .single();
  if (textbookError) throw textbookError;
  const { data: version, error: versionError } = await supabase
    .from("digital_textbook_versions")
    .select("id")
    .eq("textbook_id", textbook.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  if (versionError) throw versionError;
  const { data: chapters, error: chaptersError } = await supabase
    .from("digital_textbook_chapters")
    .select("id,chapter_number")
    .eq("version_id", version.id)
    .gte("chapter_number", 1)
    .lte("chapter_number", 16);
  if (chaptersError) throw chaptersError;
  const chapterById = new Map((chapters ?? []).map((chapter) => [chapter.id, Number(chapter.chapter_number)]));
  const { data: modules, error: modulesError } = await supabase
    .from("digital_textbook_modules")
    .select("id,chapter_id")
    .in("chapter_id", [...chapterById.keys()]);
  if (modulesError) throw modulesError;
  const chapterByModuleId = new Map((modules ?? []).map((module) => [module.id, chapterById.get(module.chapter_id)]));
  const { data: nodes, error: nodesError } = await supabase
    .from("digital_textbook_nodes")
    .select("id,module_id")
    .in("module_id", [...chapterByModuleId.keys()]);
  if (nodesError) throw nodesError;
  const chapterByNodeId = new Map((nodes ?? []).map((node) => [node.id, chapterByModuleId.get(node.module_id)]));
  const { data: activities, error: activitiesError } = await supabase
    .from("digital_textbook_activities")
    .select("id,node_id,activity_key,public_config")
    .in("node_id", [...chapterByNodeId.keys()])
    .eq("activity_type", "listening");
  if (activitiesError) throw activitiesError;
  const activityIds = (activities ?? []).map((activity) => activity.id);
  const [{ data: secrets, error: secretsError }, { data: media, error: mediaError }] = await Promise.all([
    supabase.from("digital_textbook_activity_secrets").select("activity_id,transcript_ko,audio_object_key").in("activity_id", activityIds),
    supabase.from("digital_textbook_media_assets").select("id,activity_id,asset_key,object_key,media_type").in("activity_id", activityIds),
  ]);
  if (secretsError) throw secretsError;
  if (mediaError) throw mediaError;
  const secretByActivityId = new Map((secrets ?? []).map((secret) => [secret.activity_id, secret]));
  const mediaByActivityId = Map.groupBy(media ?? [], (asset) => asset.activity_id);

  if (dryRun) {
    console.log(`Manifest rows: chapters=${chapterById.size}, modules=${chapterByModuleId.size}, nodes=${chapterByNodeId.size}, listening=${activities?.length ?? 0}`);
  }

  const selected = (activities ?? [])
    .map((activity) => ({
      ...activity,
      chapterNumber: Number(chapterByNodeId.get(activity.node_id)),
      secret: secretByActivityId.get(activity.id),
      media: mediaByActivityId.get(activity.id) ?? [],
    }))
    .filter((activity) => Number.isInteger(activity.chapterNumber))
    .filter((activity) => requestedChapters.size === 0 || requestedChapters.has(activity.chapterNumber))
    .sort((left, right) => left.chapterNumber - right.chapterNumber);

  for (const activity of selected) {
    const secret = unwrapSingle(activity.secret) ?? {};
    const { data: existingTracks, error: trackError } = await supabase
      .from("digital_textbook_listening_tracks")
      .select("page_index,transcript_ko,audio_object_key")
      .eq("activity_id", activity.id)
      .order("page_index");
    if (trackError) throw trackError;
    const audioAssets = (activity.media ?? []).filter((asset) => asset.media_type === "audio");
    const normalAsset = audioAssets.find((asset) => asset.asset_key.endsWith("-normal"));
    const slowAsset = audioAssets.find((asset) => asset.asset_key.endsWith("-slow"));
    const baseTranscript = String(secret.transcript_ko ?? "").trim();
    const tracks = [0, 1].map((pageIndex) => {
      const existing = existingTracks?.find((track) => track.page_index === pageIndex);
      const media = pageIndex === 0 ? normalAsset : slowAsset;
      return {
        pageIndex,
        transcript: String(existing?.transcript_ko ?? baseTranscript).trim(),
        objectKey: String(existing?.audio_object_key ?? media?.object_key ?? "").trim(),
        media,
      };
    });
    if (tracks.some((track) => !track.transcript || !track.objectKey)) {
      throw new Error(`Chapter ${activity.chapterNumber} has an incomplete listening manifest`);
    }

    console.log(`${dryRun ? "CHECK" : "BUILD"} chapter ${activity.chapterNumber}: ${activity.activity_key}`);
    if (dryRun) continue;

    for (const track of tracks) {
      const suffix = track.pageIndex === 0 ? "normal" : "slow";
      const filePath = path.join(outputRoot, `chapter-${String(activity.chapterNumber).padStart(2, "0")}-${suffix}.mp3`);
      await generateAudio({
        text: track.transcript,
        filePath,
        rate: track.pageIndex === 0 || activity.chapterNumber === 1 ? "-8%" : "-24%",
        voice: activity.chapterNumber % 2 === 0 ? "ko-KR-InJoonNeural" : "ko-KR-SunHiNeural",
      });
      await uploadR2({ signer, accountId, bucketName, objectKey: track.objectKey, filePath });
      const { error: trackUpsertError } = await supabase
        .from("digital_textbook_listening_tracks")
        .upsert({
          activity_id: activity.id,
          page_index: track.pageIndex,
          transcript_ko: track.transcript,
          audio_object_key: track.objectKey,
          audio_status: "ready",
        }, { onConflict: "activity_id,page_index" });
      if (trackUpsertError) throw trackUpsertError;
      if (track.media?.id) {
        const { error: mediaError } = await supabase
          .from("digital_textbook_media_assets")
          .update({ production_status: "ready" })
          .eq("id", track.media.id);
        if (mediaError) throw mediaError;
      }
    }

    const nextConfig = {
      ...(activity.public_config ?? {}),
      audioStatus: "ready",
      tracks: tracks.map((track) => ({
        id: `track-${String(track.pageIndex + 1).padStart(2, "0")}`,
        label: activity.chapterNumber === 1
          ? track.pageIndex === 0 ? "自我介绍" : "双人对话"
          : track.pageIndex === 0 ? "正常语速" : "慢速",
        audioId: path.basename(track.objectKey, ".mp3"),
        status: "ready",
      })),
    };
    const { error: activityError } = await supabase
      .from("digital_textbook_activities")
      .update({ public_config: nextConfig })
      .eq("id", activity.id);
    if (activityError) throw activityError;
    const { error: secretError } = await supabase
      .from("digital_textbook_activity_secrets")
      .update({
        audio_object_key: tracks[0].objectKey,
        audio_status: "ready",
      })
      .eq("activity_id", activity.id);
    if (secretError) throw secretError;
  }

  console.log(`Completed ${selected.length} listening activities.`);
}

await main();
