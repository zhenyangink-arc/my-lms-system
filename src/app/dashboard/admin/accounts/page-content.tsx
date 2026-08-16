import type { AccountSearchParams } from "@/features/accounts/api/types";
import AccountListing from "@/features/accounts/components/account-listing";

export const dynamic = "force-dynamic";

export default function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<AccountSearchParams>;
}) {
  return <AccountListing searchParams={searchParams} />;
}
