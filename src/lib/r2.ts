import { AwsClient } from "aws4fetch";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getSigningContext() {
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
  const bucketName = getRequiredEnv("R2_BUCKET_NAME");
  const signedUrlExpiresIn = Number(process.env.R2_SIGNED_URL_EXPIRES_IN ?? "3600");

  if (!Number.isInteger(signedUrlExpiresIn) || signedUrlExpiresIn < 1 || signedUrlExpiresIn > 604800) {
    throw new Error("R2_SIGNED_URL_EXPIRES_IN must be between 1 and 604800 seconds");
  }

  const signer = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });

  return { accountId, bucketName, signedUrlExpiresIn, signer };
}

function encodeObjectKey(objectKey: string) {
  return objectKey.split("/").map(encodeURIComponent).join("/");
}

function createObjectUrl(accountId: string, bucketName: string, objectKey: string) {
  return new URL(
    `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucketName)}/${encodeObjectKey(objectKey)}`,
  );
}

async function createSignedUrl(
  method: "GET" | "PUT",
  objectKey: string,
  options: {
    contentType?: string;
    responseContentDisposition?: string;
  } = {},
) {
  const { accountId, bucketName, signedUrlExpiresIn, signer } = getSigningContext();
  const url = createObjectUrl(accountId, bucketName, objectKey);
  url.searchParams.set("X-Amz-Expires", String(signedUrlExpiresIn));
  if (options.responseContentDisposition) {
    url.searchParams.set("response-content-disposition", options.responseContentDisposition);
  }

  const signedRequest = await signer.sign(
    new Request(url, {
      method,
      headers: options.contentType ? { "Content-Type": options.contentType } : undefined,
    }),
    { aws: { signQuery: true } },
  );

  return signedRequest.url;
}

async function fetchSignedObject(method: "HEAD" | "DELETE", objectKey: string) {
  const { accountId, bucketName, signer } = getSigningContext();
  const signedRequest = await signer.sign(
    new Request(createObjectUrl(accountId, bucketName, objectKey), { method }),
  );

  return fetch(signedRequest);
}

export async function createR2SignedVideoUrl(objectKey: string) {
  return createR2SignedObjectUrl(objectKey);
}

export async function createR2SignedObjectUrl(objectKey: string) {
  return createSignedUrl("GET", objectKey);
}

export async function createR2SignedUploadUrl(
  objectKey: string,
  contentType: string,
  contentLength?: number,
) {
  if (contentLength !== undefined && (!Number.isInteger(contentLength) || contentLength < 1)) {
    throw new Error("R2 upload content length must be a positive integer");
  }

  return createSignedUrl("PUT", objectKey, { contentType });
}

export async function createR2SignedResourceDownloadUrl(
  objectKey: string,
  originalFileName: string,
) {
  const encodedFileName = encodeURIComponent(originalFileName);
  const contentDisposition = `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`;

  return createSignedUrl("GET", objectKey, {
    responseContentDisposition: contentDisposition,
  });
}

export async function assertR2ObjectUpload(objectKey: string, expectedSize: number) {
  const response = await fetchSignedObject("HEAD", objectKey);

  if (response.status === 404) throw new Error("R2 upload was not found");
  if (!response.ok) {
    throw new Error(`R2 upload validation failed with status ${response.status}`);
  }

  const actualSize = Number(response.headers.get("content-length"));
  if (!Number.isSafeInteger(actualSize) || actualSize !== expectedSize) {
    throw new Error(`R2 upload size mismatch: expected ${expectedSize}, received ${actualSize}`);
  }
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** S3-compatible `ListObjectsV2` returns XML, and this runs server-side where
 * there's no DOM parser available — the response shape is small, stable, and
 * fully within our control (we're the only caller), so a couple of targeted
 * regexes are simpler than pulling in an XML library for one call site. */
function parseListObjectsXml(xml: string) {
  const objects = Array.from(xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)).map((match) => {
    const block = match[1];
    const key = decodeXmlEntities(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? "");
    const size = Number(block.match(/<Size>([\s\S]*?)<\/Size>/)?.[1] ?? 0);
    const lastModified = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? "";
    return { key, size: Number.isFinite(size) ? size : 0, lastModified };
  });
  const isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  return { objects, isTruncated };
}

/** Lists objects under a prefix — used to let an admin browse/pick from
 * files someone already placed in R2, rather than typing an object key from
 * memory. `maxKeys` caps at 1000 (S3's own per-request maximum); this app's
 * media prefixes are small enough that a single page comfortably covers
 * everything, so this doesn't implement multi-page continuation — a caller
 * that gets `isTruncated: true` back just knows there's more than fit. */
export async function listR2Objects(prefix: string, maxKeys = 1000) {
  const { accountId, bucketName, signer } = getSigningContext();
  const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucketName)}`);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", prefix);
  url.searchParams.set("max-keys", String(Math.max(1, Math.min(1000, maxKeys))));

  const signedRequest = await signer.sign(new Request(url, { method: "GET" }));
  const response = await fetch(signedRequest);
  if (!response.ok) {
    throw new Error(`R2 list failed with status ${response.status}`);
  }
  return parseListObjectsXml(await response.text());
}

/** Checks whether an object already placed in R2 (by some process other than
 * this app's own upload flow) actually exists, without knowing its expected
 * size ahead of time — unlike assertR2ObjectUpload, which validates a just-
 * completed upload against a known size. */
export async function checkR2ObjectExists(objectKey: string) {
  const response = await fetchSignedObject("HEAD", objectKey);
  if (response.status === 404) return { exists: false as const };
  if (!response.ok) {
    throw new Error(`R2 object check failed with status ${response.status}`);
  }
  const size = Number(response.headers.get("content-length"));
  const contentType = response.headers.get("content-type") ?? undefined;
  return {
    exists: true as const,
    size: Number.isSafeInteger(size) ? size : undefined,
    contentType,
  };
}

export async function deleteR2Object(objectKey: string) {
  const response = await fetchSignedObject("DELETE", objectKey);

  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 object deletion failed with status ${response.status}`);
  }
}
