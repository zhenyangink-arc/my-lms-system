import type { SubjectManifest } from "../contracts.ts";

// 其余分区的服务仍按韩语应用查询，确认按应用隔离后再逐个启用。
// assessments：平台负责人用数学自己的出题界面（admin-slot），机构沿用平台的布置流程。
export const mathManifest: SubjectManifest = {
  slug: "math",
  contractVersion: 1,
  management: {
    sections: ["students", "content", "assessments", "settings"],
    teachingOperations: false,
    courseContentWorkflow: false,
  },
  student: {
    navigation: [{ label: "学习", items: ["home", "assignments"] }],
    navLabels: { home: "应用首页" },
    mobilePrimary: ["home", "assignments"],
    courseSearch: false,
    practiceMemory: false,
    membershipFooter: false,
    catalogOpensAllCategories: false,
    // 数学课程内容接入前首页仍显示建设中。
    homeBlocks: [],
    manualGradingNote: "其余题目仍由老师批改。",
  },
};
