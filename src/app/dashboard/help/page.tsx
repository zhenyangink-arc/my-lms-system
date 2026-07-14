import { HelpCircle } from "lucide-react";
import { ComingSoonPage } from "../ComingSoonPage";

export default function HelpCenterPage() {
  return (
    <ComingSoonPage
      title="帮助中心"
      description="平台使用说明和常见问题解答将在这里提供。"
      icon={<HelpCircle size={26} style={{ color: "var(--app-accent)" }} />}
    />
  );
}