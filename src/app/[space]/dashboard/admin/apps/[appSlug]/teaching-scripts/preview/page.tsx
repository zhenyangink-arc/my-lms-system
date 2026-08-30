import { notFound } from "next/navigation";
import { z } from "zod";

import { requirePlatformOwner } from "@/lib/admin";
import { loadSmartDigitalTextbook } from "@/lib/smart-digital-textbook";
import { SmartTextbookShell } from "@/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/SmartTextbookShell";

const scriptVersionIdSchema = z.uuid();

/**
 * Lets the platform owner walk a teaching-script version's full student
 * experience without leaving the admin space. tenantId is deliberately null
 * with trackingDisabled: true, so loadSmartDigitalTextbook never queries any
 * tenant-scoped table (progress, enrollment, etc.) — this page can only ever
 * read shared course content, never a real institution's data.
 */
export default async function TeachingScriptPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string }>;
  searchParams: Promise<{ scriptVersionId?: string; startNodeKey?: string; moduleIndex?: string }>;
}) {
  const { space, appSlug } = await params;
  const { user } = await requirePlatformOwner();
  const resolvedSearchParams = await searchParams;
  const parsedScriptVersionId = scriptVersionIdSchema.safeParse(resolvedSearchParams.scriptVersionId);
  if (!parsedScriptVersionId.success) notFound();
  const startNodeKey = resolvedSearchParams.startNodeKey?.trim() || undefined;
  const parsedModuleIndex = Number(resolvedSearchParams.moduleIndex);
  const startModuleIndex = Number.isInteger(parsedModuleIndex) && parsedModuleIndex >= 0 ? parsedModuleIndex : undefined;

  const smartTextbook = await loadSmartDigitalTextbook({
    textbookSlug: "korean-level-one-smart",
    chapterNumber: 1,
    userId: user.id,
    tenantId: null,
    trackingDisabled: true,
  });

  if (!smartTextbook) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8 text-center text-sm text-[var(--muted-foreground)]">
        教材暂时不可用，无法预览。
      </div>
    );
  }

  return (
    <SmartTextbookShell
      backHref={`/${space}/dashboard/admin/apps/${appSlug}/teaching-scripts`}
      textbook={smartTextbook}
      trackingDisabled
      previewScriptVersionId={parsedScriptVersionId.data}
      previewStartNodeKey={startNodeKey}
      previewStartModuleIndex={startModuleIndex}
    />
  );
}
