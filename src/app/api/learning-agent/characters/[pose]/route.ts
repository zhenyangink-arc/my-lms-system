import { requireActiveUser } from "@/lib/auth";
import { createR2SignedObjectUrl } from "@/lib/r2";

const characterObjectKeys = {
  greeting: "learning-agent/characters/uply-teacher/v3/greeting-idle.png",
  explaining: "learning-agent/characters/uply-teacher/v3/explaining-idle.png",
  encouraging: "learning-agent/characters/uply-teacher/v3/encouraging-idle.png",
  "greeting-idle": "learning-agent/characters/uply-teacher/v3/greeting-idle.png",
  "greeting-speaking": "learning-agent/characters/uply-teacher/v3/greeting-speaking.png",
  "greeting-blink": "learning-agent/characters/uply-teacher/v3/greeting-blink.png",
  "explaining-idle": "learning-agent/characters/uply-teacher/v3/explaining-idle.png",
  "explaining-speaking": "learning-agent/characters/uply-teacher/v3/explaining-speaking.png",
  "explaining-blink": "learning-agent/characters/uply-teacher/v3/explaining-blink.png",
  "encouraging-idle": "learning-agent/characters/uply-teacher/v3/encouraging-idle.png",
  "encouraging-speaking": "learning-agent/characters/uply-teacher/v3/encouraging-speaking.png",
  "encouraging-blink": "learning-agent/characters/uply-teacher/v3/encouraging-blink.png",
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pose: string }> },
) {
  await requireActiveUser();
  if (request.headers.get("sec-fetch-dest") === "document") {
    return new Response("人物素材仅在课程学习界面中显示。", { status: 403 });
  }

  const { pose } = await params;
  const objectKey = characterObjectKeys[pose as keyof typeof characterObjectKeys];
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
