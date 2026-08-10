"use server";

import { requireActiveUser } from "@/lib/auth";
import { closeLiveClassVoicePublications } from "@/lib/cloudflare-realtime";
import { getTeacherAssignedStudentIds } from "@/lib/student-assignments";
import { createAdminClient } from "@/lib/supabase/admin";

export type LiveClassMode = "one_on_one" | "group";

export type LiveClassSessionRow = {
  id: string;
  tenant_id: string;
  teacher_id: string;
  student_id: string | null;
  course_id: string;
  lesson_id: string;
  chapter_slug: string;
  mode: LiveClassMode;
  status: "active" | "ended";
  created_at: string;
  ended_at: string | null;
};

export type LiveClassResult =
  | { ok: true; session: LiveClassSessionRow }
  | { ok: false; error: string };

export type ActiveLiveClassResult =
  | { ok: true; session: LiveClassSessionRow | null }
  | { ok: false; error: string };

export type LiveClassParticipant = {
  id: string;
  role: "teacher" | "student";
  name: string;
};

export type LiveClassParticipantsResult =
  | { ok: true; participants: LiveClassParticipant[] }
  | { ok: false; error: string };

export type AddableLiveClassStudent = {
  id: string;
  name: string;
};

export type AddableLiveClassStudentsResult =
  | { ok: true; students: AddableLiveClassStudent[] }
  | { ok: false; error: string };

export type LiveClassVoicePermissionResult =
  | { ok: true; studentId: string; allowed: boolean }
  | { ok: false; error: string };

type SessionRow = {
  id: string;
  tenant_id: string;
  teacher_id: string;
  student_id: string | null;
  course_id: string;
  lesson_id: string;
  chapter_slug: string;
  mode: string;
  status: string;
  created_at: string;
  ended_at: string | null;
};

const SESSION_SELECT =
  "id, tenant_id, teacher_id, student_id, course_id, lesson_id, chapter_slug, mode, status, created_at, ended_at";

function toSession(row: SessionRow): LiveClassSessionRow {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    teacher_id: row.teacher_id,
    student_id: row.student_id,
    course_id: row.course_id,
    lesson_id: row.lesson_id,
    chapter_slug: row.chapter_slug,
    mode: row.mode === "group" ? "group" : "one_on_one",
    status: row.status === "active" ? "active" : "ended",
    created_at: row.created_at,
    ended_at: row.ended_at,
  };
}

type UserClient = Awaited<ReturnType<typeof requireActiveUser>>["supabase"];

/** 批量加入或重新激活课堂成员。 */
async function upsertMembers(
  supabase: UserClient,
  sessionId: string,
  studentIds: string[]
) {
  if (studentIds.length === 0) return { ok: true as const };
  const joinedAt = new Date().toISOString();
  const rows = studentIds.map((studentId) => ({
    session_id: sessionId,
    student_id: studentId,
    joined_at: joinedAt,
    left_at: null,
    voice_granted_at: null,
  }));
  const { data, error } = await supabase
    .from("live_class_members")
    .upsert(rows, {
      onConflict: "session_id,student_id",
    })
    .select("student_id");
  if (error || data?.length !== studentIds.length) {
    return { ok: false as const, error: "成员加入失败，请稍后重试。" };
  }
  return { ok: true as const };
}

async function findReusableSession(
  supabase: UserClient,
  input: {
    tenantId: string;
    teacherId: string;
    lessonId: string;
    mode: LiveClassMode;
    studentId: string | null;
  }
) {
  let query = supabase
    .from("live_class_sessions")
    .select(SESSION_SELECT)
    .eq("tenant_id", input.tenantId)
    .eq("teacher_id", input.teacherId)
    .eq("lesson_id", input.lessonId)
    .eq("mode", input.mode)
    .eq("status", "active");

  if (input.mode === "one_on_one") {
    query = query.eq("student_id", input.studentId);
  }

  return query.order("created_at", { ascending: true }).limit(1).maybeSingle();
}

