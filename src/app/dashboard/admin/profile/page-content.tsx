import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { AdminProfileForm } from "./AdminProfileForm";

const ROLE_LABELS: Record<string, string> = {
  teacher: "老师",
  admin: "管理员",
  ceo: "运营负责人",
  tenant_super_admin: "机构负责人",
  platform_super_admin: "平台负责人",
  tenant_operator: "平台副负责人",
  platform_course_inspector: "平台课程巡检员",
};

export default async function AdminProfilePage() {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = profile?.role ?? "student";

  // 只允许后台成员进入（机构侧非学生角色；平台侧平台负责人）。
  const isStaff = tenant ? role !== "student" : role === "platform_super_admin";
  if (!isStaff) redirect("/dashboard");

  const [profileResult, staffResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, login_id, avatar_path, global_role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("staff_profiles")
      .select("gender, birth_date, hired_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const { data, error } = profileResult;
  if (error || !data) {
    console.error("后台个人信息读取失败：", error?.message ?? "资料行不存在");
    return (
      <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4 sm:p-5">
        <section className="app-card overflow-hidden rounded-xl border">
          <div className="flex flex-col items-start gap-3 px-5 py-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertCircle size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold tracking-tight">个人信息暂时读取失败</h2>
              <p className="app-muted-text mt-1 text-xs leading-5">
                你的账号资料未能读取（{error?.message ?? "资料行不存在"}）。其他功能不受影响；若刚更新过数据库结构，请确认
                profiles 表包含 hired_at 字段后重新加载本页。
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const staff = staffResult.data;

  let avatarUrl: string | null = null;
  if (data.avatar_path) {
    const { data: signedAvatar } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(data.avatar_path, 60 * 60);
    avatarUrl = signedAvatar?.signedUrl ?? null;
  }

  const displayName = data.full_name || user.user_metadata?.name || user.email || "用户";
  const roleLabel =
    data.global_role === "platform_admin"
      ? "平台管理员"
      : ROLE_LABELS[role] ?? (tenant ? "机构成员" : "平台成员");

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4 sm:p-5">
      <section className="app-card overflow-hidden rounded-xl border">
        <div className="px-5 py-5">
          <p className="app-muted-text text-[11px] font-semibold tracking-[0.16em]">个人设置</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">个人信息</h2>
          <p className="app-muted-text mt-1 text-xs">
            维护你的姓名、头像与登录密码；账号角色、状态等由机构或平台负责人管理。
          </p>
        </div>
        <div className="grid border-t sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--app-border)" }}>
          {[
            ["当前角色", roleLabel],
            ["登录账号", data.login_id || "—"],
            ["登录邮箱", user.email || "—"],
            ["注册时间", user.created_at ? new Date(user.created_at).toLocaleDateString("zh-CN") : "—"],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={`min-w-0 px-5 py-3 ${index > 0 ? "sm:border-l" : ""} ${index > 1 ? "border-t sm:border-t-0" : ""}`}
              style={{ borderColor: "var(--app-border)" }}
            >
              <p className="app-muted-text text-[11px] font-medium">{label}</p>
              <p className="mt-0.5 truncate text-sm font-semibold" title={value}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <AdminProfileForm
        displayName={displayName}
        avatarUrl={avatarUrl}
        gender={staff?.gender ?? null}
        birthDate={staff?.birth_date ?? null}
        hiredAt={staff?.hired_at ?? null}
      />
    </div>
  );
}
