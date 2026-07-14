import { Award } from "lucide-react";
import { ComingSoonPage } from "../ComingSoonPage";

export default function GradesPage() {
  return (
    <ComingSoonPage
      title="成绩管理"
      description="测验、作业和考试成绩将在这里汇总展示。"
      icon={<Award size={26} style={{ color: "var(--app-accent)" }} />}
    />
  );
}