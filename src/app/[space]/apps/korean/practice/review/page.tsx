import { DeepLearningPage } from "@/app/dashboard/progress/page-content";

export default function KoreanReviewPracticePage({
  searchParams,
}: {
  searchParams: Promise<{
    area?: string;
    course?: string;
    chapter?: string;
  }>;
}) {
  return <DeepLearningPage searchParams={searchParams} forcedArea="review" />;
}
