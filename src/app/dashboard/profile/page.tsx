import { redirect } from "next/navigation";
import { User } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardPageHeader } from "../DashboardPageHeader";

type Profile = {
  full_name: string | null;
  role: "student" | "teacher" | "admin";
  avatar_url: string | null;
};

const roleLabelMap = {
  student: "学生",
  teacher: "教师",
  admin: "管理员",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as Profile | null;

  const displayName =
    profile?.full_name || user.user_metadata?.name || user.email || "用户";

  const role = profile?.role || "student";

  return (
    <>
      <DashboardPageHeader
        title="个人资料"
        description="查看和管理你的账号资料。"
      />

      <div className="space-y-6 p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={20} />
              基本信息
            </CardTitle>
            <CardDescription>
              后续可以在这里编辑姓名、头像和个人信息。
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">姓名</p>
              <p className="mt-1 font-semibold text-gray-900">{displayName}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">邮箱</p>
              <p className="mt-1 font-semibold text-gray-900">{user.email}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">角色</p>
              <p className="mt-1 font-semibold text-gray-900">
                {roleLabelMap[role]}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}