import { ManagementApplicationAssessmentPage } from "@/app/dashboard/admin/apps/ManagementApplicationAssessmentPage";
import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppAssessmentsRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "assessments",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      <ManagementApplicationAssessmentPage access={context.access} />
    </ManagementApplicationSectionFrame>
  );
}
