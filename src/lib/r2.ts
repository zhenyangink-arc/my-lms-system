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

export async function deleteR2Object(objectKey: string) {
  const response = await fetchSignedObject("DELETE", objectKey);

  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 object deletion failed with status ${response.status}`);
  }
}
