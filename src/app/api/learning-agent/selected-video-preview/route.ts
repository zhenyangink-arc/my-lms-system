import { serveSelectedVideoAsset } from "@/features/learning-agent-script-studio/selected-video-asset.server";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return serveSelectedVideoAsset(request);
}

export async function HEAD(request: Request): Promise<Response> {
  return serveSelectedVideoAsset(request);
}
