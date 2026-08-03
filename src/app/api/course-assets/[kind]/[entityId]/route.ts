import { createR2SignedObjectUrl } from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";

const tableByKind = {
  category: "course_categories",
  course: "courses",
  lesson: "lessons",
  chapter: "course_chapters",
} as const;

export async function GET(
  _request: Request,
  context: RouteContext<"/api/course-assets/[kind]/[entityId]">,
) {
  const { kind, entityId } = await context.params;
  const table = tableByKind[kind as keyof typeof tableByKind];
  if (!table) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from(table)
    .select("cover_object_key")
    .eq("id", entityId)
    .maybeSingle();
  const objectKey = data?.cover_object_key as string | null | undefined;
  if (error || !objectKey) return new Response("Not found", { status: 404 });

  const signedUrl = await createR2SignedObjectUrl(objectKey);
  return Response.redirect(signedUrl, 302);
}
