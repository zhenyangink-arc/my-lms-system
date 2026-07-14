import { Cog } from "lucide-react";
import { ComingSoonPage } from "../ComingSoonPage";

export default function SettingsPage() {
  return (
    <ComingSoonPage
      title="设置"
      description="通知方式、界面语言和学习偏好将在这里调整。"
      icon={<Cog size={26} style={{ color: "var(--app-accent)" }} />}
    />
  );
}