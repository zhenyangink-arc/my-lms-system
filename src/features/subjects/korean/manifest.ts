import type { SubjectManifest } from "../contracts.ts";

export const koreanManifest: SubjectManifest = {
  slug: "korean",
  contractVersion: 1,
  management: {
    sections: [
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
    ],
    teachingOperations: true,
    courseContentWorkflow: true,
  },
  student: {
    navigation: [
      {
        label: "学习",
        items: ["home", "courses", "practice", "assignments", "conversation"],
      },
      { label: "成长记录", items: ["grades", "records", "library"] },
      { label: "消息与服务", items: ["announcements", "help"] },
    ],
    navLabels: { home: "成长首页", courses: "韩语课程" },
    mobilePrimary: ["home", "courses", "practice"],
    courseSearch: true,
    practiceMemory: true,
    membershipFooter: true,
  },
};
