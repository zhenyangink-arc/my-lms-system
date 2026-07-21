import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ConversationAiExperience } from "./ConversationAiExperience";
import styles from "./ai-experience.module.css";


export default function AiExperiencePage() {
  return <div className={`${styles.pageShell} min-h-[calc(100vh-76px)]`}><div className="mx-auto max-w-[1500px] px-4 pt-5 sm:px-6 lg:px-8"><Link href="/dashboard/conversation-practice" className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-card-bg)]/80 px-4 py-2 text-xs font-black text-[var(--app-text-soft)] shadow-sm transition hover:-translate-x-0.5 hover:bg-[var(--app-card-bg)]"><ArrowLeft size={14} />返回口语练习</Link></div><ConversationAiExperience /></div>;
}
