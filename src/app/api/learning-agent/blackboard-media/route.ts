import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";
import { createR2SignedObjectUrl } from "@/lib/r2";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX } from "@/lib/teaching-blackboard";

/** Serves 黑板画面 images/videos uploaded to R2 by the teaching-script admin
 * editor. The object key travels with the (already client-visible) slide
 * JSON, so this route's only real gate is: does the requester have
 * korean_course access at all, and does the key actually live under the
 * blackboard/ namespace (never an arbitrary R2 path). */
export async function GET(request: Request) {
  const { profile } = await requireActiveUser();
  const role = profile?.role ?? "student";
  if (!canUseStudentFeature(role, normalizeMembershipTier(profile?.membership_tier), "korean_course")) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  // A copied media endpoint must not become a directly navigable download
  // page. Native <img>/<video> requests use "image"/"video"; address-bar
  // navigation uses "document".
  const dest = request.headers.get("sec-fetch-dest");
  if (dest === "document") {
    return NextResponse.json({ message: "Blackboard media is available in the lesson player only." }, { status: 403 });
  }

  const objectKey = new URL(request.url).searchParams.get("key") ?? "";
  const isImage = objectKey.startsWith(`${BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX}image/`);
  const isVideo = objectKey.startsWith(`${BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX}video/`);
  if (!isImage && !isVideo) {
    return NextResponse.json({ message: "Invalid media key." }, { status: 400 });
  }

  let signedUrl: string;
  try {
    signedUrl = await createR2SignedObjectUrl(objectKey);
  } catch {
    return NextResponse.json({ message: "Media is temporarily unavailable." }, { status: 503 });
  }

  if (isImage) {
    // Images are low-value to leak briefly, so a redirect is fine — matches
    // the character-avatar and course-cover-image routes.
    return new Response(null, {
      status: 302,
      headers: {
        Location: signedUrl,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  }

  // Video: proxy the bytes so the signed origin stays server-side, same
  // reasoning as lesson audio. Range requests are forwarded for seeking.
  const range = request.headers.get("range");
  const upstream = await fetch(signedUrl, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
    signal: request.signal,
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ message: "Media is temporarily unavailable." }, { status: 503 });
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": 'inline; filename="lesson-video"',
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["accept-ranges", "content-length", "content-range", "content-type"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
