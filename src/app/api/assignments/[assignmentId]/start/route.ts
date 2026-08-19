import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { supabase, profile } = await requireActiveUser();
  if (profile?.role !== "student") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }
  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) {
    return NextResponse.json({ message: "Invalid assignment." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc(
    "start_learning_assignment_attempt",
    { p_assignment_id: assignmentId },
  );
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json(
      { message: "考试尚未开放、已经截止或作答次数已用完。" },
      { status: 400 },
    );
  }
  const result = data as {
    startedAt?: unknown;
    expiresAt?: unknown;
    serverNow?: unknown;
    idempotent?: unknown;
  };
  if (
    typeof result.startedAt !== "string" ||
    typeof result.expiresAt !== "string" ||
    typeof result.serverNow !== "string"
  ) {
    return NextResponse.json(
      { message: "服务器没有返回有效的考试时间，请稍后重试。" },
      { status: 502 },
    );
  }
  return NextResponse.json(result);
}
