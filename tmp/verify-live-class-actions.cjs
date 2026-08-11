// 阶段三：加载并直接调用 actions.ts 的真实导出函数。
const fs = require("fs");
const Module = require("module");
const path = require("path");
const ts = require("typescript");
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
const anonKey = readVar("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceKey = readVar("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !anonKey || !serviceKey) throw new Error("SUPABASE_ENV_MISSING");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let authContext = null;
const authMock = {
  requireActiveUser: async () => {
    if (!authContext) throw new Error("TEST_AUTH_CONTEXT_MISSING");
    return authContext;
  },
};
const assignmentMock = {
  getTeacherAssignedStudentIds: async (supabase, tenantId, teacherId) => {
    const { data, error } = await supabase
      .from("tenant_student_assignments")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("teacher_id", teacherId);
    if (error) return [];
    return (data ?? []).map((row) => String(row.student_id));
  },
};
const cloudflareRealtimeMock = {
  closeLiveClassVoicePublications: async () => undefined,
};

function loadActions() {
  const filename = path.resolve("src/app/dashboard/live/actions.ts");
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;

  const loadedModule = new Module(filename, module);
  loadedModule.filename = filename;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "@/lib/auth") return authMock;
    if (request === "@/lib/student-assignments") return assignmentMock;
    if (request === "@/lib/supabase/admin") return { createAdminClient: () => admin };
    if (request === "@/lib/cloudflare-realtime") return cloudflareRealtimeMock;
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    loadedModule._compile(compiled, filename);
    return loadedModule.exports;
  } finally {
    Module._load = originalLoad;
  }
}

function makeUserClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

