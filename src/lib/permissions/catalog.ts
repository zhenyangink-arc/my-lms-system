export const PLATFORM_PERMISSION_ROLES = [
  "platform_owner",
  "platform_deputy",
  "platform_admin",
  "platform_course_inspector",
] as const;

export const TENANT_PERMISSION_ROLES = [
  "tenant_super_admin",
  "ceo",
  "admin",
  "teacher",
  "student",
] as const;

export type PlatformPermissionRole = (typeof PLATFORM_PERMISSION_ROLES)[number];
export type TenantPermissionRole = (typeof TENANT_PERMISSION_ROLES)[number];
export type PermissionRole = PlatformPermissionRole | TenantPermissionRole;

export const PERMISSION_ROLE_LABELS: Record<PermissionRole, string> = {
  platform_owner: "平台负责人",
  platform_deputy: "平台副负责人",
  platform_admin: "平台管理员",
  platform_course_inspector: "课程巡检员",
  tenant_super_admin: "机构负责人",
  ceo: "运营负责人",
  admin: "管理员",
  teacher: "教师",
  student: "学生",
};

export const ASSIGNABLE_PERMISSION_KEYS = [
  "standard_question_bank.manage",
  "conversation_practice.manage",
  "grade_center.manage",
  "learning_records.manage",
  "document_reviews.manage",
  "visa_management.manage",
] as const;

export type AssignablePermissionKey = (typeof ASSIGNABLE_PERMISSION_KEYS)[number];
export type PermissionMembershipTier = "normal" | "vip1" | "vip2" | "vip3";

export const PERMISSION_MEMBERSHIP_TIER_LABELS: Record<PermissionMembershipTier, string> = {
  normal: "普通学生",
  vip1: "VIP1",
  vip2: "VIP2",
  vip3: "VIP3",
};

export const ASSIGNABLE_PERMISSION_LABELS: Record<AssignablePermissionKey, string> = {
  "standard_question_bank.manage": "标准题库管理",
  "conversation_practice.manage": "会话练习管理",
  "grade_center.manage": "成绩管理",
  "learning_records.manage": "学习记录管理",
  "document_reviews.manage": "资料审核管理",
  "visa_management.manage": "签证管理",
};

export type PermissionCapability = {
  key: string;
  label: string;
  description: string;
  platformRoles?: readonly PlatformPermissionRole[];
  tenantRoles?: readonly TenantPermissionRole[];
  explicitGrant?: AssignablePermissionKey;
  studentMinimumTier?: PermissionMembershipTier;
  fixed?: boolean;
};

export type PermissionModule = {
  key: string;
  label: string;
  group: "平台治理" | "教学运营" | "机构运营" | "留学服务" | "学生服务";
  description: string;
  capabilities: readonly PermissionCapability[];
};

const p = (...roles: PlatformPermissionRole[]) => roles;
const t = (...roles: TenantPermissionRole[]) => roles;

