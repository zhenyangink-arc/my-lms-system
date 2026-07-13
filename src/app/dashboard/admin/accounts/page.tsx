import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DashboardPageHeader } from "../../DashboardPageHeader";
import { AccountCard } from "./AccountCard";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  deactivate_reason: string | null;
};

const ROLE_FILTERS = [
  { value: "all", label: "全部" },
  { value: "ceo", label: "CEO" },
  { value: "admin", label: "管理员" },
  { value: "teacher", label: "老师" },
  { value: "student", label: "学生" },
];

const STATUS_FILTERS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "inactive", label: "已停用" },
  { value: "suspended", label: "暂停" },
];

const GROUP_ORDER = ["ceo", "admin", "teacher", "student"] as const;

const GROUP_LABELS: Record<string, string> = {
  ceo: "CEO",
  admin: "管理员",
  teacher: "老师",
  student: "学生",
};

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; status?: string }>;
}) {
  const params = await searchParams;
  const roleFilter = params.role ?? "all";
  const statusFilter = params.status ?? "all";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const viewerRole = viewerProfile?.role ?? "student";

  if (viewerRole !== "super_admin" && viewerRole !== "ceo") {
    redirect("/dashboard");
  }

   let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at, deactivate_reason")
    .neq("role", "super_admin")
    .order("created_at", { ascending: false });

  if (roleFilter !== "all") {
    query = query.eq("role", roleFilter);
  }

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: profilesData } = await query;
  const profiles = (profilesData as Profile[] | null) ?? [];

  return (
    <>
      <DashboardPageHeader
        title="账号管理"
        description="管理老师 / 管理员 / CEO 的账号状态和角色"
      />

      <div className="w-full space-y-6 p-6">
        <div className="app-card space-y-3 rounded-2xl border p-5">
          <div className="flex flex-wrap gap-2">
            {ROLE_FILTERS.map((item) => (
              <Link
                key={item.value}
                href={`/dashboard/admin/accounts?role=${item.value}&status=${statusFilter}`}
                className="rounded-full border px-3 py-1.5 text-sm transition"
                style={{
                  borderColor: "var(--app-border)",
                  backgroundColor:
                    roleFilter === item.value ? "var(--app-accent)" : "transparent",
                  color: roleFilter === item.value ? "#fff" : "inherit",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((item) => (
              <Link
                key={item.value}
                href={`/dashboard/admin/accounts?role=${roleFilter}&status=${item.value}`}
                className="rounded-full border px-3 py-1.5 text-sm transition"
                style={{
                  borderColor: "var(--app-border)",
                  backgroundColor:
                    statusFilter === item.value ? "var(--app-accent)" : "transparent",
                  color: statusFilter === item.value ? "#fff" : "inherit",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {GROUP_ORDER.map((role) => {
            const groupProfiles = profiles.filter((p) => p.role === role);

            if (groupProfiles.length === 0) {
              return null;
            }

            return (
              <div key={role} className="space-y-3">
                <h2 className="text-sm font-semibold opacity-70">
                  {GROUP_LABELS[role]}（{groupProfiles.length}）
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {groupProfiles.map((profile) => (
                    <AccountCard
                      key={profile.id}
                      profile={profile}
                      viewerRole={viewerRole}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {profiles.length === 0 && (
            <p className="text-sm opacity-60">没有符合条件的账号。</p>
          )}
        </div>
      </div>
    </>
  );
}