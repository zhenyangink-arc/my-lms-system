import PermissionCenterListing from "@/features/permission-center/components/permission-center-listing";

export default async function PermissionCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <PermissionCenterListing
      updated={params.updated === "1"}
      error={params.error?.slice(0, 120) ?? null}
    />
  );
}
