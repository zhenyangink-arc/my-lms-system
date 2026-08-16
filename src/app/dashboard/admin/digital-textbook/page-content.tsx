import DigitalTextbookListing from "@/features/digital-textbook/components/digital-textbook-listing";

export default function DigitalTextbookAdminPage({ studentAppId }: { studentAppId: string }) {
  return <DigitalTextbookListing studentAppId={studentAppId} />;
}
