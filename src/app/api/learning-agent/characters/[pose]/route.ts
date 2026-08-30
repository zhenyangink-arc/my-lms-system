import { requireActiveUser } from "@/lib/auth";
import { createR2SignedObjectUrl } from "@/lib/r2";

const characterObjectKeys = {
  greeting: "learning-agent/characters/uply-teacher/v4/greeting-idle.png",
  explaining: "learning-agent/characters/uply-teacher/v4/explaining-idle.png",
  encouraging: "learning-agent/characters/uply-teacher/v4/encouraging-idle.png",
  "pointing-left": "learning-agent/characters/uply-teacher/v4/pointing-left-idle.png",
  "repeat-after-me": "learning-agent/characters/uply-teacher/v4/repeat-after-me-idle.png",
  listening: "learning-agent/characters/uply-teacher/v4/listening-idle.png",
  "gentle-correction": "learning-agent/characters/uply-teacher/v4/gentle-correction-idle.png",
  "greeting-idle": "learning-agent/characters/uply-teacher/v4/greeting-idle.png",
  "greeting-speaking": "learning-agent/characters/uply-teacher/v4/greeting-speaking.png",
  "greeting-blink": "learning-agent/characters/uply-teacher/v4/greeting-blink.png",
  "explaining-idle": "learning-agent/characters/uply-teacher/v4/explaining-idle.png",
  "explaining-speaking": "learning-agent/characters/uply-teacher/v4/explaining-speaking.png",
  "explaining-blink": "learning-agent/characters/uply-teacher/v4/explaining-blink.png",
  "encouraging-idle": "learning-agent/characters/uply-teacher/v4/encouraging-idle.png",
  "encouraging-speaking": "learning-agent/characters/uply-teacher/v4/encouraging-speaking.png",
  "encouraging-blink": "learning-agent/characters/uply-teacher/v4/encouraging-blink.png",
  "pointing-left-idle": "learning-agent/characters/uply-teacher/v4/pointing-left-idle.png",
  "pointing-left-speaking": "learning-agent/characters/uply-teacher/v4/pointing-left-speaking.png",
  "pointing-left-blink": "learning-agent/characters/uply-teacher/v4/pointing-left-blink.png",
  "repeat-after-me-idle": "learning-agent/characters/uply-teacher/v4/repeat-after-me-idle.png",
  "repeat-after-me-speaking": "learning-agent/characters/uply-teacher/v4/repeat-after-me-speaking.png",
  "repeat-after-me-blink": "learning-agent/characters/uply-teacher/v4/repeat-after-me-blink.png",
  "listening-idle": "learning-agent/characters/uply-teacher/v4/listening-idle.png",
  "listening-speaking": "learning-agent/characters/uply-teacher/v4/listening-speaking.png",
  "listening-blink": "learning-agent/characters/uply-teacher/v4/listening-blink.png",
  "gentle-correction-idle": "learning-agent/characters/uply-teacher/v4/gentle-correction-idle.png",
  "gentle-correction-speaking": "learning-agent/characters/uply-teacher/v4/gentle-correction-speaking.png",
  "gentle-correction-blink": "learning-agent/characters/uply-teacher/v4/gentle-correction-blink.png",
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