const actions = loadActions();
const assertions = [];
function report(name, passed, detail) {
  assertions.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

function teacherContext(teacherId, tenant) {
  return {
    supabase: admin,
    user: { id: teacherId },
    profile: { role: "teacher" },
    tenant,
  };
}

function studentContext(client, studentId, tenant) {
  return {
    supabase: client,
    user: { id: studentId },
    profile: { role: "student" },
    tenant,
  };
}

let createdSessionIds = [];
const signedInClients = [];

(async () => {
  try {
    const { data: teacherMembership, error: teacherError } = await admin
      .from("tenant_memberships")
      .select("tenant_id, tenants!inner(id, slug, name, status, plan_key)")
      .eq("role", "teacher")
      .eq("status", "active")
      .eq("is_default", true)
      .limit(1)
      .single();
    if (teacherError) throw teacherError;

    const tenantId = teacherMembership.tenant_id;
    const { data: assignmentRows, error: assignmentsError } = await admin
      .from("tenant_student_assignments")
      .select("teacher_id, student_id, profiles!tenant_student_assignments_student_id_fkey(id, login_id, email)")
      .eq("tenant_id", tenantId);
    if (assignmentsError) throw assignmentsError;

    const byTeacher = new Map();
    for (const row of assignmentRows ?? []) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!profile || !["test01", "test02", "test03"].includes(profile.login_id)) continue;
      const list = byTeacher.get(row.teacher_id) ?? [];
      list.push(profile);
      byTeacher.set(row.teacher_id, list);
    }
    const fixtureEntry = [...byTeacher.entries()].find(([, students]) => students.length >= 3);
    if (!fixtureEntry) throw new Error("TEST_TEACHER_WITH_THREE_STUDENTS_NOT_FOUND");
    const [teacherId, students] = fixtureEntry;
    const studentByLogin = new Map(students.map((student) => [student.login_id, student]));
    const student1 = studentByLogin.get("test01");
    const student2 = studentByLogin.get("test02");
    const student3 = studentByLogin.get("test03");
    if (!student1 || !student2 || !student3) throw new Error("TEST_STUDENTS_INCOMPLETE");

    const tenantRow = Array.isArray(teacherMembership.tenants)
      ? teacherMembership.tenants[0]
      : teacherMembership.tenants;
    const tenant = {
      id: tenantId,
      slug: tenantRow.slug,
      name: tenantRow.name,
      status: tenantRow.status,
      planKey: tenantRow.plan_key,
      role: "teacher",
      membershipTier: "basic",
    };

    const { data: chapterRows, error: chapterError } = await admin
      .from("course_chapters")
      .select("slug, lesson_id")
      .eq("is_published", true)
      .limit(50);
    if (chapterError) throw chapterError;
    const lessonIds = [...new Set((chapterRows ?? []).map((row) => row.lesson_id))];
    const { data: lessonRows, error: lessonError } = await admin
      .from("lessons")
      .select("id, course_id")
      .in("id", lessonIds)
      .eq("is_published", true);
    if (lessonError) throw lessonError;
    const courseIds = [...new Set((lessonRows ?? []).map((row) => row.course_id))];
    const { data: courseRows, error: courseError } = await admin
      .from("courses")
      .select("id, tenant_id")
      .in("id", courseIds)
      .eq("is_published", true);
    if (courseError) throw courseError;
    const allowedCourseIds = new Set(
      (courseRows ?? [])
        .filter((row) => row.tenant_id === null || row.tenant_id === tenantId)
        .map((row) => row.id)
    );
    const lessonById = new Map(
      (lessonRows ?? [])
        .filter((row) => allowedCourseIds.has(row.course_id))
        .map((row) => [row.id, row])
    );
    const fixtureChapter = (chapterRows ?? []).find((row) => lessonById.has(row.lesson_id));
    if (!fixtureChapter) throw new Error("PUBLISHED_CHAPTER_NOT_FOUND");
    const lesson = lessonById.get(fixtureChapter.lesson_id);
    const input = {
      courseId: lesson.course_id,
      lessonId: lesson.id,
      chapterSlug: fixtureChapter.slug,
    };

    authContext = teacherContext(teacherId, tenant);

    const nullInput = await actions.createLiveClassAction(null);
    report("拒绝 null action 参数", !nullInput.ok, nullInput.ok ? "错误返回成功" : nullInput.error);
    const invalidMode = await actions.createLiveClassAction({ ...input, mode: "invalid", studentId: student1.id });
    report("拒绝非法课堂模式", !invalidMode.ok, invalidMode.ok ? "错误返回成功" : invalidMode.error);
    const invalidStudentArray = await actions.createLiveClassAction({ ...input, mode: "group", studentIds: "not-an-array" });
    report("拒绝非数组 studentIds", !invalidStudentArray.ok, invalidStudentArray.ok ? "错误返回成功" : invalidStudentArray.error);

    const invalidChapter = await actions.createLiveClassAction({
      ...input,
      mode: "group",
      studentIds: [student1.id],
      chapterSlug: "__invalid_stage3_chapter__",
    });
    report("拒绝不属于课时的章节", !invalidChapter.ok, invalidChapter.ok ? "错误创建课堂" : invalidChapter.error);

    const created = await actions.createLiveClassAction({
      ...input,
      mode: "group",
      studentIds: [student1.id, student2.id],
    });
    if (!created.ok) throw new Error(`GROUP_CREATE_FAILED: ${created.error}`);
    createdSessionIds.push(created.session.id);
    report("创建 group 课堂", created.session.mode === "group" && created.session.student_id === null, created.session.id);

    const reused = await actions.createLiveClassAction({
      ...input,
      mode: "group",
      studentIds: [student3.id],
    });
    report("同课时复用并追加成员", reused.ok && reused.session.id === created.session.id, reused.ok ? reused.session.id : reused.error);

    const { data: initialMembers } = await admin
      .from("live_class_members")
      .select("student_id, left_at")
      .eq("session_id", created.session.id)
      .is("left_at", null);
    report("复用后 3 名成员均在场", initialMembers?.length === 3, `在场 ${initialMembers?.length ?? 0} 人`);

    const removed = await actions.removeLiveClassMemberAction(created.session.id, student1.id);
    report("移除在场成员", removed.ok, removed.ok ? "成功" : removed.error);
    const { data: removedRow } = await admin
      .from("live_class_members")
      .select("joined_at, left_at")
      .eq("session_id", created.session.id)
      .eq("student_id", student1.id)
      .single();

    await new Promise((resolve) => setTimeout(resolve, 10));
    const readded = await actions.addLiveClassMemberAction(created.session.id, [student1.id]);
    const { data: readdedRow } = await admin
      .from("live_class_members")
      .select("joined_at, left_at")
      .eq("session_id", created.session.id)
      .eq("student_id", student1.id)
      .single();
    report(
      "被移除成员可以重新加入",
      readded.ok && readdedRow.left_at === null && readdedRow.joined_at !== removedRow.joined_at,
      readded.ok ? "left_at 已清空并刷新 joined_at" : readded.error
    );

    await actions.removeLiveClassMemberAction(created.session.id, student1.id);
    const removeAgain = await actions.removeLiveClassMemberAction(created.session.id, student1.id);
    report("重复移除不会假报成功", !removeAgain.ok, removeAgain.ok ? "错误返回成功" : removeAgain.error);

    const unassignedAdd = await actions.addLiveClassMemberAction(
      created.session.id,
      ["00000000-0000-0000-0000-000000000001"]
    );
    report("拒绝追加非负责学生", !unassignedAdd.ok, unassignedAdd.ok ? "错误加入" : unassignedAdd.error);

    const oneOnOneAdd = await actions.addLiveClassMemberAction(created.session.id, []);
    report("拒绝空追加名单", !oneOnOneAdd.ok, oneOnOneAdd.ok ? "错误返回成功" : oneOnOneAdd.error);
    const malformedAdd = await actions.addLiveClassMemberAction(created.session.id, "not-an-array");
    report("追加接口拒绝非数组参数", !malformedAdd.ok, malformedAdd.ok ? "错误返回成功" : malformedAdd.error);

    const dashboard = await actions.getTeacherLiveClassDashboardAction();
    report(
      "老师工作台返回课堂与在场成员",
      dashboard.ok && dashboard.data.activeGroupClasses.some((item) => item.id === created.session.id && item.members.length === 2),
      dashboard.ok ? "找到课堂且显示 2 名在场学生" : dashboard.error
    );

    const memberClient = makeUserClient();
    const removedClient = makeUserClient();
    signedInClients.push(memberClient, removedClient);
    const memberLogin = await memberClient.auth.signInWithPassword({ email: student2.email, password: "Test@123456" });
    const removedLogin = await removedClient.auth.signInWithPassword({ email: student1.email, password: "Test@123456" });
    if (memberLogin.error) throw memberLogin.error;
    if (removedLogin.error) throw removedLogin.error;

    authContext = studentContext(memberClient, student2.id, { ...tenant, role: "student" });
    const memberActive = await actions.getActiveLiveClassAction(input.lessonId);
    report("group 成员可查询进行中课堂", memberActive.ok && memberActive.session?.id === created.session.id, memberActive.ok ? memberActive.session?.id ?? "null" : memberActive.error);
    const memberSession = await actions.getLiveClassSessionAction(created.session.id);
    report("group 成员可进入课堂", memberSession.ok, memberSession.ok ? "鉴权通过" : memberSession.error);
    const studentEnd = await actions.endLiveClassAction(created.session.id);
    report("学生不能调用结束课堂 action", !studentEnd.ok, studentEnd.ok ? "越权结束" : studentEnd.error);

    authContext = studentContext(removedClient, student1.id, { ...tenant, role: "student" });
    const removedActive = await actions.getActiveLiveClassAction(input.lessonId);
    report("被移除成员查询不到进行中课堂", removedActive.ok && removedActive.session === null, removedActive.ok ? "返回 null" : removedActive.error);
    const removedSession = await actions.getLiveClassSessionAction(created.session.id);
    report("被移除成员不能进入课堂", !removedSession.ok, removedSession.ok ? "越权进入" : removedSession.error);

    authContext = teacherContext(teacherId, tenant);
    const ended = await actions.endLiveClassAction(created.session.id);
    report("老师结束 group 课堂", ended.ok && ended.session.status === "ended", ended.ok ? "ended" : ended.error);

    // 两个请求同时发起同一课堂：两边都应拿到同一个 session，成员合并。
    const [concurrentA, concurrentB] = await Promise.all([
      actions.createLiveClassAction({ ...input, mode: "group", studentIds: [student1.id] }),
      actions.createLiveClassAction({ ...input, mode: "group", studentIds: [student2.id] }),
    ]);
    if (concurrentA.ok) createdSessionIds.push(concurrentA.session.id);
    if (concurrentB.ok) createdSessionIds.push(concurrentB.session.id);
    report(
      "并发发起只产生一个 group 课堂",
      concurrentA.ok && concurrentB.ok && concurrentA.session.id === concurrentB.session.id,
      concurrentA.ok && concurrentB.ok ? concurrentA.session.id : "至少一个请求失败"
    );
    if (concurrentA.ok) await actions.endLiveClassAction(concurrentA.session.id);

    const oneOnOne = await actions.createLiveClassAction({
      ...input,
      mode: "one_on_one",
      studentId: student1.id,
    });
    if (!oneOnOne.ok) throw new Error(`ONE_ON_ONE_CREATE_FAILED: ${oneOnOne.error}`);
    createdSessionIds.push(oneOnOne.session.id);
    report("原一对一课堂仍可创建", oneOnOne.session.mode === "one_on_one" && oneOnOne.session.student_id === student1.id, oneOnOne.session.id);

    const oneOnOneReused = await actions.createLiveClassAction({
      ...input,
      mode: "one_on_one",
      studentId: student1.id,
    });
    report("一对一课堂仍可复用", oneOnOneReused.ok && oneOnOneReused.session.id === oneOnOne.session.id, oneOnOneReused.ok ? oneOnOneReused.session.id : oneOnOneReused.error);
    const addToOneOnOne = await actions.addLiveClassMemberAction(oneOnOne.session.id, [student2.id]);
    report("一对一课堂拒绝追加成员", !addToOneOnOne.ok, addToOneOnOne.ok ? "错误加入" : addToOneOnOne.error);
    const removeFromOneOnOne = await actions.removeLiveClassMemberAction(oneOnOne.session.id, student1.id);
    report("一对一课堂拒绝移除成员表记录", !removeFromOneOnOne.ok, removeFromOneOnOne.ok ? "错误返回成功" : removeFromOneOnOne.error);

    authContext = studentContext(removedClient, student1.id, { ...tenant, role: "student" });
    const oneOnOneActive = await actions.getActiveLiveClassAction(input.lessonId);
    report("一对一学生仍可查询课堂", oneOnOneActive.ok && oneOnOneActive.session?.id === oneOnOne.session.id, oneOnOneActive.ok ? oneOnOneActive.session?.id ?? "null" : oneOnOneActive.error);

    authContext = teacherContext(teacherId, tenant);
    await actions.endLiveClassAction(oneOnOne.session.id);
  } finally {
    authContext = teacherContext("00000000-0000-0000-0000-000000000000", { id: "", role: "teacher" });
    for (const client of signedInClients) {
      await client.auth.signOut({ scope: "local" });
    }
    createdSessionIds = [...new Set(createdSessionIds)];
    if (createdSessionIds.length > 0) {
      await admin.from("live_class_sessions").delete().in("id", createdSessionIds);
    }
  }

  const failed = assertions.filter((item) => !item.passed);
  console.log(JSON.stringify({ total: assertions.length, passed: assertions.length - failed.length, failed }, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error(`LIVE_CLASS_ACTION_TEST_FAILED: ${error.message}`);
  process.exit(1);
});
