import { History } from "lucide-react";
import { ComingSoonPage } from "../ComingSoonPage";

export default function LearningRecordsPage() {
  return (
    <ComingSoonPage
      title="学习记录"
      description="登录时间、学习时长和完成章节的详细记录将在这里查看。"
      icon={<History size={26} style={{ color: "var(--app-accent)" }} />}
    />
  );
}