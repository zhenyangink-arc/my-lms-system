import { ManagementApplicationWorkspacePage } from "@/app/dashboard/admin/apps/ManagementApplicationWorkspacePage";

export default async function ManagementAppPage({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  return (
    <ManagementApplicationWorkspacePage space={space} appSlug={appSlug} />
  );
}
