import DigitalTextbookListing from "@/features/digital-textbook/components/digital-textbook-listing";

export default function DigitalTextbookAdminPage({
  studentAppId,
  chapterId,
  courseStructureRoute,
  workbenchHref,
}: {
  studentAppId: string;
  chapterId?: string;
  courseStructureRoute?: string;
  workbenchHref?: string;
}) {
  return (
    <DigitalTextbookListing
      chapterId={chapterId}
      studentAppId={studentAppId}
      courseStructureRoute={courseStructureRoute}
      workbenchHref={workbenchHref}
    />
  );
}
