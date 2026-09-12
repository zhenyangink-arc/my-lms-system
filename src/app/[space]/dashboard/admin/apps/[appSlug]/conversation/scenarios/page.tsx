import Link from "next/link";
import { notFound } from "next/navigation";
import { ConversationPracticeManagementContent } from "@/app/dashboard/admin/conversation-practice/page-content";
import { ManagementApplicationSectionFrame, requireManagementApplicationSection, firstSectionParam, type SectionSearchParams } from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";

export default async function PlatformConversationScenarios({ params, searchParams }: { params: Promise<{ space: string; appSlug: string }>; searchParams: Promise<SectionSearchParams> }) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(space, appSlug, "conversation");
  if (context.access.scope !== "platform" || context.access.globalRole !== "platform_owner" || appSlug !== "korean") notFound();
  const query = await searchParams;
  return <ManagementApplicationSectionFrame {...context}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <CardTitleWithHint headingLevel={2} title="平台会话场景" description="统一维护各机构共用的韩语会话场景。草稿保存后可继续编辑，发布后学生可在已开放应用中练习；归档不删除历史练习记录。" titleClassName="text-base font-semibold" />
      <Link href={`${context.access.appPath}/conversation`} className="inline-flex min-h-11 items-center border px-3 text-sm">返回会话与课堂</Link>
    </div>
    <ConversationPracticeManagementContent embedded platformCatalog studentAppId={context.access.appId} routeBasePath={`${context.access.appPath}/conversation/scenarios`} searchParams={Promise.resolve({ scenario: firstSectionParam(query.scenario), mode: firstSectionParam(query.mode) })} />
  </ManagementApplicationSectionFrame>;
}
