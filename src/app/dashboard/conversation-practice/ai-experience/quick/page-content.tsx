import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireStudentPageFeature } from "@/lib/student-permissions-server";
import { ConversationAiExperience } from "../ConversationAiExperience";
import styles from "../ai-experience.module.css";

export default async function QuickAiExperiencePage() {
  await requireStudentPageFeature("ai_conversation_experience");

  return (
    <div className={`${styles.pageShell} min-h-[calc(100vh-76px)]`}>
      <div className="mx-auto max-w-[1500px] px-4 pt-5 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/conversation-practice/ai-experience"
          className="app-card inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black transition hover:-translate-x-0.5"
        >
          <ArrowLeft size={14} />返回选择
        </Link>
      </div>
      <ConversationAiExperience variant="quick" />
    </div>
  );
}
