import AccountViewPage from "@/features/accounts/components/account-view-page";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;

  return <AccountViewPage profileId={profileId} />;
}
