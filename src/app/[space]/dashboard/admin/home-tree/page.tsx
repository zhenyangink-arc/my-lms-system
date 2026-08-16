import { redirectLegacyManagementRoute } from "@/app/dashboard/admin/legacy-app-route";

export default async function LegacyHomeTreePage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  redirectLegacyManagementRoute(space, "korean", "content");
}
