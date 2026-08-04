import { NextResponse } from "next/server";

type HighlightRequestBody = {
  element_id?: unknown;
};

export async function POST(request: Request) {
  let body: HighlightRequestBody;

  try {
    body = (await request.json()) as HighlightRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const elementId =
    typeof body.element_id === "string" ? body.element_id.trim() : "";

  if (!elementId) {
    return NextResponse.json(
      { error: "element_id must be a non-empty string" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    action: "highlight",
    target: elementId,
    message: "已经帮你找到啦",
  });
}
