"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UserCircle,
} from "lucide-react";

import { LogoutButton } from "./LogoutButton";
import { ThemeSwitcher } from "./ThemeSwitcher";

type DashboardSidebarProps = {
  userName: string;
  userEmail: string;
  userRole: string;
};

type SidebarItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
};

const sidebarItems: SidebarItem[] = [
  {
    label: "学生控制台",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "我的课程",
    href: "/dashboard/courses",
    icon: BookOpen,
  },
  {
    label: "学习进度",
    href: "/dashboard/progress",
    icon: BarChart3,
  },
  {
    label: "目标大学",
    href: "/dashboard/universities",
    icon: Building2,
  },
  {
    label: "申请材料",
    href: "/dashboard/documents",
    icon: FileText,
  },
  {
    label: "签证准备",
    href: "/dashboard/visa",
    icon: ShieldCheck,
  },
  {
    label: "个人资料",
    href: "/dashboard/profile",
    icon: UserCircle,
  },
  {
    label: "课程管理",
    href: "/dashboard/admin/courses",
    icon: Settings,
    adminOnly: true,
  },
];

function isAdminRole(role: string) {
  /*
    可以看到管理端菜单的角色：

    super_admin = 老板 / Owner
    ceo         = CEO
    admin       = 管理员

    teacher 和 student 不显示管理端菜单。
  */
  return role === "admin" || role === "ceo" || role === "super_admin";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRoleLabel(role: string) {
  if (role === "super_admin") {
    return "老板";
  }

  if (role === "ceo") {
    return "CEO";
  }

  if (role === "admin") {
    return "管理员";
  }

  if (role === "teacher") {
    return "教师";
  }

  return "学生";
}

export function DashboardSidebar({
  userName,
  userEmail,
  userRole,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const isAdmin = isAdminRole(userRole);

  const visibleItems = sidebarItems.filter((item) => {
    if (item.adminOnly) {
      return isAdmin;
    }

    return true;
  });

  return (
    <aside className="app-sidebar hidden w-64 shrink-0 border-r md:flex md:flex-col">
      <div className="border-b border-gray-100 px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-900 text-white">
            <GraduationCap size={24} />
          </div>

          <div>
            <p className="text-lg font-black tracking-tight text-gray-900">
              PUFFY
            </p>
            <p className="text-xs font-medium text-gray-500">
              留学学习管理系统
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
            >
              <Icon
                size={18}
                className={active ? "text-white" : "text-gray-400"}
              />
              {item.label}

              {item.adminOnly && (
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${active
                      ? "bg-white/15 text-white"
                      : "bg-orange-50 text-orange-600"
                    }`}
                >
                  ADMIN
                </span>
              )}
            </Link>
          );
        })}
      </nav>


      <div className="border-t border-gray-100 p-4">
        <div className="mb-3">
          <ThemeSwitcher />
        </div>

        <div className="mb-3 rounded-2xl bg-gray-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm">
              <UserCircle size={22} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">
                {userName}
              </p>

              <p className="truncate text-xs text-gray-500">{userEmail}</p>

              <p className="mt-1 text-xs font-semibold text-orange-600">
                {getRoleLabel(userRole)}
              </p>
            </div>
          </div>
        </div>

        <LogoutButton />
      </div>
    </aside>
  );
}