import { readFile, stat } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function objectUrl(accountId, bucketName, objectKey) {
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucketName)}/${encodedKey}`;
}

const [filePath, mediaId] = process.argv.slice(2);
if (!filePath || !mediaId) {
  throw new Error("Usage: node scripts/publish-smart-textbook-image.mjs <file> <media-id>");
}
const fileInfo = await stat(filePath);
if (!fileInfo.isFile() || fileInfo.size < 1) throw new Error("Image file is empty");

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);
const { data: media, error: mediaLookupError } = await supabase
  .from("digital_textbook_media_assets")
  .select("id,object_key,media_type,metadata")
  .eq("id", mediaId)
  .single();
if (mediaLookupError) throw mediaLookupError;
if (media.media_type !== "image") throw new Error("Target media row is not an image");

const accountId = requiredEnv("R2_ACCOUNT_ID");
const bucketName = requiredEnv("R2_BUCKET_NAME");
const signer = new AwsClient({
  accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
  secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});
const body = await readFile(filePath);
const contentType = filePath.endsWith(".webp") ? "image/webp" : "image/png";
const pngWidth = contentType === "image/png" ? body.readUInt32BE(16) : null;
const pngHeight = contentType === "image/png" ? body.readUInt32BE(20) : null;
const request = await signer.sign(new Request(objectUrl(accountId, bucketName, media.object_key), {
  method: "PUT",
  headers: { "Content-Type": contentType },
  body,
}));
const response = await fetch(request);
if (!response.ok) throw new Error(`R2 upload failed with status ${response.status}`);

const { error: updateError } = await supabase
  .from("digital_textbook_media_assets")
  .update({
    production_status: "ready",
    metadata: {
      ...(media.metadata ?? {}),
      source: "generated_course_scene",
      storage: "cloudflare_r2",
      ...(pngWidth && pngHeight ? { width: pngWidth, height: pngHeight } : {}),
      aspectRatio: "5:2",
    },
  })
  .eq("id", media.id);
if (updateError) throw updateError;

console.log(`Published ${media.object_key} (${fileInfo.size} bytes)`);
