import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const accountId = getRequiredEnv("R2_ACCOUNT_ID");
const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
const bucketName = getRequiredEnv("R2_BUCKET_NAME");

const signedUrlExpiresIn = Number(
  process.env.R2_SIGNED_URL_EXPIRES_IN ?? "3600"
);

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export async function createR2SignedVideoUrl(objectKey: string) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  return getSignedUrl(r2Client, command, {
    expiresIn: signedUrlExpiresIn,
  });
}