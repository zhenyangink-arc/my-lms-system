import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const tableByKind = {
  category: "course_categories",
  course: "courses",
  lesson: "lessons",
  chapter: "course_chapters",
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function objectUrl(accountId, bucketName, objectKey) {
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucketName)}/${encodedKey}`;
}

const [kind, entityId, filePath, title, version = "v1"] = process.argv.slice(2);
const table = tableByKind[kind];
if (!table || !entityId || !filePath || !title) {
  throw new Error(
    "Usage: node scripts/publish-course-cover.mjs <kind> <entity-id> <file> <title> [version]",
  );
}

const fileInfo = await stat(filePath);
if (!fileInfo.isFile() || fileInfo.size < 1 || fileInfo.size > 5 * 1024 * 1024) {
  throw new Error("Cover must be a non-empty file no larger than 5 MB");
}

const fileName = basename(filePath).replace(/[^a-zA-Z0-9._-]/g, "-");
const objectKey = `course-covers/${kind}/${entityId}/${version}-${fileName}`;
const accountId = requiredEnv("R2_ACCOUNT_ID");
const bucketName = requiredEnv("R2_BUCKET_NAME");
const signer = new AwsClient({
  accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
  secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});
const body = await readFile(filePath);
const request = await signer.sign(
  new Request(objectUrl(accountId, bucketName, objectKey), {
    method: "PUT",
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body,
  }),
);
const response = await fetch(request);
if (!response.ok) throw new Error(`R2 upload failed with status ${response.status}`);

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);
const { error } = await supabase
  .from(table)
  .update({
    cover_object_key: objectKey,
    cover_alt: `${title}课程封面`,
    cover_focal_point: "center",
  })
  .eq("id", entityId);
if (error) throw error;

console.log(JSON.stringify({ table, entityId, objectKey, bytes: fileInfo.size }));
