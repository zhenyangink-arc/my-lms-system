import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AwsClient } from "aws4fetch";

import {
  LEARNING_AGENT_BUFFER_PRESETS,
  learningAgentBufferPresetObjectKey,
} from "../src/lib/learning-agent-buffer-presets.ts";

const voices = { "zh-CN": "zh-CN-XiaoxiaoNeural", "ko-KR": "ko-KR-SunHiNeural" };

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || "/tmp/lms-edge-tts-314" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`)));
  });
}

function objectUrl(accountId, bucketName, objectKey) {
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucketName)}/${encodedKey}`;
}

const accountId = requiredEnv("R2_ACCOUNT_ID");
const bucketName = requiredEnv("R2_BUCKET_NAME");
const signer = new AwsClient({
  accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
  secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});
const workDir = join(tmpdir(), `teacher-kim-buffer-presets-${process.pid}`);
await mkdir(workDir, { recursive: true });

try {
  for (const preset of LEARNING_AGENT_BUFFER_PRESETS) {
    for (const locale of ["zh-CN", "ko-KR"]) {
      const output = join(workDir, `${preset.id}-${locale}.mp3`);
      const cues = join(workDir, `${preset.id}-${locale}.json`);
      await run("python3", [
        "scripts/generate-teacher-kim-speech.py",
        "--text", preset.text[locale],
        "--voice", voices[locale],
        "--rate", "+0%",
        "--output", output,
        "--cues", cues,
      ]);
      const objectKey = learningAgentBufferPresetObjectKey(preset.id, locale);
      const body = await readFile(output);
      const request = await signer.sign(new Request(objectUrl(accountId, bucketName, objectKey), {
        method: "PUT",
        headers: { "Content-Type": "audio/mpeg" },
        body,
      }));
      const response = await fetch(request);
      if (!response.ok) throw new Error(`R2 upload failed (${response.status}) for ${objectKey}`);
      const headRequest = await signer.sign(new Request(objectUrl(accountId, bucketName, objectKey), { method: "HEAD" }));
      const verified = await fetch(headRequest);
      if (!verified.ok || Number(verified.headers.get("content-length")) !== body.byteLength) {
        throw new Error(`R2 verification failed for ${objectKey}`);
      }
      process.stdout.write(`ready ${preset.id} ${locale}\n`);
    }
  }
} finally {
  await rm(workDir, { recursive: true, force: true });
}
