import type { StudentAppSlug } from "@/lib/student-apps";

/**
 * 学科模块契约。学科标识就是学习类学生应用的 slug，数据库中对应
 * student_app_id；这里不引入第二套“学科”身份。
 *
 * 清单只保存可序列化的纯数据，服务端组件和客户端组件都可以读取；
 * 图标、链接和权限由平台目录维护，学科只声明启用和排序。
 */
export type SubjectSlug = Extract<StudentAppSlug, "korean" | "english" | "math">;

export const MANAGEMENT_SECTION_KEYS = [
  "learning-plans",
  "class-today",
  "students",
  "content",
  "assessments",
  "textbooks",
  "teaching-scripts",
  "grades",
  "records",
  "toolbox",
  "practice-center",
  "practice-insights",
  "conversation",
  "completion-review",
  "settings",
] as const;

export type ManagementSectionKey = (typeof MANAGEMENT_SECTION_KEYS)[number];

export const STUDENT_NAV_KEYS = [
  "home",
  "courses",
  "practice",
  "assignments",
  "conversation",
  "grades",
  "records",
  "library",
  "announcements",
  "help",
] as const;

export type StudentNavKey = (typeof STUDENT_NAV_KEYS)[number];

/** 平台首页框架提供的区块；学科按需启用。 */
export const STUDENT_HOME_BLOCK_KEYS = [
  "today-tasks",
  "continue-learning",
  "ability-portrait",
] as const;

export type StudentHomeBlockKey = (typeof STUDENT_HOME_BLOCK_KEYS)[number];

export type StudentNavGroup = {
  label: string;
  items: readonly StudentNavKey[];
};

export type SubjectManifest = {
  slug: SubjectSlug;
  contractVersion: 1;
  management: {
    /** 学科启用的管理端分区；不在列表中的分区对该学科不可访问。 */
    sections: readonly ManagementSectionKey[];
    /** 显示教学运营导航。 */
    teachingOperations: boolean;
    /** 显示课程结构、教材、脚本、练习的制作流程导航。 */
    courseContentWorkflow: boolean;
  };
  student: {
    navigation: readonly StudentNavGroup[];
    /** 覆盖平台导航目录中的默认显示名。 */
    navLabels?: Partial<Record<StudentNavKey, string>>;
    /** 手机端底部主入口。 */
    mobilePrimary: readonly StudentNavKey[];
    /** 顶栏课程搜索。 */
    courseSearch: boolean;
    /** 巩固中心记住上次打开的分区。 */
    practiceMemory: boolean;
    /** 侧边栏底部显示学员姓名和会员档位。 */
    membershipFooter: boolean;
    /**
     * 课程目录中所有顶层分类都提供学习入口。为 false 时沿用旧规则：
     * 只有主线分类可进入，其余分类显示为“努力完善中”。
     */
    catalogOpensAllCategories: boolean;
    /** 学科首页启用的平台区块（今日任务、继续学习、能力画像），按列表顺序显示。 */
    homeBlocks: readonly StudentHomeBlockKey[];
    /** 资料库“语言学习”分类在本学科中的显示名；不设置时沿用平台默认名称。 */
    libraryLanguageCategoryLabel?: string;
  };
};
