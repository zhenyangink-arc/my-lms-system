import { redirect } from "next/navigation";

import {
  getLiveClassParticipantsAction,
  getLiveClassSessionAction,
  type LiveClassSessionRow,
} from "@/app/dashboard/live/actions";
import { LiveClassRoom } from "@/app/dashboard/live/LiveClassRoom";
import { requireActiveUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LiveClassPage({
  params,
}: {
  params: Promise<{ space: string; sessionId: string }>;
}) {
  const { space, sessionId } = await params;

  const result = await getLiveClassSessionAction(sessionId);
  if (!result.ok) redirect("/dashboard");

  const session: LiveClassSessionRow = result.session;
  if (session.status !== "active") redirect("/dashboard");

  const { supabase, user } = await requireActiveUser();
  const isTeacher = session.teacher_id === user.id;
  // 老师返回学生管理页，学生返回学习首页。
  const backHref = isTeacher
    ? `/${space}/dashboard/admin/my-students`
    : `/${space}/dashboard`;

  // 参与者名称 + 课时/课程标题，供课堂界面展示。
  const [participantsResult, lessonResult, courseResult] = await Promise.all([
    getLiveClassParticipantsAction(session.id),
    supabase.from("lessons").select("title").eq("id", session.lesson_id).maybeSingle(),
    supabase.from("courses").select("title").eq("id", session.course_id).maybeSingle(),
  ]);

  return (
    <LiveClassRoom
      session={session}
      isTeacher={isTeacher}
      currentUserId={user.id}
      participants={participantsResult.ok ? participantsResult.participants : []}
      courseTitle={courseResult.data?.title ?? "课程"}
      lessonTitle={lessonResult.data?.title ?? "课时"}
      backHref={backHref}
    />
  );
}
