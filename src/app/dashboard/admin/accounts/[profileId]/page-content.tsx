import PageContainer from "@/components/layout/page-container";
import AccountViewPage from "@/features/accounts/components/account-view-page";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;

  return (
    <PageContainer contentClassName="mx-auto w-full max-w-[1500px]">
      <AccountViewPage profileId={profileId} />
    </PageContainer>
  );
}
