"use client";

import { usePathname } from "next/navigation";

import { normalizeDashboardPathname } from "@/lib/dashboard-path";

type HeaderCopy = { title: string; description: string };

const ROUTE_HEADERS: Record<string, HeaderCopy> = {
  admin: { title: "管理首页", description: "查看关键数据、待办事项和当前账号可以使用的管理功能。" },
  accounts: { title: "账号管理", description: "管理平台与机构账号、角色、状态和服务档位。" },
  assignments: { title: "作业与考试", description: "创建、发布并批改作业、考试和章节测试。" },
  announcements: { title: "通知公告", description: "发布和管理面向平台或机构成员的通知。" },
  courses: { title: "课程管理", description: "维护课程目录、课时、章节、资源和开放规则。" },
  "conversation-practice": { title: "会话练习", description: "维护会话练习场景、发布状态和学生练习记录。" },
  "digital-textbook": { title: "互动教材", description: "管理互动教材的课程结构、词汇和语法内容。" },
  documents: { title: "资料审核", description: "审核学生提交的申请材料和补充资料。" },
  grades: { title: "成绩管理", description: "查看作业、测试成绩及学生学习表现。" },
  "growth-toolbox": { title: "成长工具箱", description: "维护成长工具箱中的课程、词汇和语法结构。" },
  help: { title: "帮助中心", description: "管理帮助文章、学生工单和回复记录。" },
  "home-tree": { title: "课程树管理", description: "配置学生成长首页展示的课程分类和课程。" },
  library: { title: "资料库", description: "维护学生可访问的学习资料和资源。" },
  "my-students": { title: "我的学生", description: "查看当前账号负责的学生及其课程情况。" },
  permissions: { title: "权限管理", description: "查看角色继承、例外授权、数据范围和操作记录。" },
  profile: { title: "个人信息", description: "维护当前管理账号的姓名、头像和登录信息。" },
  "question-bank": { title: "标准题库", description: "维护课程题目、语言题库和章节题目。" },
  records: { title: "学习记录", description: "查看和维护学生的学习档案与课程记录。" },
  schools: { title: "学校管理", description: "管理学校档案、介绍、专业和发布状态。" },
  "student-assignments": { title: "学生分配", description: "把学生分配给负责老师并检查机构覆盖情况。" },
  tenants: { title: "机构管理", description: "管理机构空间、负责人、成员规模和运行状态。" },
  "token-usage": { title: "模型用量", description: "查看智能对话的输入、输出和总用量明细。" },
  universities: { title: "韩国大学", description: "维护韩国大学排名、学费、申请和签证要求。" },
  visa: { title: "签证管理", description: "跟踪学生签证材料、办理阶段和审核任务。" },
};

function resolveHeader(pathname: string): HeaderCopy {
  const segments = normalizeDashboardPathname(pathname).split("/").filter(Boolean);
  const adminIndex = segments.indexOf("admin");
  const route = adminIndex >= 0 ? segments.slice(adminIndex + 1) : [];
  const section = route[0] ?? "admin";
  const base = ROUTE_HEADERS[section] ?? ROUTE_HEADERS.admin;

  if (section === "accounts" && route[1]) return { title: "账号档案", description: "查看成员资料、学习背景、服务档位和变更记录。" };
  if (section === "assignments" && route[1] === "homework") return { title: "作业管理", description: "创建、发布并批改标准作业。" };
  if (section === "assignments" && route[1] === "exam") return { title: "考试管理", description: "创建、发布并管理标准考试。" };
  if (section === "assignments" && route[1] === "chapter-tests") return { title: "章节测试", description: "维护课程章节测试和题目配置。" };
  if (section === "assignments" && route[1] && !["homework", "exam", "chapter-tests"].includes(route[1])) return { title: "作业详情", description: "查看任务设置、学生提交、批改状态和成绩。" };
  if (section === "conversation-practice" && route[1]) return { title: "会话练习详情", description: "编辑练习内容、发布状态并预览学生端效果。" };
  if (section === "documents" && route[1]) return { title: "学生资料详情", description: "查看学生申请目标、资料清单和审核记录。" };
  if (section === "grades" && route[1]) return { title: "成绩详情", description: "查看成绩来源、评分结果和相关学习记录。" };
  if (section === "help" && route[1] === "tickets") return { title: "工单详情", description: "查看问题内容、沟通记录和当前处理状态。" };
  if (section === "schools" && route[1] === "overview") return { title: "学校总览", description: "检查学校数量、发布状态和资料完整度。" };
  if (section === "schools" && route.length >= 3) return { title: "学校详情", description: "维护学校基础资料、详细介绍和专业信息。" };
  if (section === "schools" && route[1]) return { title: "学校分类管理", description: "管理当前分类下的学校档案和展示状态。" };
  if (section === "tenants" && route[1] === "history") return { title: "机构操作记录", description: "查看停用机构、恢复记录和删除审计。" };
  if (section === "tenants" && route[1]) return { title: "机构详情", description: "管理机构状态、负责人、成员和套餐信息。" };
  if (section === "visa" && route[1]) return { title: "签证办理详情", description: "查看学生签证目标、任务进度和审核记录。" };
  return base;
}

export function ManagementRouteHeader() {
  const copy = resolveHeader(usePathname());
  return (
    <header className="management-route-header">
      <div className="min-w-0">
        <h1 className="management-route-title">{copy.title}</h1>
        <p className="management-route-description">{copy.description}</p>
      </div>
    </header>
  );
}
