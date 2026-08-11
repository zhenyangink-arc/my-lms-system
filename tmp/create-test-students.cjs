// 创建/补齐测试学生（test01/02/03）并分配给老师 yuanzhi002（幂等）
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env.local", "utf8");
const readVar = (key) =>
  env
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${key}=`))
    ?.split("=")
    .slice(1)
    .join("=")
    .trim();

const url = readVar("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = readVar("SUPABASE_SERVICE_ROLE_KEY");
const TEACHER_ID = "2b438ee6-5fa9-4983-89ad-a43df4f46fc7";
const TENANT_ID = "ead4e9d6-8b5f-4769-978b-f5a43083c491";
const PASSWORD = "Test@123456";

if (!url || !serviceKey) { console.error("MISSING ENV"); process.exit(1); }
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const students = [
  { loginId: "test01", fullName: "测试学生1" },
  { loginId: "test02", fullName: "测试学生2" },
  { loginId: "test03", fullName: "测试学生3" },
];

(async () => {
  for (const s of students) {
    const email = `${s.loginId}@accounts.puffy.invalid`;
    let userId = null;

    // 查现有 profile（按 email）
    const { data: existingProfile } = await admin
      .from("profiles").select("id").eq("email", email).maybeSingle();
    if (existingProfile) {
      userId = String(existingProfile.id);
    } else {
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email, password: PASSWORD, email_confirm: true,
      });
      if (authError || !authUser?.user) { console.log(`FAIL ${s.loginId} auth: ${authError?.message ?? "no user"}`); continue; }
      userId = authUser.user.id;
    }

    // upsert profile（补 login_id / full_name）
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id: userId, login_id: s.loginId, full_name: s.fullName, email }, { onConflict: "id" });
    if (profileError) { console.log(`FAIL ${s.loginId} profile: ${profileError.message}`); continue; }

    // upsert membership
    const { error: memberError } = await admin
      .from("tenant_memberships")
      .upsert(
        { tenant_id: TENANT_ID, user_id: userId, role: "student", status: "active", is_default: true },
        { onConflict: "tenant_id,user_id" }
      );
    if (memberError) { console.log(`FAIL ${s.loginId} membership: ${memberError.message}`); continue; }

    // upsert assignment
    const { error: assignError } = await admin
      .from("tenant_student_assignments")
      .upsert(
        { tenant_id: TENANT_ID, teacher_id: TEACHER_ID, student_id: userId },
        { onConflict: "tenant_id,student_id,teacher_id", ignoreDuplicates: true }
      );
    if (assignError) { console.log(`FAIL ${s.loginId} assign: ${assignError.message}`); continue; }

    console.log(`OK ${s.loginId} -> ${userId}`);
  }
  console.log("done");
})();
