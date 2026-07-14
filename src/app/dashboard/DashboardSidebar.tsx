"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cog,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Library,
  Megaphone,
  MessageSquare,
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
  executiveOnly?: boolean;
};

/*
  侧边栏收缩状态的本地存储 key。

  为什么用 localStorage 而不是 cookie？
  这个状态只影响当前用户在当前浏览器上的展示偏好，
  不需要服务器端读取，localStorage 足够简单直接。
*/
const SIDEBAR_COLLAPSED_STORAGE_KEY = "puffy-sidebar-collapsed";
const SIDEBAR_COLLAPSED_CHANGE_EVENT = "puffy-sidebar-collapsed-change";

function subscribeToCollapsedState(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, onStoreChange);
  };
}

function getCollapsedSnapshot() {
  const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

function getCollapsedServerSnapshot() {
  return true;
}

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
    label: "作业与考试",
    href: "/dashboard/assignments",
    icon: ClipboardList,
  },
  {
    label: "会话练习",
    href: "/dashboard/conversation-practice",
    icon: MessageSquare,
  },
  {
    label: "成绩管理",
    href: "/dashboard/grades",
    icon: Award,
  },
  {
    label: "学习记录",
    href: "/dashboard/records",
    icon: History,
  },
  {
    label: "资料库",
    href: "/dashboard/library",
    icon: Library,
  },
  {
    label: "通知公告",
    href: "/dashboard/announcements",
    icon: Megaphone,
  },
  {
    label: "帮助中心",
    href: "/dashboard/help",
    icon: HelpCircle,
  },
  {
    label: "设置",
    href: "/dashboard/settings",
    icon: Cog,
  },



  {
    label: "课程管理",
    href: "/dashboard/admin/courses",
    icon: Settings,
    adminOnly: true,
  },
  {
    label: "账号管理",
    href: "/dashboard/admin/accounts",
    icon: ShieldCheck,
    adminOnly: true,
    executiveOnly: true,
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

/*
  账号管理入口专用判断，比 isAdminRole 更严格。

  isAdminRole  → admin / ceo / super_admin 都能看到"管理端"菜单大类
  isExecutiveRole → 只有 ceo / super_admin 能看到"账号管理"这一条子菜单

  管理员 admin 不能看到账号管理入口，
  因为账号管理涉及角色和状态修改，权限更敏感。
*/
function isExecutiveRole(role: string) {
  return role === "ceo" || role === "super_admin";
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

  /*
    收缩状态。

    默认值 true（收缩），跟产品需求一致：
    "页面刚打开时导航栏默认收缩"。

    这样设计还有一个好处：服务器端渲染时不知道 localStorage 里存的什么，
    只能先按某个默认值渲染。既然默认值本来就是"收缩"，
    大部分用户（没有主动展开过的新用户）不会看到任何跳动。
    只有之前手动展开过的用户，会在页面加载完 JS 后有一次很短的展开过渡。
  */
  const collapsed = useSyncExternalStore(
    subscribeToCollapsedState,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );

  function toggleCollapsed() {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(!collapsed)
    );
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_CHANGE_EVENT));
  }

  const isAdmin = isAdminRole(userRole);
  const isExecutive = isExecutiveRole(userRole);

  const visibleItems = sidebarItems.filter((item) => {
    if (item.executiveOnly) {
      return isExecutive;
    }

    if (item.adminOnly) {
      return isAdmin;
    }

    return true;
  });

  return (
    <aside
      className={`app-sidebar relative hidden shrink-0 border-r transition-[width] duration-200 ease-in-out md:flex md:flex-col ${collapsed ? "md:w-20" : "md:w-64"
        }`}
    >
      {/*
        收缩/展开切换按钮

        位置固定：浮在侧边栏右边缘、垂直居中，不管收缩还是展开状态，
        按钮本身位置不变，只是图标方向和 title 提示跟着状态切换。
        这样用户不用去找按钮在哪，养成"点这个固定位置"的肌肉记忆。
      */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? "展开导航栏" : "收起导航栏"}
        className="absolute top-1/2 -right-3 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition hover:text-gray-700"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${collapsed ? "justify-center" : ""
                } ${active
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
            >
              <Icon
                size={18}
                className={`shrink-0 ${active ? "text-white" : "text-gray-400"}`}
              />

              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>

                  {item.adminOnly && (
                    <span
                      className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${active
                          ? "bg-white/15 text-white"
                          : "bg-orange-50 text-orange-600"
                        }`}
                    >
                      {item.executiveOnly ? "EXEC" : "ADMIN"}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-4">
        {!collapsed && (
          <div className="mb-3">
            <ThemeSwitcher />
          </div>
        )}

        <div
          className={`mb-3 rounded-2xl bg-gray-50 p-3 ${collapsed ? "flex justify-center" : ""
            }`}
          title={collapsed ? `${userName}（${getRoleLabel(userRole)}）` : undefined}
        >
          <div
            className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""
              }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm">
              <UserCircle size={22} />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">
                  {userName}
                </p>

                <p className="truncate text-xs text-gray-500">{userEmail}</p>

                <p className="mt-1 text-xs font-semibold text-orange-600">
                  {getRoleLabel(userRole)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={collapsed ? "flex justify-center" : ""}>
          <LogoutButton collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
