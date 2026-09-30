import type { SubjectManifest } from "../contracts.ts";

// 管理端：其余分区的服务确认按应用隔离后再逐个启用。
// 学生端：只接入已按应用隔离的平台页面。巩固中心、专项训练依赖韩语内容格式，
// 会话练习依赖 AI 陪练定位，待英语内容与产品决定后再加入。
export const englishManifest: SubjectManifest = {
  slug: "english",
  contractVersion: 1,
  management: {
    sections: ["students", "content", "settings"],
    teachingOperations: false,
    courseContentWorkflow: false,
  },
  student: {
    navigation: [
      { label: "学习", items: ["home", "courses", "assignments"] },
      { label: "成长记录", items: ["grades", "records", "library"] },
      { label: "消息与服务", items: ["announcements", "help"] },
    ],
    navLabels: { home: "应用首页", courses: "英语课程" },
    mobilePrimary: ["home", "courses", "assignments"],
    courseSearch: false,
    practiceMemory: false,
    membershipFooter: false,
    catalogOpensAllCategories: true,
    homeBlocks: ["today-tasks", "continue-learning", "ability-portrait"],
  },
};
