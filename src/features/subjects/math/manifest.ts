import type { SubjectManifest } from "../contracts.ts";

// 其余分区的服务仍按韩语应用查询，确认按应用隔离后再逐个启用。
export const mathManifest: SubjectManifest = {
  slug: "math",
  contractVersion: 1,
  management: {
    sections: ["students", "content", "settings"],
    teachingOperations: false,
    courseContentWorkflow: false,
  },
  student: {
    navigation: [{ label: "应用导航", items: ["home"] }],
    navLabels: { home: "应用首页" },
    mobilePrimary: ["home"],
    courseSearch: false,
    practiceMemory: false,
    membershipFooter: false,
    catalogOpensAllCategories: false,
  },
};
