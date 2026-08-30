import { readFile, stat } from "node:fs/promises";

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

const [filePath, objectKey, contentType = "application/octet-stream", cacheControl] = process.argv.slice(2);
if (!filePath || !objectKey) {
  throw new Error("Usage: node scripts/publish-r2-object.mjs <file> <object-key> [content-type] [cache-control]");
}

const fileInfo = await stat(filePath);
if (!fileInfo.isFile() || fileInfo.size < 1) throw new Error("Upload file is empty");

const signer = new AwsClient({
  accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
  secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});
const url = objectUrl(requiredEnv("R2_ACCOUNT_ID"), requiredEnv("R2_BUCKET_NAME"), objectKey);
const body = await readFile(filePath);
const headers = { "Content-Type": contentType };
if (cacheControl) headers["Cache-Control"] = cacheControl;
const putRequest = await signer.sign(new Request(url, {
  method: "PUT",
  headers,
  body,
}));
const putResponse = await fetch(putRequest);
if (!putResponse.ok) throw new Error(`R2 upload failed with status ${putResponse.status}`);

const headRequest = await signer.sign(new Request(url, { method: "HEAD" }));
const headResponse = await fetch(headRequest);
if (!headResponse.ok) throw new Error(`R2 validation failed with status ${headResponse.status}`);
const uploadedSize = Number(headResponse.headers.get("content-length"));
if (uploadedSize !== fileInfo.size) {
  throw new Error(`R2 size mismatch: expected ${fileInfo.size}, received ${uploadedSize}`);
}
if (cacheControl && headResponse.headers.get("cache-control") !== cacheControl) {
  throw new Error("R2 cache-control validation failed");
}

console.log(JSON.stringify({ objectKey, size: uploadedSize, contentType, cacheControl }));
