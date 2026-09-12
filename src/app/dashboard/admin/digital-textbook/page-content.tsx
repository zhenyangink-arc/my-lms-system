import DigitalTextbookListing from "@/features/digital-textbook/components/digital-textbook-listing";

export default function DigitalTextbookAdminPage({
  studentAppId,
  chapterId,
  courseStructureRoute,
}: {
  studentAppId: string;
  chapterId?: string;
  courseStructureRoute?: string;
}) {
  return (
    <DigitalTextbookListing
      chapterId={chapterId}
      studentAppId={studentAppId}
      courseStructureRoute={courseStructureRoute}
    />
  );
}
