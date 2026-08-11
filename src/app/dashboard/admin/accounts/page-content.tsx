import PageContainer from "@/components/layout/page-container";
import type { AccountSearchParams } from "@/features/accounts/api/types";
import AccountListing from "@/features/accounts/components/account-listing";

export const dynamic = "force-dynamic";

export default function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<AccountSearchParams>;
}) {
  return (
    <PageContainer contentClassName="mx-auto w-full max-w-[1500px]">
      <AccountListing searchParams={searchParams} />
    </PageContainer>
  );
}
