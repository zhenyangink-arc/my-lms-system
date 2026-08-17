import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  BookOpen,
  Bot,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  History,
  LayoutDashboard,
  Library,
  Megaphone,
  MessageSquare,
  Mic2,
  Settings,
  ShieldCheck,
  Target,
  UserCircle,
  Wrench,
} from "lucide-react";

import {
  getStudentAppDefinition,
  type StudentAppSlug,
} from "@/lib/student-apps";

type HeaderConfig = {
  title: string;
  icon: LucideIcon;
};

function resolveHeaderConfig(
  pathname: string,
  studentAppSlug?: StudentAppSlug,
): HeaderConfig {
  if (pathname === "/dashboard") {
    if (studentAppSlug) {
      return {
        title: getStudentAppDefinition(studentAppSlug).title,
        icon: studentAppSlug === "study-abroad" ? GraduationCap : LayoutDashboard,
      };
    }
    return { title: "成长首页", icon: LayoutDashboard };
  }

  if (pathname.startsWith("/dashboard/conversation-practice/ai-experience/practice")) {
    return { title: "正式练习", icon: Mic2 };
  }
  if (pathname.startsWith("/dashboard/conversation-practice/ai-experience/quick")) {
    return { title: "快速体验", icon: Bot };
  }
  if (pathname.startsWith("/dashboard/conversation-practice/ai-experience")) {
    return { title: "AI 韩语交流", icon: Bot };
  }
  if (pathname.startsWith("/dashboard/conversation-practice")) {
    return { title: "会话练习", icon: MessageSquare };
  }

  if (pathname.startsWith("/dashboard/courses")) {
    return { title: studentAppSlug === "korean" ? "韩语课程" : "我的课程", icon: BookOpen };
  }
  if (pathname.startsWith("/dashboard/practice")) {
    return { title: "巩固中心", icon: Target };
  }
  if (pathname.startsWith("/dashboard/progress")) {
    return { title: "深化学习", icon: BarChart3 };
  }
  if (pathname.startsWith("/dashboard/toolbox")) {
    return { title: "专项练习", icon: Wrench };
  }
  if (pathname.startsWith("/dashboard/assignments")) {
    return { title: "学习任务", icon: ClipboardList };
  }
  if (pathname.startsWith("/dashboard/grades")) {
    return { title: "我的成绩", icon: Award };
  }
  if (pathname.startsWith("/dashboard/records")) {
    return { title: "学习记录", icon: History };
  }
  if (pathname.startsWith("/dashboard/library")) {
    return { title: "学习资料库", icon: Library };
  }

  if (/^\/dashboard\/universities\/library\/[^/]+/.test(pathname)) {
    return { title: "大学详情", icon: GraduationCap };
  }
  if (pathname.startsWith("/dashboard/universities/library")) {
    return { title: "大学学校库", icon: Library };
  }
  if (pathname.startsWith("/dashboard/universities/comparison")) {
    return { title: "学校对比", icon: GraduationCap };
  }
  if (pathname.startsWith("/dashboard/universities/targets")) {
    return { title: "我的目标学校", icon: GraduationCap };
  }
  if (pathname.startsWith("/dashboard/universities")) {
    return { title: "目标大学", icon: GraduationCap };
  }
  if (pathname.startsWith("/dashboard/documents")) {
    return { title: "申请材料", icon: FileText };
  }
  if (pathname.startsWith("/dashboard/visa")) {
    return { title: "签证准备", icon: ShieldCheck };
  }

  if (pathname.startsWith("/dashboard/announcements")) {
    return { title: "通知公告", icon: Megaphone };
  }
  if (pathname.startsWith("/dashboard/help")) {
    return { title: "帮助中心", icon: HelpCircle };
  }
  if (pathname.startsWith("/dashboard/profile")) {
    return { title: "个人资料", icon: UserCircle };
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return { title: "设置", icon: Settings };
  }

  return { title: "学习中心", icon: LayoutDashboard };
}

export function StudentPageHeader({
  pathname,
  studentAppSlug,
}: {
  pathname: string;
  studentAppSlug?: StudentAppSlug;
}) {
  const { title, icon: PageIcon } = resolveHeaderConfig(pathname, studentAppSlug);

  return (
    <div className="app-student-page-header mx-auto w-full max-w-[1500px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <header className="flex items-center justify-between gap-3">
        <div className="app-glass-card flex min-w-0 items-center gap-2 rounded-2xl px-4 py-2.5 sm:px-5">
          <PageIcon
            size={18}
            style={{ color: "var(--primary-hover)" }}
            aria-hidden={true}
          />
          <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
            {title}
          </h1>
        </div>
      </header>
    </div>
  );
}
