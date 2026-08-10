import TenantManagementDetailView from "@/features/tenant-management/components/tenant-management-detail-view";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <TenantManagementDetailView tenantId={tenantId} />;
}
