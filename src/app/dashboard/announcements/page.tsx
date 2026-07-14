import { Megaphone } from "lucide-react";
import { ComingSoonPage } from "../ComingSoonPage";

export default function AnnouncementsPage() {
  return (
    <ComingSoonPage
      title="通知公告"
      description="课程公告、考试通知和系统消息将在这里统一查看。"
      icon={<Megaphone size={26} style={{ color: "var(--app-accent)" }} />}
    />
  );
}