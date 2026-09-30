import { ConversationScenarioPageContent } from "@/app/dashboard/conversation-practice/[scenarioId]/page-content";

export default function KoreanConversationScenarioPage({
  params,
}: {
  params: Promise<{ space: string; scenarioId: string }>;
}) {
  return <ConversationScenarioPageContent params={params} studentAppSlug="korean" />;
}
