// 为老师“结束课堂”按钮创建/清理专用 UI 测试夹具。
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env.local", "utf8");
const readVar = (key) => env
  .split(/\r?\n/)
  .find((line) => line.startsWith(`${key}=`))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim();
const url = readVar("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = readVar("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) throw new Error("SUPABASE_ENV_MISSING");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const loginId = "codex_end_test";
const email = `${loginId}@accounts.puffy.invalid`;
const password = "CodexTest@2026";
const studentLoginId = "codex_student_test";
const studentEmail = `${studentLoginId}@accounts.puffy.invalid`;
const studentPassword = "CodexStudent@2026";
const listenerBLoginId = "codex_voice_listener_b";
const listenerBEmail = `${listenerBLoginId}@accounts.puffy.invalid`;
const listenerCLoginId = "codex_voice_listener_c";
const listenerCEmail = `${listenerCLoginId}@accounts.puffy.invalid`;
const listenerPassword = "CodexListener@2026";
const outsiderLoginId = "codex_voice_outsider";
const outsiderEmail = `${outsiderLoginId}@accounts.puffy.invalid`;
const outsiderPassword = "CodexOutsider@2026";

async function findUserId(targetLoginId) {
  const { data } = await admin.from("profiles").select("id").eq("login_id", targetLoginId).maybeSingle();
  return data?.id ?? null;
}

async function cleanup() {
  for (const targetLoginId of [
    loginId,
    studentLoginId,
    listenerBLoginId,
    listenerCLoginId,
    outsiderLoginId,
  ]) {
    const userId = await findUserId(targetLoginId);
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    }
  }
  console.log("UI_END_FIXTURE_CLEANED");
}

