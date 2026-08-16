import GrowthToolboxListing from "@/features/growth-toolbox/components/growth-toolbox-listing";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

export default function GrowthToolboxAdminPage() {
  return <GrowthToolboxListing studentAppId={STUDENT_APP_IDS.korean} />;
}
