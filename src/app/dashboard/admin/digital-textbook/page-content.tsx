import DigitalTextbookListing from "@/features/digital-textbook/components/digital-textbook-listing";

export default function DigitalTextbookAdminPage({
  studentAppId,
  courseStructureRoute,
}: {
  studentAppId: string;
  courseStructureRoute?: string;
}) {
  return (
    <DigitalTextbookListing
      studentAppId={studentAppId}
      courseStructureRoute={courseStructureRoute}
    />
  );
}
