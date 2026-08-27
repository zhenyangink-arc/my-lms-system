import { redirect } from "next/navigation";

import {
  ManagementMetricStrip,
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
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
      <ManagementPage
        title="个人信息"
        description="维护你的姓名、头像与登录密码；账号角色和状态仍由对应负责人管理。"
      >
        <ManagementNotice tone="danger">
          <strong className="block text-sm">个人信息暂时读取失败</strong>
          <span className="mt-1 block font-normal">
            你的账号资料未能读取，其他功能不受影响，请稍后重新加载本页。
          </span>
        </ManagementNotice>
      </ManagementPage>
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
    <ManagementPage
      title="个人信息"
      description="维护你的姓名、头像与登录密码；账号角色和状态仍由对应负责人管理。"
      className="management-page-narrow"
    >
      <ManagementMetricStrip
        label="当前账号信息"
        items={[
          { label: "当前角色", value: roleLabel },
          { label: "登录账号", value: data.login_id || "—" },
          { label: "登录邮箱", value: user.email || "—" },
          {
            label: "注册时间",
            value: user.created_at
              ? new Date(user.created_at).toLocaleDateString("zh-CN")
              : "—",
          },
        ]}
      />

      <AdminProfileForm
        displayName={displayName}
        avatarUrl={avatarUrl}
        gender={staff?.gender ?? null}
        birthDate={staff?.birth_date ?? null}
        hiredAt={staff?.hired_at ?? null}
      />
    </ManagementPage>
  );
}
