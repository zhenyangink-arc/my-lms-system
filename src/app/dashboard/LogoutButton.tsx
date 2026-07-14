"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/*
  collapsed 由 DashboardSidebar 传入。

  收缩状态下：
  1. 按钮宽度从 w-full 改成固定的 w-9（正方形，跟其他收缩状态的图标按钮保持一致）
  2. 文字隐藏，只显示退出图标
  3. 用原生 title 属性做 hover 文字提示，跟侧边栏其他收缩项的提示方式一致
*/
export function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        title={collapsed ? "退出登录" : undefined}
        className={`inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-medium shadow-sm transition hover:bg-gray-50 ${
          collapsed ? "w-9" : "w-full px-3"
        }`}
      >
        {collapsed ? <LogOut size={16} /> : "退出登录"}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
          <AlertDialogDescription>
            退出后需要重新登录才能进入学生控制台和个人中心。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700"
          >
            确认退出
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}