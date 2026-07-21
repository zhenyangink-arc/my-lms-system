import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function createR2Context() {
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
  const bucketName = getRequiredEnv("R2_BUCKET_NAME");
  const signedUrlExpiresIn = Number(
    process.env.R2_SIGNED_URL_EXPIRES_IN ?? "3600"
  );

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return { client, bucketName, signedUrlExpiresIn };
}

export async function createR2SignedVideoUrl(objectKey: string) {
  const { client, bucketName, signedUrlExpiresIn } = createR2Context();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  return getSignedUrl(client, command, {
    expiresIn: signedUrlExpiresIn,
  });
}


/*
  生成资料文件的上传签名 URL

  使用场景：
  管理员在页面上选择一个文件后，浏览器先问服务器要这个 URL，
  然后浏览器直接把文件 PUT 到 R2，不经过 Next.js 服务器中转。

  objectKey 由服务器随机生成（不是用户上传的原始文件名），
  好处：
  1. 不会撞名覆盖别的资料文件
  2. 避免用户上传的文件名里带特殊字符导致路径问题
*/
export async function createR2SignedUploadUrl(
  objectKey: string,
  contentType: string
) {
  const { client, bucketName, signedUrlExpiresIn } = createR2Context();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: signedUrlExpiresIn,
  });
}

/*
  生成资料文件的下载签名 URL

  跟 createR2SignedVideoUrl 的区别：
  这个函数额外传入 originalFileName，
  通过 ResponseContentDisposition 让浏览器下载时
  使用“原始文件名”，而不是 R2 里存的随机 key。

  中文文件名处理：
  Content-Disposition 这个 HTTP 头，对非 ASCII 字符（比如中文）
  有专门的编码规则（RFC 5987），写法是：

  filename*=UTF-8''编码后的文件名

  如果只用普通 filename="xxx" 的写法，中文文件名会变成乱码。
  所以这里同时写两种，保证新旧浏览器都能正确显示文件名。
*/
export async function createR2SignedResourceDownloadUrl(
  objectKey: string,
  originalFileName: string
) {
  const { client, bucketName, signedUrlExpiresIn } = createR2Context();
  const encodedFileName = encodeURIComponent(originalFileName);

  const contentDisposition = `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ResponseContentDisposition: contentDisposition,
  });

  return getSignedUrl(client, command, {
    expiresIn: signedUrlExpiresIn,
  });
}


/*
  删除 R2 里的一个文件

  使用场景：
  管理员给已有资料重新上传新文件后，把旧文件从 R2 里清理掉，
  避免旧文件一直占用存储空间。

  注意：
  这个函数只删 R2 里的物理文件，不碰数据库。
  数据库这边的 resource_object_key 更新是在 actions.ts 里单独处理的。
*/
export async function deleteR2Object(objectKey: string) {
  const { client, bucketName } = createR2Context();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  await client.send(command);
}
