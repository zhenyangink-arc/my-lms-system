import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import DocumentReviewListing from "@/features/document-reviews/components/document-review-listing";

export default async function ManagementAppDocumentsRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "documents",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      <DocumentReviewListing />
    </ManagementApplicationSectionFrame>
  );
}
