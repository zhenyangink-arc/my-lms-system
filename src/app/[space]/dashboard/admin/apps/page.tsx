import { ManagementApplicationCatalogPage } from "@/app/dashboard/admin/apps/ManagementApplicationCatalogPage";

export default async function ManagementAppsPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  return <ManagementApplicationCatalogPage space={space} />;
}
