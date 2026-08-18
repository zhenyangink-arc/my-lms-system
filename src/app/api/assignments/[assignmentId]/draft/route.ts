import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { supabase, profile } = await requireActiveUser();
  if (profile?.role !== "student") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }
  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) {
    return NextResponse.json({ message: "Invalid assignment." }, { status: 400 });
  }

  let payload: { answers?: unknown; activeStep?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ message: "草稿格式不正确。" }, { status: 400 });
  }
  if (
    !payload.answers ||
    typeof payload.answers !== "object" ||
    Array.isArray(payload.answers) ||
    typeof payload.activeStep !== "number" ||
    !Number.isInteger(payload.activeStep)
  ) {
    return NextResponse.json({ message: "草稿格式不正确。" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("save_learning_assignment_draft", {
    p_assignment_id: assignmentId,
    p_answers: payload.answers,
    p_active_step: payload.activeStep,
  });
  if (error) {
    return NextResponse.json(
      { message: "云端保存失败，本机草稿仍然保留。" },
      { status: 400 }
    );
  }
  return NextResponse.json({ savedAt: data });
}
