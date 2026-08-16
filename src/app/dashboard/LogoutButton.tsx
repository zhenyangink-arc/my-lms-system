"use client";

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
export function LogoutButton({
  collapsed = false,
  appearance = "default",
}: {
  collapsed?: boolean;
  appearance?: "default" | "menu" | "sheet";
}) {
  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    // 清空当前角色的客户端布局缓存，避免下一个账号继承旧导航。
    window.location.replace("/login");
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        title={collapsed ? "退出登录" : undefined}
        role={appearance === "menu" ? "menuitem" : undefined}
        className={
          appearance === "menu"
            ? "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            : appearance === "sheet"
              ? "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            : `inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-medium shadow-sm transition hover:bg-gray-50 ${
                collapsed ? "w-9" : "w-full px-3"
              }`
        }
      >
        {appearance === "menu" || appearance === "sheet" ? (
          <>
            <LogOut aria-hidden="true" size={16} />
            退出登录
          </>
        ) : collapsed ? (
          <LogOut size={16} />
        ) : (
          "退出登录"
        )}
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
