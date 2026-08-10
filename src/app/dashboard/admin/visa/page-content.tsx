import VisaManagementListing from "@/features/visa-management/components/visa-management-listing";

const VALID_FILTERS = new Set([
  "all",
  "action",
  "preparing",
  "submitted",
  "issued",
]);

type VisaCaseStatusFilter =
  | "all"
  | "action"
  | "preparing"
  | "submitted"
  | "issued";

export default async function AdminVisaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const requestedStatus = params.status ?? "all";

  return (
    <VisaManagementListing
      initialQuery={(params.q ?? "").trim().slice(0, 80)}
      initialStatus={
        (VALID_FILTERS.has(requestedStatus)
          ? requestedStatus
          : "all") as VisaCaseStatusFilter
      }
      deleted={params.deleted === "1"}
    />
  );
}
