import { requireActiveUser } from "@/lib/auth";
import { createR2SignedObjectUrl } from "@/lib/r2";
import { canUseStudentFeature, normalizeMembershipTier } from "@/lib/student-permissions";
import { isTeacherVideoKey } from "@/lib/teaching-video";

export async function GET(request: Request) {
  const { profile } = await requireActiveUser();
  if (!canUseStudentFeature(profile?.role ?? "student", normalizeMembershipTier(profile?.membership_tier), "korean_course")) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }
  const key = new URL(request.url).searchParams.get("key");
  if (!isTeacherVideoKey(key)) return Response.json({ message: "Invalid video key" }, { status: 400 });
  try {
    const url = await createR2SignedObjectUrl(key);
    const range = request.headers.get("range");
    const upstream = await fetch(url, { headers: range ? { Range: range } : undefined, cache: "no-store", signal: request.signal });
    if (!upstream.ok) return new Response(null, {
      status: upstream.status === 416 ? 416 : 503,
      headers: upstream.status === 416 && upstream.headers.has("content-range") ? { "Content-Range": upstream.headers.get("content-range")! } : undefined,
    });
    const headers = new Headers({ "Content-Type": "video/mp4", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", "Content-Disposition": "inline" });
    for (const name of ["accept-ranges", "content-range", "content-length"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ message: "视频暂时无法读取，请重试。" }, { status: 503 });
  }
}