export const PERMISSION_MODULES: readonly PermissionModule[] = [
  {
    key: "tenant_management",
    label: "租户管理",
    group: "平台治理",
    description: "开通、停用、恢复和清理机构空间。",
    capabilities: [
      { key: "tenant.view", label: "查看租户", description: "查看全部机构及成员规模。", platformRoles: p("platform_owner", "platform_deputy"), fixed: true },
      { key: "tenant.manage", label: "开通与停用", description: "开通、停用或恢复租户。", platformRoles: p("platform_owner", "platform_deputy"), fixed: true },
      { key: "tenant.delete", label: "永久删除", description: "永久删除已停用的租户及专属账号。", platformRoles: p("platform_owner", "platform_deputy"), fixed: true },
    ],
  },
  {
    key: "account_management",
    label: "账号管理",
    group: "平台治理",
    description: "管理平台账号或本机构成员身份。",
    capabilities: [
      { key: "accounts.platform", label: "平台账号", description: "创建平台账号并调整平台角色。", platformRoles: p("platform_owner"), fixed: true },
      { key: "accounts.tenant", label: "机构账号", description: "管理本机构的员工和学生账号。", tenantRoles: t("tenant_super_admin", "ceo"), fixed: true },
      { key: "accounts.status", label: "账号状态", description: "暂停、停用或恢复可管理账号。", platformRoles: p("platform_owner"), tenantRoles: t("tenant_super_admin", "ceo"), fixed: true },
    ],
  },
  {
    key: "permission_center",
    label: "权限中心",
    group: "平台治理",
    description: "查看最终权限、分配例外权限并审计变更。",
    capabilities: [
      { key: "permissions.view", label: "查看权限", description: "查看全平台角色、账号和授权记录。", platformRoles: p("platform_owner"), fixed: true },
      { key: "permissions.manage", label: "修改权限", description: "授予或收回账号例外权限。", platformRoles: p("platform_owner"), fixed: true },
    ],
  },
  {
    key: "token_usage",
    label: "Token 用量",
    group: "平台治理",
    description: "查看 AI 功能产生的输入、输出和总 Token 用量。",
    capabilities: [
      { key: "token_usage.platform", label: "平台汇总", description: "查看所有机构的 Token 用量汇总。", platformRoles: p("platform_owner"), fixed: true },
      { key: "token_usage.tenant", label: "机构用量", description: "查看本机构的 Token 用量。", tenantRoles: t("tenant_super_admin", "ceo"), fixed: true },
    ],
  },
  {
    key: "course_management",
    label: "课程与电子书",
    group: "教学运营",
    description: "维护平台课程目录、电子书内容并执行只读巡检。",
    capabilities: [
      { key: "courses.view", label: "查看课程", description: "查看课程目录和会员档位允许的已发布内容。", platformRoles: p("platform_owner", "platform_admin", "platform_course_inspector"), tenantRoles: t("tenant_super_admin", "ceo", "admin", "teacher", "student"), studentMinimumTier: "vip1", fixed: true },
      { key: "courses.edit", label: "编辑课程", description: "创建、修改课程和章节内容。", platformRoles: p("platform_owner", "platform_admin"), fixed: true },
      { key: "courses.publish", label: "发布课程", description: "发布或撤回课程内容。", platformRoles: p("platform_owner", "platform_admin"), fixed: true },
      { key: "courses.inspect", label: "无视学习锁巡检", description: "以只读模式检查全部电子书和测试流程。", platformRoles: p("platform_owner", "platform_course_inspector"), fixed: true },
    ],
  },
  {
    key: "standard_question_bank",
    label: "标准题库",
    group: "教学运营",
    description: "维护平台标准题目并制作标准试卷。",
    capabilities: [
      { key: "question_bank.view", label: "查看题库", description: "查看平台标准题目。", platformRoles: p("platform_owner"), explicitGrant: "standard_question_bank.manage" },
      { key: "question_bank.manage", label: "维护题目", description: "新增、编辑、导入和停用题目。", platformRoles: p("platform_owner"), explicitGrant: "standard_question_bank.manage" },
    ],
  },
  {
    key: "assignments",
    label: "作业与考试",
    group: "教学运营",
    description: "制作、发布、作答和批改教学任务。",
    capabilities: [
      { key: "assignments.manage", label: "制作与发布", description: "制作试卷、发布作业和考试。", platformRoles: p("platform_owner", "platform_admin"), tenantRoles: t("tenant_super_admin", "ceo", "admin", "teacher"), fixed: true },
      { key: "assignments.grade", label: "批改", description: "查看提交并进行批改。", tenantRoles: t("tenant_super_admin", "ceo", "admin", "teacher"), fixed: true },
      { key: "assignments.submit", label: "学生作答", description: "参加测试并提交作业。", tenantRoles: t("student"), studentMinimumTier: "vip2", fixed: true },
    ],
  },
  {
    key: "conversation_practice",
    label: "会话练习",
    group: "教学运营",
    description: "维护平台场景并查看机构练习数据。",
    capabilities: [
      { key: "conversation.content", label: "维护场景", description: "新建、编辑和发布平台会话场景。", platformRoles: p("platform_owner"), fixed: true },
      { key: "conversation.manage", label: "查看练习数据", description: "查看本机构学生练习与复盘。", tenantRoles: t("tenant_super_admin", "ceo"), explicitGrant: "conversation_practice.manage" },
      { key: "conversation.practice", label: "完整会话练习", description: "进入完整会话课程场景完成练习。", tenantRoles: t("student"), studentMinimumTier: "vip3", fixed: true },
      { key: "conversation.ai", label: "AI 交流体验", description: "使用面向 VIP2 及以上学生的 AI 交流体验。", tenantRoles: t("student"), studentMinimumTier: "vip2", fixed: true },
    ],
  },
  {
    key: "announcements",
    label: "通知公告",
    group: "机构运营",
    description: "平台公告覆盖全部机构，机构公告仅覆盖本机构。",
    capabilities: [
      { key: "announcements.platform", label: "发布平台公告", description: "向全部机构及成员发布公告。", platformRoles: p("platform_owner"), fixed: true },
      { key: "announcements.tenant", label: "发布机构公告", description: "向本机构成员发布公告。", tenantRoles: t("tenant_super_admin", "ceo"), fixed: true },
      { key: "announcements.read", label: "阅读公告", description: "阅读当前账号可见的公告。", platformRoles: p("platform_owner", "platform_deputy", "platform_admin", "platform_course_inspector"), tenantRoles: t("tenant_super_admin", "ceo", "admin", "teacher", "student"), fixed: true },
    ],
  },
  {
    key: "help_center",
    label: "帮助中心",
    group: "机构运营",
    description: "学生提问、教师回复，机构负责人维护文章和分配工单。",
    capabilities: [
      { key: "help.overview", label: "平台总览", description: "查看各机构工单统计，不处理学生个案。", platformRoles: p("platform_owner"), fixed: true },
      { key: "help.articles", label: "维护帮助文章", description: "维护本机构帮助文章。", tenantRoles: t("tenant_super_admin", "ceo"), fixed: true },
      { key: "help.reply", label: "回复学生", description: "查看并回复本机构学生工单。", tenantRoles: t("tenant_super_admin", "ceo", "teacher"), fixed: true },
      { key: "help.ask", label: "提交问题", description: "学生提交并追踪自己的问题。", tenantRoles: t("student"), fixed: true },
    ],
  },
  {
    key: "grade_center",
    label: "成绩管理",
    group: "教学运营",
    description: "平台查看机构汇总，机构维护成绩与复核。",
    capabilities: [
      { key: "grades.platform", label: "平台汇总", description: "查看机构级成绩汇总，不进入学生明细。", platformRoles: p("platform_owner"), fixed: true },
      { key: "grades.manage", label: "维护成绩", description: "维护本机构成绩项目、记录和复核。", tenantRoles: t("tenant_super_admin", "ceo"), explicitGrant: "grade_center.manage" },
      { key: "grades.own", label: "查看本人成绩", description: "学生查看自己的成绩和复核状态。", tenantRoles: t("student"), studentMinimumTier: "vip1", fixed: true },
    ],
  },
  {
    key: "learning_records",
    label: "学习记录",
    group: "教学运营",
    description: "平台查看机构汇总，机构维护辅导记录。",
    capabilities: [
      { key: "records.platform", label: "平台汇总", description: "查看机构级记录统计。", platformRoles: p("platform_owner"), fixed: true },
      { key: "records.manage", label: "维护记录", description: "维护本机构学生辅导和学习计划。", tenantRoles: t("tenant_super_admin", "ceo"), explicitGrant: "learning_records.manage" },
      { key: "records.own", label: "查看本人记录", description: "学生查看允许公开的本人记录。", tenantRoles: t("student"), studentMinimumTier: "vip1", fixed: true },
    ],
  },
  {
    key: "library",
    label: "资料库",
    group: "教学运营",
    description: "资料由平台负责人维护，机构成员仅查看和下载。",
    capabilities: [
      { key: "library.curate", label: "整理与上传", description: "按课程整理、上传、发布和删除资料。", platformRoles: p("platform_owner"), fixed: true },
      { key: "library.download", label: "查看与下载", description: "查看并下载已发布资料。", platformRoles: p("platform_owner"), tenantRoles: t("tenant_super_admin", "ceo", "admin", "teacher", "student"), studentMinimumTier: "vip1", fixed: true },
    ],
  },
  {
    key: "universities",
    label: "韩国大学",
    group: "留学服务",
    description: "平台维护大学资料，机构只读。",
    capabilities: [
      { key: "universities.view", label: "查看大学资料", description: "查看大学、申请条件和签证资料。", platformRoles: p("platform_owner", "platform_deputy", "platform_admin"), tenantRoles: t("tenant_super_admin", "ceo", "admin", "teacher", "student"), studentMinimumTier: "vip1", fixed: true },
      { key: "universities.edit", label: "新增与编辑", description: "新增大学并维护申请和签证内容。", platformRoles: p("platform_owner", "platform_admin"), fixed: true },
      { key: "universities.delete", label: "永久删除", description: "永久删除大学资料。", platformRoles: p("platform_owner"), fixed: true },
    ],
  },
  {
    key: "document_reviews",
    label: "资料审核",
    group: "留学服务",
    description: "平台查看机构概览，机构处理学生申请资料。",
    capabilities: [
      { key: "documents.platform", label: "平台总览", description: "查看各机构资料审核汇总。", platformRoles: p("platform_owner"), fixed: true },
      { key: "documents.manage", label: "审核资料", description: "处理本机构学生资料和审核状态。", tenantRoles: t("tenant_super_admin", "ceo"), explicitGrant: "document_reviews.manage" },
      { key: "documents.own", label: "学生资料", description: "学生查看和提交自己的申请资料。", tenantRoles: t("student"), studentMinimumTier: "vip1", fixed: true },
    ],
  },
  {
    key: "visa_management",
    label: "签证管理",
    group: "留学服务",
    description: "平台查看机构概览，机构处理签证档案。",
    capabilities: [
      { key: "visa.platform", label: "平台总览", description: "查看各机构签证业务汇总。", platformRoles: p("platform_owner"), fixed: true },
      { key: "visa.manage", label: "维护签证", description: "处理本机构签证档案和任务。", tenantRoles: t("tenant_super_admin", "ceo"), explicitGrant: "visa_management.manage" },
      { key: "visa.own", label: "本人签证", description: "学生查看和推进自己的签证任务。", tenantRoles: t("student"), studentMinimumTier: "vip1", fixed: true },
    ],
  },
] as const;

export function isAssignablePermissionKey(value: string): value is AssignablePermissionKey {
  return (ASSIGNABLE_PERMISSION_KEYS as readonly string[]).includes(value);
}

export function roleHasCapability(role: PermissionRole, capability: PermissionCapability) {
  return (
    capability.platformRoles?.includes(role as PlatformPermissionRole) === true ||
    capability.tenantRoles?.includes(role as TenantPermissionRole) === true
  );
}

export function studentTierMeetsMinimum(
  current: PermissionMembershipTier,
  minimum: PermissionMembershipTier | undefined
) {
  if (!minimum) return true;
  const order: Record<PermissionMembershipTier, number> = {
    normal: 0,
    vip1: 1,
    vip2: 2,
    vip3: 3,
  };
  return order[current] >= order[minimum];
}

export function getCapabilitiesForGrant(permissionKey: AssignablePermissionKey) {
  return PERMISSION_MODULES.flatMap((module) =>
    module.capabilities
      .filter((capability) => capability.explicitGrant === permissionKey)
      .map((capability) => ({ module, capability }))
  );
}
