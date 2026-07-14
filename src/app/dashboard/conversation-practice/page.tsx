import { MessageSquare } from "lucide-react";
import { ComingSoonPage } from "../ComingSoonPage";

export default function ConversationPracticePage() {
  return (
    <ComingSoonPage
      title="会话练习"
      description="情景对话、发音练习和 AI 对话练习将在这里进行。"
      icon={<MessageSquare size={26} style={{ color: "var(--app-accent)" }} />}
    />
  );
}