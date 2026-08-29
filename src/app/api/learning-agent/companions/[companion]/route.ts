import { requireActiveUser } from "@/lib/auth";
import { createR2SignedObjectUrl } from "@/lib/r2";

const companionObjectKeys = {
  "xiao-mo-pointing": "learning-agent/companions/xiao-mo/v1/pointing.png",
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companion: string }> },
) {
  await requireActiveUser();
  if (request.headers.get("sec-fetch-dest") === "document") {
    return new Response("课堂陪伴角色仅在课程学习界面中显示。", { status: 403 });
  }

  const { companion } = await params;
  const objectKey = companionObjectKeys[companion as keyof typeof companionObjectKeys];
  if (!objectKey) return new Response("Not found", { status: 404 });

  const signedUrl = await createR2SignedObjectUrl(objectKey);
  return new Response(null, {
    status: 302,
    headers: {
      Location: signedUrl,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