async function setup({ singleMember = false, oneOnOne = false } = {}) {
  await cleanup();
  const { data: testStudents, error: studentError } = await admin
    .from("profiles")
    .select("id, login_id, tenant_memberships!inner(tenant_id)")
    .in("login_id", ["test01", "test02"]);
  if (studentError || !testStudents || testStudents.length < 2) {
    throw studentError ?? new Error("TEST_STUDENTS_NOT_FOUND");
  }
  const tenantMembership = Array.isArray(testStudents[0].tenant_memberships)
    ? testStudents[0].tenant_memberships[0]
    : testStudents[0].tenant_memberships;
  const tenantId = tenantMembership.tenant_id;

  const { data: studentAuth, error: studentAuthError } = await admin.auth.admin.createUser({
    email: studentEmail,
    password: studentPassword,
    email_confirm: true,
  });
  if (studentAuthError || !studentAuth.user) {
    throw studentAuthError ?? new Error("STUDENT_AUTH_CREATE_FAILED");
  }
  const temporaryStudentId = studentAuth.user.id;
  const { error: tempProfileError } = await admin.from("profiles").upsert({
    id: temporaryStudentId,
    login_id: studentLoginId,
    full_name: "课堂测试学生",
    email: studentEmail,
    role: "student",
    membership_tier: "vip2",
  });
  if (tempProfileError) throw tempProfileError;
  const { error: tempMembershipError } = await admin.from("tenant_memberships").insert({
    tenant_id: tenantId,
    user_id: temporaryStudentId,
    role: "student",
    status: "active",
    membership_tier: "vip2",
    is_default: true,
  });
  if (tempMembershipError) throw tempMembershipError;

  const listenerIds = [];
  for (const [listenerLoginId, listenerEmail] of [
    [listenerBLoginId, listenerBEmail],
    [listenerCLoginId, listenerCEmail],
  ]) {
    const { data: listenerAuth, error: listenerAuthError } = await admin.auth.admin.createUser({
      email: listenerEmail,
      password: listenerPassword,
      email_confirm: true,
    });
    if (listenerAuthError || !listenerAuth.user) {
      throw listenerAuthError ?? new Error("LISTENER_AUTH_CREATE_FAILED");
    }
    listenerIds.push(listenerAuth.user.id);
    const { error: listenerProfileError } = await admin.from("profiles").upsert({
      id: listenerAuth.user.id,
      login_id: listenerLoginId,
      full_name: listenerLoginId === listenerBLoginId ? "语音收听学生B" : "语音收听学生C",
      email: listenerEmail,
      role: "student",
      membership_tier: "vip2",
    });
    if (listenerProfileError) throw listenerProfileError;
    const { error: listenerMembershipError } = await admin.from("tenant_memberships").insert({
      tenant_id: tenantId,
      user_id: listenerAuth.user.id,
      role: "student",
      status: "active",
      membership_tier: "vip2",
      is_default: true,
    });
    if (listenerMembershipError) throw listenerMembershipError;
  }

  const { data: outsiderAuth, error: outsiderAuthError } = await admin.auth.admin.createUser({
    email: outsiderEmail,
    password: outsiderPassword,
    email_confirm: true,
  });
  if (outsiderAuthError || !outsiderAuth.user) {
    throw outsiderAuthError ?? new Error("OUTSIDER_AUTH_CREATE_FAILED");
  }
  const outsiderId = outsiderAuth.user.id;
  const { error: outsiderProfileError } = await admin.from("profiles").upsert({
    id: outsiderId,
    login_id: outsiderLoginId,
    full_name: "语音非成员学生",
    email: outsiderEmail,
    role: "student",
    membership_tier: "vip2",
  });
  if (outsiderProfileError) throw outsiderProfileError;
  const { error: outsiderMembershipError } = await admin.from("tenant_memberships").insert({
    tenant_id: tenantId,
    user_id: outsiderId,
    role: "student",
    status: "active",
    membership_tier: "vip2",
    is_default: true,
  });
  if (outsiderMembershipError) throw outsiderMembershipError;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) throw authError ?? new Error("AUTH_CREATE_FAILED");
  const teacherId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: teacherId,
    login_id: loginId,
    full_name: "结束课堂按钮测试老师",
    email,
    role: "teacher",
  });
  if (profileError) throw profileError;
  const { error: membershipError } = await admin.from("tenant_memberships").insert({
    tenant_id: tenantId,
    user_id: teacherId,
    role: "teacher",
    status: "active",
    is_default: true,
  });
  if (membershipError) throw membershipError;
  const { error: assignmentError } = await admin.from("tenant_student_assignments").insert(
    [...testStudents, { id: temporaryStudentId }, ...listenerIds.map((id) => ({ id }))].map((student) => ({
      tenant_id: tenantId,
      teacher_id: teacherId,
      student_id: student.id,
    }))
  );
  if (assignmentError) throw assignmentError;

  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .select("id, course_id")
    .eq("slug", "hangul-introduction")
    .eq("is_published", true)
    .single();
  if (lessonError || !lesson) throw lessonError ?? new Error("LESSON_NOT_FOUND");
  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("id, tenant_id")
    .eq("id", lesson.course_id)
    .eq("is_published", true)
    .single();
  if (courseError || !course || (course.tenant_id !== null && course.tenant_id !== tenantId)) {
    throw courseError ?? new Error("COURSE_NOT_AVAILABLE");
  }
  const { data: chapter, error: chapterError } = await admin
    .from("course_chapters")
    .select("slug")
    .eq("lesson_id", lesson.id)
    .eq("is_published", true)
    .order("sort_order")
    .limit(1)
    .single();
  if (chapterError || !chapter) throw chapterError ?? new Error("CHAPTER_NOT_FOUND");
  const classInput = { courseId: course.id, lessonId: lesson.id, chapterSlug: chapter.slug };

  const { data: session, error: sessionError } = await admin
    .from("live_class_sessions")
    .insert({
      tenant_id: tenantId,
      teacher_id: teacherId,
      student_id: oneOnOne ? temporaryStudentId : null,
      course_id: classInput.courseId,
      lesson_id: classInput.lessonId,
      chapter_slug: classInput.chapterSlug,
      mode: oneOnOne ? "one_on_one" : "group",
      status: "active",
    })
    .select("id")
    .single();
  if (sessionError) throw sessionError;
  if (!oneOnOne) {
    const initialStudents = singleMember
      ? [{ id: temporaryStudentId }]
      : [...testStudents, { id: temporaryStudentId }, ...listenerIds.map((id) => ({ id }))];
    const { error: membersError } = await admin.from("live_class_members").insert(
      initialStudents.map((student) => ({ session_id: session.id, student_id: student.id }))
    );
    if (membersError) throw membersError;
  }
  console.log(JSON.stringify({
    loginId,
    tenantId,
    sessionId: session.id,
    studentLoginId,
    studentPassword,
    listenerBLoginId,
    listenerCLoginId,
    listenerPassword,
    outsiderLoginId,
    outsiderPassword,
  }));
}

const mode = process.argv[2];
(mode === "cleanup"
  ? cleanup()
  : setup({ singleMember: mode === "setup-one", oneOnOne: mode === "setup-one-on-one" })
).catch((error) => {
  console.error(`UI_END_FIXTURE_FAILED: ${error.message}`);
  process.exit(1);
});
