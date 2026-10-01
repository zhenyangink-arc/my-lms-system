import type { SubjectManifest } from "../contracts.ts";

// 独立的“大学课程”应用（2026-10-01 用户决定：不并入 english / math，保留给专业课）。
// 现在是骨架：沿用平台已按应用隔离的页面，不含数据库改动；应用仍为“即将上线”，学生进不去。
// 管理端先只开放学生与教学分配、课程结构、应用设置；其余分区逐个确认按应用隔离后再启用。
// 学生端不含巩固中心、专项训练、会话练习、结课资格（依赖韩语内容格式或待产品决定）。
export const universityManifest: SubjectManifest = {
  slug: "university",
  contractVersion: 1,
  management: {
    sections: ["students", "content", "settings"],
    teachingOperations: false,
    courseContentWorkflow: false,
    subcategoryLabel: "专业或公共课组",
  },
  student: {
    navigation: [
      { label: "学习", items: ["home", "courses", "assignments"] },
      { label: "成长记录", items: ["grades", "records", "library"] },
      { label: "消息与服务", items: ["announcements", "help"] },
    ],
    navLabels: { home: "应用首页", courses: "大学课程" },
    mobilePrimary: ["home", "courses", "assignments"],
    courseSearch: false,
    practiceMemory: false,
    membershipFooter: false,
    catalogOpensAllCategories: true,
    // 大学课程的内容结构：大学课程 → 二级分类（专业、公共课组、通识）→ 课程 → 课时；二级分类统称“专业与公共课”。
    catalogSubcategoryLabel: "专业与公共课",
    homeBlocks: ["today-tasks", "continue-learning"],
    libraryLanguageCategoryLabel: "大学课程",
  },
};
