import {
  firstSectionParam,
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
  type SectionSearchParams,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import VisaManagementListing from "@/features/visa-management/components/visa-management-listing";

const VALID_STATUSES = new Set([
  "all",
  "action",
  "preparing",
  "submitted",
  "issued",
]);

export default async function ManagementAppVisaRoute({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string }>;
  searchParams: Promise<SectionSearchParams>;
}) {
  const { space, appSlug } = await params;
  const [context, query] = await Promise.all([
    requireManagementApplicationSection(space, appSlug, "visa"),
    searchParams,
  ]);
  const requestedStatus = firstSectionParam(query.status) ?? "all";
  const initialStatus = VALID_STATUSES.has(requestedStatus)
    ? requestedStatus
    : "all";

  return (
    <ManagementApplicationSectionFrame {...context}>
      <VisaManagementListing
        initialQuery={(firstSectionParam(query.q) ?? "").trim().slice(0, 80)}
        initialStatus={
          initialStatus as
            | "all"
            | "action"
            | "preparing"
            | "submitted"
            | "issued"
        }
        deleted={firstSectionParam(query.deleted) === "1"}
      />
    </ManagementApplicationSectionFrame>
  );
}