/**
 * 发起实时课堂。
 * - mode = 'one_on_one'（默认）：studentId 必填，沿用原逻辑
 * - mode = 'group'：studentIds 多选，创建课堂后批量写入成员表；
 *   同老师同课时已有进行中的 group 课堂时直接复用并追加成员。
 * 校验：当前用户是老师、目标学生在自己负责名单中、课时/课程已发布。
 */
export async function createLiveClassAction(input: {
  mode?: LiveClassMode;
  studentId?: string;
  studentIds?: string[];
  courseId: string;
  lessonId: string;
  chapterSlug: string;
}): Promise<LiveClassResult> {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "课堂参数无效，请刷新页面后重试。" };
  }
  if (input.mode !== undefined && input.mode !== "group" && input.mode !== "one_on_one") {
    return { ok: false, error: "课堂模式无效。" };
  }

  const mode: LiveClassMode = input.mode === "group" ? "group" : "one_on_one";
  const courseId = String(input.courseId ?? "").trim();
  const lessonId = String(input.lessonId ?? "").trim();
  const chapterSlug = String(input.chapterSlug ?? "").trim();
  const studentId =
    mode === "one_on_one" ? String(input.studentId ?? "").trim() : null;
  const studentIds =
    mode === "group"
      ? Array.from(
          new Set(
            (Array.isArray(input.studentIds) ? input.studentIds : [])
              .map((id) => String(id).trim())
              .filter(Boolean)
          )
        )
      : [];

  if (!courseId || !lessonId || !chapterSlug) {
    return { ok: false, error: "缺少课堂信息，请刷新页面后重试。" };
  }
  if (mode === "one_on_one" && !studentId) {
    return { ok: false, error: "缺少学生信息，请刷新页面后重试。" };
  }
  if (mode === "group" && studentIds.length === 0) {
    return { ok: false, error: "请至少选择一名学生。" };
  }

  try {
    const { supabase, user, profile, tenant } = await requireActiveUser();
    if (profile?.role !== "teacher" || !tenant) {
      return { ok: false, error: "当前账号不是老师或不在机构工作台内。" };
    }

    const assignedIds = await getTeacherAssignedStudentIds(supabase, tenant.id, user.id);
    const targetIds = mode === "one_on_one" ? [studentId!] : studentIds;
    for (const targetId of targetIds) {
      if (!assignedIds.includes(targetId)) {
        return { ok: false, error: "部分学生不在你的负责名单中，无法发起课堂。" };
      }
    }

    // 校验课时/课程存在且已发布。
    const { data: lessonData } = await supabase
      .from("lessons")
      .select("id, course_id")
      .eq("id", lessonId)
      .eq("is_published", true)
      .maybeSingle();
    if (!lessonData || String(lessonData.course_id) !== courseId) {
      return { ok: false, error: "课时不存在或未发布，无法发起课堂。" };
    }
    const { data: courseData } = await supabase
      .from("courses")
      .select("id")
      .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`)
      .eq("id", courseId)
      .eq("is_published", true)
      .maybeSingle();
    if (!courseData) {
      return { ok: false, error: "课程不存在或未发布，无法发起课堂。" };
    }

    const { data: chapterData } = await supabase
      .from("course_chapters")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("slug", chapterSlug)
      .eq("is_published", true)
      .maybeSingle();
    if (!chapterData) {
      return { ok: false, error: "章节不存在、未发布或不属于所选课时。" };
    }

    // 复用进行中的课堂：one_on_one 按学生，group 按老师+课时。
    const { data: existingData, error: reuseError } = await findReusableSession(
      supabase,
      {
        tenantId: tenant.id,
        teacherId: user.id,
        lessonId,
        mode,
        studentId,
      }
    );
    if (reuseError) {
      return { ok: false, error: "课堂查询失败，请稍后重试。" };
    }
    if (existingData) {
      const existing = toSession(existingData as SessionRow);
      if (mode === "group") {
        const memberResult = await upsertMembers(supabase, existing.id, studentIds);
        if (!memberResult.ok) return memberResult;
      }
      return { ok: true, session: existing };
    }

    const { data: inserted, error } = await supabase
      .from("live_class_sessions")
      .insert({
        tenant_id: tenant.id,
        teacher_id: user.id,
        student_id: mode === "one_on_one" ? studentId : null,
        course_id: courseId,
        lesson_id: lessonId,
        chapter_slug: chapterSlug,
        status: "active",
        mode,
      })
      .select(SESSION_SELECT)
      .single();
    if (error?.code === "23505") {
      // 两个请求同时发起时，唯一索引只允许一个成功；失败方复用胜出的课堂。
      const { data: concurrentData, error: concurrentError } = await findReusableSession(
        supabase,
        {
          tenantId: tenant.id,
          teacherId: user.id,
          lessonId,
          mode,
          studentId,
        }
      );
      if (concurrentError || !concurrentData) {
        return { ok: false, error: "课堂创建冲突，请刷新后重试。" };
      }
      const concurrent = toSession(concurrentData as SessionRow);
      if (mode === "group") {
        const memberResult = await upsertMembers(supabase, concurrent.id, studentIds);
        if (!memberResult.ok) return memberResult;
      }
      return { ok: true, session: concurrent };
    }
    if (error || !inserted) {
      return { ok: false, error: "课堂创建失败，请稍后重试。" };
    }

    if (mode === "group") {
      const memberResult = await upsertMembers(supabase, inserted.id, studentIds);
      if (!memberResult.ok) {
        // 成员写入失败则回滚课堂，避免留下没有成员的 group 课堂。
        const { error: rollbackError } = await supabase
          .from("live_class_sessions")
          .delete()
          .eq("id", inserted.id);
        if (rollbackError) {
          console.error("回滚无成员公共课堂失败：", rollbackError);
        }
        return memberResult;
      }
    }

    return { ok: true, session: toSession(inserted as SessionRow) };
  } catch (error) {
    console.error("创建实时课堂失败：", error);
    return { ok: false, error: "课堂创建失败，请稍后重试。" };
  }
}

/** 课堂进行中追加学生（仅老师，课堂须为 active 的 group 模式）。 */
export async function addLiveClassMemberAction(
  sessionId: string,
  studentIds: string[]
): Promise<LiveClassResult> {
  const id = String(sessionId ?? "").trim();
  const ids = Array.from(
    new Set(
      (Array.isArray(studentIds) ? studentIds : [])
        .map((s) => String(s).trim())
        .filter(Boolean)
    )
  );
  if (!id) return { ok: false, error: "缺少课堂编号。" };
  if (ids.length === 0) return { ok: false, error: "请至少选择一名学生。" };

  try {
    const { supabase, user, tenant } = await requireActiveUser();
    if (!tenant) return { ok: false, error: "当前账号不在机构工作台内。" };

    const { data: sessionData } = await supabase
      .from("live_class_sessions")
      .select(SESSION_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (!sessionData) return { ok: false, error: "课堂不存在。" };
    const session = toSession(sessionData as SessionRow);
    if (session.tenant_id !== tenant.id || session.teacher_id !== user.id) {
      return { ok: false, error: "只有发起课堂的老师可以添加学生。" };
    }
    if (session.status !== "active") return { ok: false, error: "课堂已结束。" };
    if (session.mode !== "group") {
      return { ok: false, error: "一对一课堂不支持追加学生。" };
    }

    const assignedIds = await getTeacherAssignedStudentIds(supabase, tenant.id, user.id);
    for (const targetId of ids) {
      if (!assignedIds.includes(targetId)) {
        return { ok: false, error: "部分学生不在你的负责名单中，无法加入课堂。" };
      }
    }

    const memberResult = await upsertMembers(supabase, id, ids);
    if (!memberResult.ok) return memberResult;
    return { ok: true, session };
  } catch (error) {
    console.error("追加课堂学生失败：", error);
    return { ok: false, error: "添加学生失败，请稍后重试。" };
  }
}

/** 从课堂移除学生（仅老师）：置 left_at 后该生立即失去事件/语音/频道权限。 */
export async function removeLiveClassMemberAction(
  sessionId: string,
  studentId: string
): Promise<LiveClassResult> {
  const id = String(sessionId ?? "").trim();
  const targetId = String(studentId ?? "").trim();
  if (!id || !targetId) return { ok: false, error: "缺少课堂或学生编号。" };

  try {
    const { supabase, user, tenant } = await requireActiveUser();
    if (!tenant) return { ok: false, error: "当前账号不在机构工作台内。" };

    const { data: sessionData } = await supabase
      .from("live_class_sessions")
      .select(SESSION_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (!sessionData) return { ok: false, error: "课堂不存在。" };
    const session = toSession(sessionData as SessionRow);
    if (session.tenant_id !== tenant.id || session.teacher_id !== user.id) {
      return { ok: false, error: "只有发起课堂的老师可以移除学生。" };
    }
    if (session.status !== "active") return { ok: false, error: "课堂已结束。" };
    if (session.mode !== "group") {
      return { ok: false, error: "一对一课堂不支持移除公共课堂成员。" };
    }

    const { data: removed, error } = await supabase
      .from("live_class_members")
      .update({ left_at: new Date().toISOString(), voice_granted_at: null })
      .eq("session_id", id)
      .eq("student_id", targetId)
      .is("left_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "移除学生失败，请稍后重试。" };
    if (!removed) return { ok: false, error: "该学生当前不在课堂中。" };
    await closeLiveClassVoicePublications(id, targetId).catch((voiceError) => {
      console.error("关闭被移除学生的多人语音失败：", voiceError);
    });
    return { ok: true, session };
  } catch (error) {
    console.error("移除课堂学生失败：", error);
    return { ok: false, error: "移除学生失败，请稍后重试。" };
  }
}

/** 老师授予或收回公共课堂学生的发言权。学生不能直接修改该状态。 */
export async function setLiveClassVoicePermissionAction(
  sessionId: string,
  studentId: string,
  allowed: boolean
): Promise<LiveClassVoicePermissionResult> {
  const id = String(sessionId ?? "").trim();
  const targetId = String(studentId ?? "").trim();
  if (!id || !targetId) return { ok: false, error: "缺少课堂或学生编号。" };

  try {
    const { supabase, user, profile, tenant } = await requireActiveUser();
    if (!tenant || profile?.role !== "teacher") {
      return { ok: false, error: "只有老师可以控制学生发言权。" };
    }
    const { data: sessionData } = await supabase
      .from("live_class_sessions")
      .select(SESSION_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (!sessionData) return { ok: false, error: "课堂不存在。" };
    const session = toSession(sessionData as SessionRow);
    if (
      session.tenant_id !== tenant.id ||
      session.teacher_id !== user.id ||
      session.mode !== "group" ||
      session.status !== "active"
    ) {
      return { ok: false, error: "当前课堂不支持该操作。" };
    }

    const { data: member, error } = await supabase
      .from("live_class_members")
      .update({ voice_granted_at: allowed ? new Date().toISOString() : null })
      .eq("session_id", id)
      .eq("student_id", targetId)
      .is("left_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "发言权更新失败，请稍后重试。" };
    if (!member) return { ok: false, error: "该学生当前不在课堂中。" };

    if (!allowed) {
      await closeLiveClassVoicePublications(id, targetId).catch((voiceError) => {
        console.error("收回发言权时关闭学生音轨失败：", voiceError);
      });
    }
    return { ok: true, studentId: targetId, allowed };
  } catch (error) {
    console.error("更新课堂发言权失败：", error);
    return { ok: false, error: "发言权更新失败，请稍后重试。" };
  }
}

/** 结束课堂：仅发起课堂的老师可结束（学生只能退出页面）。 */
export async function endLiveClassAction(sessionId: string): Promise<LiveClassResult> {
  const id = String(sessionId ?? "").trim();
  if (!id) return { ok: false, error: "缺少课堂编号。" };

  try {
    const { supabase, user, tenant } = await requireActiveUser();
    if (!tenant) return { ok: false, error: "当前账号不在机构工作台内。" };

    const { data: sessionData } = await supabase
      .from("live_class_sessions")
      .select(SESSION_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (!sessionData) return { ok: false, error: "课堂不存在。" };
    const session = toSession(sessionData as SessionRow);
    if (session.status !== "active") return { ok: true, session };

    // 服务端强制：只有发起课堂的老师可以结束课堂。
    const isTeacher =
      session.tenant_id === tenant.id && session.teacher_id === user.id;
    if (!isTeacher) {
      return { ok: false, error: "只有发起课堂的老师可以结束课堂。" };
    }

    const { data: updated, error } = await supabase
      .from("live_class_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString(), ended_by: user.id })
      .eq("id", id)
      .select(SESSION_SELECT)
      .single();
    if (error) return { ok: false, error: "课堂结束失败，请稍后重试。" };
    await closeLiveClassVoicePublications(id).catch((voiceError) => {
      console.error("结束课堂时关闭多人语音失败：", voiceError);
    });
    return { ok: true, session: toSession(updated as SessionRow) };
  } catch (error) {
    console.error("结束实时课堂失败：", error);
    return { ok: false, error: "课堂结束失败，请稍后重试。" };
  }
}

/** 学生端：查询自己（可选按课时）进行中的课堂。RLS 已保证只返回自己参与
 *  （one_on_one 学生 / group 在场成员）的课堂。 */
export async function getActiveLiveClassAction(
  lessonId?: string | null
): Promise<ActiveLiveClassResult> {
  try {
    const { supabase, tenant } = await requireActiveUser();
    if (!tenant) return { ok: false, error: "当前账号不在机构工作台内。" };

    let query = supabase
      .from("live_class_sessions")
      .select(SESSION_SELECT)
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    if (lessonId) {
      query = query.eq("lesson_id", String(lessonId));
    }
    const { data, error } = await query.maybeSingle();
    if (error) return { ok: false, error: "课堂查询失败，请稍后重试。" };
    return { ok: true, session: data ? toSession(data as SessionRow) : null };
  } catch (error) {
    console.error("查询进行中课堂失败：", error);
    return { ok: false, error: "课堂查询失败，请稍后重试。" };
  }
}

/** 课堂页鉴权：仅参与者（老师 / one_on_one 学生 / group 在场成员）可进入。 */
export async function getLiveClassSessionAction(sessionId: string): Promise<LiveClassResult> {
  const id = String(sessionId ?? "").trim();
  if (!id) return { ok: false, error: "缺少课堂编号。" };

  try {
    const { supabase, user, tenant } = await requireActiveUser();
    if (!tenant) return { ok: false, error: "当前账号不在机构工作台内。" };

    const { data, error } = await supabase
      .from("live_class_sessions")
      .select(SESSION_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return { ok: false, error: "课堂不存在。" };
    const session = toSession(data as SessionRow);
    if (session.tenant_id !== tenant.id) return { ok: false, error: "课堂不存在。" };

    const isTeacher = session.teacher_id === user.id;
    const isDirectStudent = Boolean(session.student_id) && session.student_id === user.id;
    let isMember = false;
    if (!isTeacher && !isDirectStudent) {
      const { data: memberData } = await supabase
        .from("live_class_members")
        .select("id")
        .eq("session_id", id)
        .eq("student_id", user.id)
        .is("left_at", null)
        .limit(1)
        .maybeSingle();
      isMember = Boolean(memberData);
    }
    if (!isTeacher && !isDirectStudent && !isMember) {
      return { ok: false, error: "你不是该课堂的参与者。" };
    }
    return { ok: true, session };
  } catch (error) {
    console.error("加载实时课堂失败：", error);
    return { ok: false, error: "课堂加载失败，请稍后重试。" };
  }
}

/**
 * 返回课堂全部在场参与者。先按当前登录用户做课堂鉴权，再用服务端客户端读取
 * 完整成员名单，避免放宽 live_class_members“学生只能读自己的成员行”的 RLS。
 */
export async function getLiveClassParticipantsAction(
  sessionId: string
): Promise<LiveClassParticipantsResult> {
  const sessionResult = await getLiveClassSessionAction(sessionId);
  if (!sessionResult.ok) return sessionResult;

  try {
    const session = sessionResult.session;
    const admin = createAdminClient();
    let studentIds: string[] = [];

    if (session.mode === "one_on_one") {
      if (session.student_id) studentIds = [session.student_id];
    } else {
      const { data: members, error: membersError } = await admin
        .from("live_class_members")
        .select("student_id, joined_at")
        .eq("session_id", session.id)
        .is("left_at", null)
        .order("joined_at", { ascending: true });
      if (membersError) {
        return { ok: false, error: "课堂参与者读取失败，请稍后重试。" };
      }
      studentIds = (members ?? []).map((member) => String(member.student_id));
    }

    const participantIds = [session.teacher_id, ...studentIds];
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, full_name, login_id")
      .in("id", participantIds);
    if (profilesError) {
      return { ok: false, error: "课堂参与者读取失败，请稍后重试。" };
    }

    const profileById = new Map(
      (profiles ?? []).map((profile) => [
        String(profile.id),
        String(profile.full_name || profile.login_id || ""),
      ])
    );
    const participants: LiveClassParticipant[] = participantIds.map((id, index) => ({
      id,
      role: index === 0 ? "teacher" : "student",
      name: profileById.get(id) || (index === 0 ? "老师" : "学生"),
    }));
    return { ok: true, participants };
  } catch (error) {
    console.error("加载课堂参与者失败：", error);
    return { ok: false, error: "课堂参与者读取失败，请稍后重试。" };
  }
}

/** 老师在课堂进行中可追加的负责学生（排除当前在场成员）。 */
export async function getAddableLiveClassStudentsAction(
  sessionId: string
): Promise<AddableLiveClassStudentsResult> {
  const id = String(sessionId ?? "").trim();
  if (!id) return { ok: false, error: "缺少课堂编号。" };

  try {
    const { supabase, user, profile, tenant } = await requireActiveUser();
    if (profile?.role !== "teacher" || !tenant) {
      return { ok: false, error: "只有老师可以添加学生。" };
    }
    const { data: sessionData } = await supabase
      .from("live_class_sessions")
      .select(SESSION_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (!sessionData) return { ok: false, error: "课堂不存在。" };
    const session = toSession(sessionData as SessionRow);
    if (
      session.teacher_id !== user.id ||
      session.tenant_id !== tenant.id ||
      session.mode !== "group" ||
      session.status !== "active"
    ) {
      return { ok: false, error: "当前课堂不支持追加学生。" };
    }

    const assignedIds = await getTeacherAssignedStudentIds(supabase, tenant.id, user.id);
    if (assignedIds.length === 0) return { ok: true, students: [] };

    const admin = createAdminClient();
    const [{ data: members, error: membersError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        admin
          .from("live_class_members")
          .select("student_id")
          .eq("session_id", id)
          .is("left_at", null),
        admin.from("profiles").select("id, full_name, login_id").in("id", assignedIds),
      ]);
    if (membersError || profilesError) {
      return { ok: false, error: "可添加学生读取失败，请稍后重试。" };
    }

    const activeIds = new Set((members ?? []).map((member) => String(member.student_id)));
    const students = (profiles ?? [])
      .filter((student) => !activeIds.has(String(student.id)))
      .map((student) => ({
        id: String(student.id),
        name: String(student.full_name || student.login_id || String(student.id).slice(0, 8)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    return { ok: true, students };
  } catch (error) {
    console.error("加载可追加课堂学生失败：", error);
    return { ok: false, error: "可添加学生读取失败，请稍后重试。" };
  }
}

// —— 老师端：公共课堂工作台数据（课程目录 + 进行中的 group 课堂 + 成员名单）——

export type TeacherLiveClassDashboard = {
  courses: {
    id: string;
    title: string;
    lessons: {
      id: string;
      title: string;
      firstChapterSlug: string | null;
      chapters: { slug: string; title: string }[];
    }[];
  }[];
  activeGroupClasses: {
    id: string;
    courseTitle: string;
    lessonTitle: string;
    chapterSlug: string;
    createdAt: string;
    members: { studentId: string; fullName: string | null; loginId: string | null }[];
  }[];
};

export type TeacherLiveClassDashboardResult =
  | { ok: true; data: TeacherLiveClassDashboard }
  | { ok: false; error: string };

/** 老师端"发起公共课堂"弹窗的初始数据：老师可见课程目录 + 自己进行中的 group 课堂（含在场成员）。 */
export async function getTeacherLiveClassDashboardAction(): Promise<TeacherLiveClassDashboardResult> {
  try {
    const { supabase, user, profile, tenant } = await requireActiveUser();
    if (profile?.role !== "teacher" || !tenant) {
      return { ok: false, error: "当前账号不是老师或不在机构工作台内。" };
    }

    const assignedStudentIds = await getTeacherAssignedStudentIds(supabase, tenant.id, user.id);

    const [coursesResult, lessonsResult, chaptersResult, activeResult, membersResult, profilesResult] =
      await Promise.all([
        supabase
          .from("courses")
          .select("id, title")
          .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`)
          .eq("is_published", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("lessons")
          .select("id, course_id, title")
          .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`)
          .eq("is_published", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("course_chapters")
          .select("lesson_id, slug, title")
          .eq("is_published", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("live_class_sessions")
          .select("id, course_id, lesson_id, chapter_slug, created_at")
          .eq("tenant_id", tenant.id)
          .eq("teacher_id", user.id)
          .eq("mode", "group")
          .eq("status", "active"),
        supabase.from("live_class_members").select("session_id, student_id, left_at"),
        assignedStudentIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, full_name, login_id")
              .in("id", assignedStudentIds)
          : Promise.resolve({
              data: [] as { id: string; full_name: string | null; login_id: string | null }[],
              error: null,
            }),
      ]);

    if (
      coursesResult.error ||
      lessonsResult.error ||
      chaptersResult.error ||
      activeResult.error ||
      membersResult.error ||
      profilesResult.error
    ) {
      return { ok: false, error: "课堂工作台数据读取失败，请稍后重试。" };
    }

    const chaptersByLesson = new Map<string, { slug: string; title: string }[]>();
    for (const chapter of chaptersResult.data ?? []) {
      const lessonId = String(chapter.lesson_id);
      const chapters = chaptersByLesson.get(lessonId) ?? [];
      chapters.push({ slug: String(chapter.slug), title: String(chapter.title) });
      chaptersByLesson.set(lessonId, chapters);
    }

    const courses: TeacherLiveClassDashboard["courses"] = [];
    for (const course of coursesResult.data ?? []) {
      const lessons = (lessonsResult.data ?? [])
        .filter((lesson) => String(lesson.course_id) === String(course.id))
        .map((lesson) => {
          const chapters = chaptersByLesson.get(String(lesson.id)) ?? [];
          return {
            id: String(lesson.id),
            title: String(lesson.title),
            firstChapterSlug: chapters[0]?.slug ?? null,
            chapters,
          };
        });
      courses.push({ id: String(course.id), title: String(course.title), lessons });
    }

    const activeIds = (activeResult.data ?? []).map((row) => String(row.id));
    const profileById = new Map<string, { full_name: string | null; login_id: string | null }>();
    for (const profileRow of profilesResult.data ?? []) {
      profileById.set(String(profileRow.id), {
        full_name: profileRow.full_name,
        login_id: profileRow.login_id,
      });
    }
    const memberBySession = new Map<string, TeacherLiveClassDashboard["activeGroupClasses"][number]["members"]>();
    for (const member of membersResult.data ?? []) {
      const sessionId = String(member.session_id);
      if (!activeIds.includes(sessionId)) continue;
      if (member.left_at !== null) continue; // 只看在场成员
      const list = memberBySession.get(sessionId) ?? [];
      const studentId = String(member.student_id);
      const info = profileById.get(studentId);
      list.push({
        studentId,
        fullName: info?.full_name ?? null,
        loginId: info?.login_id ?? null,
      });
      memberBySession.set(sessionId, list);
    }

    const titleByCourse = new Map((coursesResult.data ?? []).map((c) => [String(c.id), String(c.title)]));
    const titleByLesson = new Map((lessonsResult.data ?? []).map((l) => [String(l.id), String(l.title)]));

    const activeGroupClasses: TeacherLiveClassDashboard["activeGroupClasses"] = (activeResult.data ?? []).map(
      (row) => ({
        id: String(row.id),
        courseTitle: titleByCourse.get(String(row.course_id)) ?? "课程",
        lessonTitle: titleByLesson.get(String(row.lesson_id)) ?? "课时",
        chapterSlug: String(row.chapter_slug),
        createdAt: String(row.created_at),
        members: memberBySession.get(String(row.id)) ?? [],
      })
    );

    return { ok: true, data: { courses, activeGroupClasses } };
  } catch (error) {
    console.error("加载老师课堂工作台失败：", error);
    return { ok: false, error: "课堂工作台加载失败，请稍后重试。" };
  }
}

/** 课堂内切换章节（仅老师）：更新会话的 chapter_slug，供双方同步换书。 */
export async function updateLiveClassChapterAction(
  sessionId: string,
  chapterSlug: string
): Promise<LiveClassResult> {
  const id = String(sessionId ?? "").trim();
  const slug = String(chapterSlug ?? "").trim();
  if (!id || !slug) return { ok: false, error: "缺少课堂或章节信息。" };

  try {
    const { supabase, user, tenant } = await requireActiveUser();
    if (!tenant) return { ok: false, error: "当前账号不在机构工作台内。" };

    const { data: sessionData } = await supabase
      .from("live_class_sessions")
      .select(SESSION_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (!sessionData) return { ok: false, error: "课堂不存在。" };
    const session = toSession(sessionData as SessionRow);
    if (session.tenant_id !== tenant.id || session.teacher_id !== user.id) {
      return { ok: false, error: "只有发起课堂的老师可以切换章节。" };
    }
    if (session.status !== "active") return { ok: false, error: "课堂已结束。" };
    if (slug === session.chapter_slug) return { ok: true, session };

    // 校验章节属于该课时且已发布。
    const { data: chapterData } = await supabase
      .from("course_chapters")
      .select("id")
      .eq("lesson_id", session.lesson_id)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!chapterData) return { ok: false, error: "该课时不存在此章节。" };

    const { data: updated, error } = await supabase
      .from("live_class_sessions")
      .update({ chapter_slug: slug })
      .eq("id", id)
      .select(SESSION_SELECT)
      .single();
    if (error) return { ok: false, error: "章节切换失败，请稍后重试。" };
    return { ok: true, session: toSession(updated as SessionRow) };
  } catch (error) {
    console.error("切换课堂章节失败：", error);
    return { ok: false, error: "章节切换失败，请稍后重试。" };
  }
}
