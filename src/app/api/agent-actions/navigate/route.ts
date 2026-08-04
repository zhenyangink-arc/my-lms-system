import { NextResponse } from "next/server";

type NavigateRequestBody = {
  target_page?: unknown;
};

export async function POST(request: Request) {
  let body: NavigateRequestBody;

  try {
    body = (await request.json()) as NavigateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const targetPage =
    typeof body.target_page === "string" ? body.target_page.trim() : "";

  if (!targetPage) {
    return NextResponse.json(
      { error: "target_page must be a non-empty string" },
      { status: 400 },
    );
  }

  return NextResponse.json({ action: "navigate", target: targetPage });
}
