import { ManagementApplicationSectionPage } from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppSectionRoute({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string; section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { space, appSlug, section } = await params;
  return (
    <ManagementApplicationSectionPage
      space={space}
      appSlug={appSlug}
      section={section}
      searchParams={searchParams}
    />
  );
}
