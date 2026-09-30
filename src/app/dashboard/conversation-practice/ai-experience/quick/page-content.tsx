import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getConversationPracticeBasePath } from "@/lib/conversation-practice";
import { requireStudentPageFeature } from "@/lib/student-permissions-server";
import { ConversationAiExperience } from "../ConversationAiExperience";
import styles from "../ai-experience.module.css";
import type { SubjectSlug } from "@/features/subjects";
import { LEGACY_DASHBOARD_APP_SLUG } from "@/app/dashboard/legacy-redirect";

export async function QuickAiExperiencePageContent({
  studentAppSlug,
}: {
  studentAppSlug: SubjectSlug;
}) {
  const { tenant } = await requireStudentPageFeature("ai_conversation_experience");
  const basePath = getConversationPracticeBasePath(tenant?.slug ?? null, studentAppSlug);

  return (
    <div className={`${styles.pageShell} min-h-[calc(100vh-76px)]`}>
      <div className="mx-auto max-w-[1500px] px-4 pt-5 sm:px-6 lg:px-8">
        <Link
          href={`${basePath}/ai-experience`}
          className="app-card inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition hover:-translate-x-0.5"
        >
          <ArrowLeft size={14} />返回选择
        </Link>
      </div>
      <ConversationAiExperience variant="quick" basePath={basePath} />
    </div>
  );
}

/** 旧 /dashboard 入口(仅教职人员可见)沿用韩语应用。 */
export default function LegacyQuickAiExperiencePage() {
  return <QuickAiExperiencePageContent studentAppSlug={LEGACY_DASHBOARD_APP_SLUG} />;
}
