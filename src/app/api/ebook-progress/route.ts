import { saveKoreanEbookProgressAction } from "@/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/actions";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as Parameters<
      typeof saveKoreanEbookProgressAction
    >[0];
    const result = await saveKoreanEbookProgressAction(input);
    return Response.json(result, {
      status: result.status === "success" ? 200 : 400,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { status: "error" as const },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

