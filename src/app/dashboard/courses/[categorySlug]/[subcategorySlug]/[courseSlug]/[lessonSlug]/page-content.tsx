import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
    ArrowLeft,
    ArrowRight,
    BookOpenCheck,
    CheckCircle2,
    Clock,
    Download,
    FileText,
    GraduationCap,
    Hash,
    ListChecks,
    Lightbulb,
    LockKeyhole,
    NotebookPen,
    TriangleAlert,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { LiveClassEntryBanner } from "@/app/dashboard/live/LiveClassEntryBanner";
import { isPlatformCourseAuditorRole } from "@/lib/admin";
import {
    getKoreanBeginnerLesson,
    hangulIntroductionChapters,
} from "@/lib/korean-curriculum";
import type { KoreanEbookProgressMap } from "@/lib/korean-ebook-progress";
import {
    HANGUL_TEST_SEQUENCE,
} from "@/lib/korean-learning-unlocks";
import { getUnlockedChapterSlugs, isLessonUnlocked } from "@/lib/course-unlocks";
import { createR2SignedVideoUrl } from "@/lib/r2";
import { canUseStudentFeature, normalizeMembershipTier } from "@/lib/student-permissions";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { LessonSupportSheet } from "./LessonSupportSheet";
import { HangulInteractiveBook } from "./HangulInteractiveBook";
import { SmartTextbookShell } from "./SmartTextbookShell";
import { LessonCollapsibleCard } from "./LessonCollapsibleCard";
import { LessonActivityBoundary } from "./LessonActivityBoundary";
import { LessonProgressStatusCard } from "./LessonProgressStatusCard";
import { LessonVideoPlayer } from "./LessonVideoPlayer";
import {
    loadSmartDigitalTextbook,
    loadSmartDigitalTextbookChapterProgress,
} from "@/lib/smart-digital-textbook";
import { createAdminClient } from "@/lib/supabase/admin";


type TeacherStatus = "online" | "busy" | "away" | "offline";

type QuestionTarget = "teacher" | "ai" | "both";

type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type Course = {
    id: string;
    category_id: string | null;
    slug: string;
    title: string;
    description: string | null;
    level: string | null;
    support_teacher_name: string | null;
    support_teacher_status: TeacherStatus | null;
    ai_support_enabled: boolean;
    support_message: string | null;
};

type CourseCategory = {
    id: string;
    parent_id: string | null;
    slug: string;
    title: string;
    description: string | null;
    accent_color: string | null;
};

type Lesson = {
    id: string;
    course_id: string;
    slug: string;
    title: string;
    description: string | null;
    lesson_type: string;
    duration_minutes: number;
    is_free_preview: boolean;
    content_text: string | null;
    video_url: string | null;
    video_provider: string | null;
    video_object_key: string | null;
    video_mime_type: string | null;
    attachment_url: string | null;
    attachment_label: string | null;
    teacher_note: string | null;
    allow_questions: boolean;
    sort_order: number;
    unlock_mode: string | null;
    prerequisite_lesson_id: string | null;
    prerequisite_chapter_id: string | null;
    available_from: string | null;
    is_manually_locked: boolean | null;

    learning_objectives: string | null;
    lesson_tasks: string | null;
    key_points: string | null;
    case_study: string | null;
    common_mistakes: string | null;
    summary_text: string | null;
    reflection_questions: string | null;
    extra_note: string | null;
};

type LessonResource = {
    id: string;
    title: string;
    description: string | null;
    resource_type: string;
    resource_url: string | null;
    resource_object_key: string | null;
    original_file_name: string | null;
    is_required: boolean;
    sort_order: number;
};

type LessonQuestion = {
    id: string;
    title: string;
    message: string;
    question_target: string;
    status: string;
    ai_answer: string | null;
    teacher_answer: string | null;
    teacher_name: string | null;
    created_at: string;
};

type LessonNavItem = {
    id: string;
    slug: string;
    title: string;
    sort_order: number;
};

type LessonProgress = {
    status: LessonProgressStatus;
    progress_percent: number;
};

const lessonTypeLabelMap: Record<string, string> = {
    text: "文字课",
    video: "视频课",
    quiz: "测验",
    document: "资料",
};

const resourceTypeLabelMap: Record<string, string> = {
    file: "文件",
    link: "链接",
    template: "模板",
    checklist: "清单",
    reference: "参考资料",
};

const colorMap: Record<
    string,
    {
        iconBox: string;
        iconText: string;
        badge: string;
    }
> = {
    indigo: {
        iconBox: "app-soft-card border",
        iconText: "text-[var(--primary)]",
        badge: "app-soft-card border",
    },
    blue: {
        iconBox: "app-soft-card border",
        iconText: "text-[var(--primary)]",
        badge: "app-soft-card border",
    },
    emerald: {
        iconBox: "app-soft-card border",
        iconText: "text-[var(--primary)]",
        badge: "app-soft-card border",
    },
    purple: {
        iconBox: "app-soft-card border",
        iconText: "text-[var(--primary)]",
        badge: "app-soft-card border",
    },
    orange: {
        iconBox: "app-soft-card border",
        iconText: "text-[var(--primary)]",
        badge: "app-soft-card border",
    },
};

function resolveTeacherStatus(status: string | null | undefined): TeacherStatus {
    if (
        status === "online" ||
        status === "busy" ||
        status === "away" ||
        status === "offline"
    ) {
        return status;
    }

    return "offline";
}

function resolveProgressStatus(
    status: string | null | undefined
): LessonProgressStatus {
    if (
        status === "not_started" ||
        status === "in_progress" ||
        status === "completed"
    ) {
        return status;
    }

    return "not_started";
}

function TextContent({ content }: { content: string | null }) {
    if (!content) {
        return null;
    }

    return (
        <div className="max-w-[75ch] whitespace-pre-line text-sm leading-7 text-gray-700">
            {content}
        </div>
    );
}

function WorkspaceSectionTitle({
    index,
    title,
    description,
}: {
    index: string;
    title: string;
    description: string;
}) {
    return (
        <div className="mb-4 flex justify-center text-center">
            <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-bold tracking-widest text-gray-400">
                    {index}
                </span>

                <CardTitleWithHint
                    title={title}
                    description={description}
                    headingLevel={3}
                    titleClassName="text-lg font-bold tracking-tight text-gray-900"
                />
            </div>
        </div>
    );
}

export default async function LessonDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{
        categorySlug: string;
        subcategorySlug: string;
        courseSlug: string;
        lessonSlug: string;
    }>;
    searchParams: Promise<{
        chapter?: string | string[];
    }>;
}) {
    const { categorySlug, subcategorySlug, courseSlug, lessonSlug } =
        await params;
    const requestedChapterValue = (await searchParams).chapter;
    const requestedChapter =
        typeof requestedChapterValue === "string"
            ? requestedChapterValue
            : undefined;

    const { supabase, user, profile, platformProfile, tenant } = await requireActiveUser();
    const admin = createAdminClient();
    const isPlatformAudit = isPlatformCourseAuditorRole(platformProfile?.role);

    const { data: parentCategoryData, error: parentCategoryError } = await supabase
        .from("course_categories")
        .select("id, parent_id, slug, title, description, accent_color")
        .eq("slug", categorySlug)
        .is("parent_id", null)
        .eq("is_published", true)
        .maybeSingle();

    if (parentCategoryError) {
        throw new Error("课程分类加载失败", { cause: parentCategoryError });
    }

    if (!parentCategoryData) {
        notFound();
    }

    const parentCategory = parentCategoryData as CourseCategory;

    const { data: subcategoryData, error: subcategoryError } = await supabase
        .from("course_categories")
        .select("id, parent_id, slug, title, description, accent_color")
        .eq("slug", subcategorySlug)
        .eq("parent_id", parentCategory.id)
        .eq("is_published", true)
        .maybeSingle();

    if (subcategoryError) {
        throw new Error("课程阶段加载失败", { cause: subcategoryError });
    }

    if (!subcategoryData) {
        notFound();
    }

    const subcategory = subcategoryData as CourseCategory;

    const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select(
            "id, category_id, slug, title, description, level, support_teacher_name, support_teacher_status, ai_support_enabled, support_message"
        )
        .eq("slug", courseSlug)
        .eq("category_id", subcategory.id)
        .eq("is_published", true)
        .maybeSingle();

    if (courseError) {
        throw new Error("课程加载失败", { cause: courseError });
    }

    if (!courseData) {
        notFound();
    }

    const course = courseData as Course;

    const { data: lessonData, error: lessonError } = await supabase
        .from("lessons")
        .select(
            "id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, content_text, video_url, video_provider, video_object_key, video_mime_type, attachment_url, attachment_label, teacher_note, allow_questions, sort_order, unlock_mode, prerequisite_lesson_id, prerequisite_chapter_id, available_from, is_manually_locked, learning_objectives, lesson_tasks, key_points, case_study, common_mistakes, summary_text, reflection_questions, extra_note"
        )
        .eq("slug", lessonSlug)
        .eq("course_id", course.id)
        .eq("is_published", true)
        .maybeSingle();

    if (lessonError) {
        throw new Error("课时加载失败", { cause: lessonError });
    }

    if (!lessonData) {
        notFound();
    }

    const lesson = lessonData as Lesson;
    const usesLearningCenter = parentCategory.slug === "korean" || parentCategory.slug === "service";
    const courseDirectoryHref = usesLearningCenter
        ? `/dashboard/courses/${parentCategory.slug}?course=${encodeURIComponent(course.slug)}`
        : `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}`;
    const stageDirectoryHref = usesLearningCenter
        ? `/dashboard/courses/${parentCategory.slug}#stage-${subcategory.slug}`
        : `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}`;
    const curatedLesson =
        parentCategory.slug === "korean" &&
        subcategory.slug === "korean-basic" &&
        course.slug === "korean-beginner"
            ? getKoreanBeginnerLesson(lesson.slug)
            : null;
    const isHangulIntroduction = Boolean(
        curatedLesson && lesson.slug === "hangul-introduction"
    );
    const isKoreanLevelOne = Boolean(
        curatedLesson && lesson.slug === "basic-pronunciation"
    );
    const role = profile?.role ?? "student";
    const bypassLearningSequence = isPlatformAudit || role !== "student";
    const { data: orderedLessonData } = await supabase
        .from("lessons")
        .select("id,slug,title,unlock_mode,prerequisite_lesson_id,prerequisite_chapter_id,available_from,is_manually_locked")
        .eq("course_id", course.id)
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
    const orderedLessonRules = (orderedLessonData ?? []) as Array<{
        id: string;
        slug: string;
        title: string;
        unlock_mode: string | null;
        prerequisite_lesson_id: string | null;
        prerequisite_chapter_id: string | null;
        available_from: string | null;
        is_manually_locked: boolean | null;
    }>;
    const prerequisiteChapterIds = Array.from(
        new Set(
            orderedLessonRules
                .map((item) => item.prerequisite_chapter_id)
                .filter((id): id is string => Boolean(id)),
        ),
    );
    const prerequisiteChapterSlugById = new Map<string, string>();
    const prerequisiteChapterTitleById = new Map<string, string>();
    if (prerequisiteChapterIds.length > 0) {
        const { data: prerequisiteChapterData } = await supabase
            .from("course_chapters")
            .select("id,slug,title")
            .in("id", prerequisiteChapterIds);
        for (const chapter of prerequisiteChapterData ?? []) {
            prerequisiteChapterSlugById.set(String(chapter.id), String(chapter.slug));
            prerequisiteChapterTitleById.set(String(chapter.id), String(chapter.title));
        }
    }
    const passedChapterSlugs = new Set<string>();
    if (!bypassLearningSequence) {
        const { data: passedAttemptData } = await admin
            .from("chapter_test_attempts")
            .select("test_slug")
            .eq("student_id", user.id)
            .eq("tenant_id", tenant?.id ?? "")
            .eq("passed", true);
        for (const attempt of passedAttemptData ?? []) {
            passedChapterSlugs.add(String(attempt.test_slug));
        }
    }
    const completedChapterSlugs = new Set(passedChapterSlugs);
    if (!bypassLearningSequence && isKoreanLevelOne) {
        const overviewProgress = await loadSmartDigitalTextbookChapterProgress({
            textbookSlug: "korean-level-one-smart",
            chapterNumber: 0,
            userId: user.id,
            tenantId: tenant?.id ?? null,
            trackingDisabled: isPlatformAudit,
        });
        if (overviewProgress >= 100) {
            completedChapterSlugs.add("korean-level-one-00");
        }
    }
    const completedLessonIds = new Set<string>();
    if (!bypassLearningSequence && orderedLessonRules.length > 0) {
        const { data: completedLessonData } = await supabase
            .from("lesson_progress")
            .select("lesson_id")
            .eq("user_id", user.id)
            .eq("status", "completed")
            .in("lesson_id", orderedLessonRules.map((item) => item.id));
        for (const item of completedLessonData ?? []) completedLessonIds.add(String(item.lesson_id));
    }
    const lessonRuleIndex = orderedLessonRules.findIndex((item) => item.id === lesson.id);
    const currentLessonUnlocked =
        bypassLearningSequence ||
        isLessonUnlocked({
            lesson,
            lessonIndex: Math.max(0, lessonRuleIndex),
            orderedLessons: orderedLessonRules,
            completedLessonIds,
            prerequisiteChapterSlugById,
            passedChapterSlugs,
        });
    const { data: currentChapterData } = await supabase
        .from("course_chapters")
        .select("id,slug,unlock_mode,prerequisite_chapter_id,available_from,is_manually_locked")
        .eq("lesson_id", lesson.id)
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
    const currentChapters = (currentChapterData ?? []) as Array<{
        id: string;
        slug: string;
        unlock_mode: string | null;
        prerequisite_chapter_id: string | null;
        available_from: string | null;
        is_manually_locked: boolean | null;
    }>;
    const unlockedChapterSlugs = bypassLearningSequence
        ? new Set(currentChapters.map((chapter) => chapter.slug))
        : getUnlockedChapterSlugs({
            chapters: currentChapters,
            passedChapterSlugs,
            completedChapterSlugs,
        });
    let unlockedHangulChapterCount = 1;
    const ebookProgress: KoreanEbookProgressMap = {};
    if (isHangulIntroduction || isKoreanLevelOne) {
        unlockedHangulChapterCount = HANGUL_TEST_SEQUENCE.filter((slug) => unlockedChapterSlugs.has(slug)).length;
    }
    if ((isHangulIntroduction || isKoreanLevelOne) && !isPlatformAudit) {
        const { data: ebookProgressData } = await admin
            .from("course_ebook_progress")
            .select("test_slug,current_page,total_pages,progress_percent,read_pages,reading_seconds,last_read_at")
            .eq("student_id", user.id)
            .eq("tenant_id", tenant?.id ?? "");
        for (const item of ebookProgressData ?? []) {
            ebookProgress[String(item.test_slug)] = {
                currentPage: Number(item.current_page),
                totalPages: Number(item.total_pages),
                progressPercent: Number(item.progress_percent),
                readPages: Array.isArray(item.read_pages)
                    ? item.read_pages.map(Number)
                    : [],
                readingSeconds:
                    Number(item.reading_seconds) > 86_400
                        ? 0
                        : Math.max(0, Number(item.reading_seconds) || 0),
                lastReadAt: item.last_read_at ? String(item.last_read_at) : null,
            };
        }
    }
    if (bypassLearningSequence) {
        unlockedHangulChapterCount = HANGUL_TEST_SEQUENCE.length;
    }
    const membershipTier = normalizeMembershipTier(profile?.membership_tier);
    const hasFullKoreanCourseAccess =
        parentCategory.slug === "korean" &&
        canUseStudentFeature(role, membershipTier, "korean_course");
    const hasPreviewAccess =
        lesson.is_free_preview &&
        canUseStudentFeature(role, membershipTier, "course_preview");
    const hasLessonAccess =
        isPlatformAudit ||
        role !== "student" ||
        hasFullKoreanCourseAccess ||
        hasPreviewAccess;
    if (!currentLessonUnlocked) {
        const currentRule = orderedLessonRules[lessonRuleIndex];
        const prerequisiteLesson = currentRule?.prerequisite_lesson_id
            ? orderedLessonRules.find((item) => item.id === currentRule.prerequisite_lesson_id)
            : null;
        const prerequisiteChapterSlug = currentRule?.prerequisite_chapter_id
            ? prerequisiteChapterSlugById.get(currentRule.prerequisite_chapter_id)
            : null;
        const prerequisiteChapterTitle = currentRule?.prerequisite_chapter_id
            ? prerequisiteChapterTitleById.get(currentRule.prerequisite_chapter_id)
            : null;
        const prerequisiteHref = prerequisiteLesson
            ? `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${prerequisiteLesson.slug}${prerequisiteChapterSlug ? `?chapter=${encodeURIComponent(prerequisiteChapterSlug)}` : ""}`
            : courseDirectoryHref;

        return (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
                <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
                    <Link
                        href={courseDirectoryHref}
                        className="inline-flex w-fit items-center gap-2 rounded-md text-sm font-bold text-[var(--foreground-muted)] transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                    >
                        <ArrowLeft size={16} />
                        返回课程路线
                    </Link>
                    <main className="my-auto py-10">
                        <section className="app-card relative overflow-hidden rounded-3xl border p-6 shadow-sm sm:p-10 lg:p-12">
                            <span className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                            <div className="relative max-w-2xl">
                                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--status-warning-surface)] px-3 py-1.5 text-xs font-bold text-[var(--status-warning)]">
                                    <LockKeyhole size={14} />
                                    前置学习尚未完成
                                </span>
                                <p className="mt-6 text-xs font-bold tracking-[.18em] text-[var(--primary)]">
                                    {curatedLesson?.stage ?? subcategory.title}
                                </p>
                                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                                    {curatedLesson?.title ?? lesson.title}
                                </h2>
                                <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
                                    这门课需要按学习路线逐步开放。完成前置内容后，系统会自动解锁，不需要重新收藏或报名。
                                </p>
                                <div className="mt-7 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                                    <p className="text-xs font-bold text-slate-400">下一步</p>
                                    <p className="mt-2 text-sm font-bold leading-6 text-slate-800 sm:text-base">
                                        {prerequisiteChapterTitle
                                            ? `完成前置课程中的「${prerequisiteChapterTitle}」章节测试`
                                            : "完成前置课程及其章节测试"}
                                    </p>
                                </div>
                                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                                    <Link
                                        href={prerequisiteHref}
                                        className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
                                    >
                                        继续前置学习 <ArrowRight size={16} />
                                    </Link>
                                    <Link
                                        href={courseDirectoryHref}
                                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-slate-300"
                                    >
                                        查看完整课程路线
                                    </Link>
                                </div>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        );
    }
    if (
        isKoreanLevelOne &&
        requestedChapter &&
        !unlockedChapterSlugs.has(requestedChapter)
    ) {
        const firstUnlockedChapter = currentChapters.find((chapter) =>
            unlockedChapterSlugs.has(chapter.slug)
        );
        redirect(
            `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}${firstUnlockedChapter ? `?chapter=${encodeURIComponent(firstUnlockedChapter.slug)}` : ""}`
        );
    }
    let resolvedVideoUrl = hasLessonAccess ? lesson.video_url : null;

    if (hasLessonAccess && lesson.video_provider === "r2" && lesson.video_object_key) {
        resolvedVideoUrl = await createR2SignedVideoUrl(lesson.video_object_key);
    }

    let questions: LessonQuestion[] = [];

    if (hasLessonAccess && !isPlatformAudit) {
        const { data: questionData } = await supabase
            .from("lesson_questions")
            .select(
                "id, title, message, question_target, status, ai_answer, teacher_answer, teacher_name, created_at"
            )
            .eq("student_id", user.id)
            .eq("lesson_id", lesson.id)
            .order("created_at", { ascending: false })
            .limit(5);

        questions = (questionData ?? []) as LessonQuestion[];
    }

    const { data: resourceData, error: resourceError } = await supabase
        .from("lesson_resources")
        .select(
            "id, title, description, resource_type, resource_url, resource_object_key, original_file_name, is_required, sort_order"
        )
        .eq("lesson_id", lesson.id)
        .eq("is_published", true)
        .order("sort_order", { ascending: true });

    if (resourceError) {
        throw new Error("课时资料加载失败", { cause: resourceError });
    }

    const resources = (resourceData ?? []) as LessonResource[];

    const { data: navLessonData, error: navLessonError } = await supabase
        .from("lessons")
        .select("id, slug, title, sort_order")
        .eq("course_id", course.id)
        .eq("is_published", true)
        .order("sort_order", { ascending: true });

    if (navLessonError) {
        throw new Error("课时导航加载失败", { cause: navLessonError });
    }

    const navLessons = (navLessonData ?? []) as LessonNavItem[];

    const currentLessonIndex = navLessons.findIndex(
        (item) => item.id === lesson.id
    );

    const previousLesson =
        currentLessonIndex > 0 ? navLessons[currentLessonIndex - 1] : null;

    const nextLesson =
        currentLessonIndex >= 0 && currentLessonIndex < navLessons.length - 1
            ? navLessons[currentLessonIndex + 1]
            : null;

    let progress: LessonProgress = {
        status: "not_started",
        progress_percent: 0,
    };

    if (hasLessonAccess && !isPlatformAudit) {
        const { data: progressData } = await supabase
            .from("lesson_progress")
            .select("status, progress_percent, updated_at")
            .eq("user_id", user.id)
            .eq("lesson_id", lesson.id)
            .maybeSingle();

        if (progressData) {
            progress = {
                status: resolveProgressStatus(progressData.status),
                progress_percent: progressData.progress_percent ?? 0,
            };
        }

    }

    const lessonTypeLabel = lessonTypeLabelMap[lesson.lesson_type] ?? "课时";

    const color =
        colorMap[subcategory.accent_color ?? "indigo"] ?? colorMap.indigo;

    const isFocusCategory =
        parentCategory.slug === "service" || parentCategory.slug === "korean";

    const supportTeacherStatus = resolveTeacherStatus(
        course.support_teacher_status
    );

    const defaultQuestionTarget: QuestionTarget =
        supportTeacherStatus === "online" || !course.ai_support_enabled
            ? "teacher"
            : "ai";

    const autoVideoProgressEnabled = Boolean(
        hasLessonAccess && !isPlatformAudit && resolvedVideoUrl &&
        (lesson.video_provider === "upload" || lesson.video_provider === "r2")
    );

    const hasGuideInfo = Boolean(
        lesson.learning_objectives ||
        lesson.lesson_tasks ||
        resources.length > 0 ||
        lesson.attachment_label ||
        lesson.attachment_url ||
        lesson.teacher_note
    );

    const liveClassBanner =
        role === "student" ? <LiveClassEntryBanner lessonId={lesson.id} /> : null;

    if (isHangulIntroduction && hasLessonAccess) {
        return (
            <LessonActivityBoundary lessonId={lesson.id}>
                {liveClassBanner}
                <HangulInteractiveBook
                    courseId={course.id}
                    lessonId={lesson.id}
                    initialProgress={progress.progress_percent}
                    initialStatus={progress.status}
                    trackingDisabled={isPlatformAudit}
                    backHref={courseDirectoryHref}
                    unlockedChapterCount={unlockedHangulChapterCount}
                    initialEbookProgress={ebookProgress}
                    initialChapterSlug={requestedChapter}
                />
            </LessonActivityBoundary>
        );
    }

    if (isKoreanLevelOne && hasLessonAccess) {
        const requestedChapterIndex = requestedChapter
            ? currentChapters.findIndex((chapter) => chapter.slug === requestedChapter)
            : 0;
        const smartTextbook = await loadSmartDigitalTextbook({
            textbookSlug: "korean-level-one-smart",
            chapterNumber: Math.max(0, requestedChapterIndex),
            userId: user.id,
            tenantId: tenant?.id ?? null,
            trackingDisabled: isPlatformAudit,
        });

        if (!smartTextbook) {
            return (
                <>
                    {liveClassBanner}
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)] p-8">
                      <div className="max-w-xl text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                            教材暂时不可用
                        </h2>
                        <Link
                            href={courseDirectoryHref}
                            className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
                        >
                            <ArrowLeft size={16} />
                            返回课程
                        </Link>
                      </div>
                    </div>
                </>
            );
        }

        return (
            <LessonActivityBoundary lessonId={lesson.id}>
                {liveClassBanner}
                <SmartTextbookShell
                    backHref={courseDirectoryHref}
                    textbook={smartTextbook}
                    trackingDisabled={isPlatformAudit}
                    completionHref={smartTextbook.chapter.number === 0 && currentChapters[1]
                        ? `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}?chapter=${encodeURIComponent(currentChapters[1].slug)}`
                        : undefined}
                    completionLabel={smartTextbook.chapter.number === 0 ? "开始第 1 章" : undefined}
                />
            </LessonActivityBoundary>
        );
    }

    return (
        <LessonActivityBoundary lessonId={lesson.id}>
            {liveClassBanner}
            <div
                className={
                    isFocusCategory
                        ? "mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8"
                        : "space-y-5 p-5"
                }
            >
                {/* 返回路径 */}
                <nav className="flex flex-wrap items-center gap-3" aria-label="课时上下文导航">
                    <Link
                        href={courseDirectoryHref}
                        className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-gray-500 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                    >
                        <ArrowLeft size={16} />
                        返回{course.title}
                    </Link>

                    <span className="text-sm text-gray-300">/</span>

                    <Link
                        href={stageDirectoryHref}
                        className="rounded-md text-sm font-medium text-gray-500 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                    >
                        {subcategory.title}
                    </Link>

                    <span className="text-sm text-gray-300">/</span>

                    <Link
                        href="/dashboard/courses"
                        className="rounded-md text-sm font-medium text-gray-500 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                    >
                        我的课程
                    </Link>
                </nav>

                {/* 课时信息 */}
                <section className="app-card rounded-3xl border p-5 shadow-sm">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px_220px] xl:items-start">
                        {/* 左侧：课时标题信息 */}
                        <div className="flex gap-4">
                            <div
                                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${color.iconBox}`}
                            >
                                <GraduationCap className={color.iconText} size={28} />
                            </div>

                            <div>
                                <div className="mb-3 flex flex-wrap gap-2">
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${color.badge}`}
                                    >
                                        {subcategory.title}
                                    </span>

                                    <span className="app-soft-card rounded-full border px-3 py-1 text-xs font-medium">
                                        {lessonTypeLabel}
                                    </span>

                                    <span className="app-soft-card inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium">
                                        <Clock size={13} />
                                        {lesson.duration_minutes} 分钟
                                    </span>

                                    {lesson.is_free_preview && (
                                        <span className="app-soft-card rounded-full border px-3 py-1 text-xs font-semibold">
                                            可试看
                                        </span>
                                    )}
                                </div>

                                <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                                    {curatedLesson?.title ?? lesson.title}
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-gray-500">
                                    {(curatedLesson?.description ?? lesson.description) || "暂无课时简介"}
                                </p>
                            </div>
                        </div>

                        {/* 中间：学习状态 / 学习进度 */}
                        <div className="xl:-translate-x-10">
                            {!isPlatformAudit && (hasLessonAccess ? <LessonProgressStatusCard
                                lessonId={lesson.id}
                                initialStatus={progress.status}
                                initialProgress={progress.progress_percent}
                                autoProgressEnabled={autoVideoProgressEnabled}
                            /> : <div className="app-empty-state rounded-2xl p-4 text-center"><LockKeyhole className="mx-auto" size={20} style={{ color: "var(--status-warning)" }}/><p className="mt-2 text-xs font-bold">只读浏览</p></div>)}
                        </div>

                        {/* 右侧：学习支持 / 咨询 + 上一课 / 下一课 */}
                        <div className="flex flex-col items-center gap-3 xl:pt-1">
                            {hasLessonAccess && !isPlatformAudit && <LessonSupportSheet
                                courseId={course.id}
                                lessonId={lesson.id}
                                teacherName={course.support_teacher_name}
                                teacherStatus={supportTeacherStatus}
                                aiSupportEnabled={course.ai_support_enabled}
                                supportMessage={course.support_message}
                                allowQuestions={lesson.allow_questions}
                                defaultTarget={defaultQuestionTarget}
                                questions={questions}
                            />}

                            <div className="flex items-center justify-center gap-2">
                                {previousLesson ? (
                                    <Link
                                        href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${previousLesson.slug}`}
                                        className="app-card inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90"
                                    >
                                        <span className="text-xs">◀</span>
                                        上一课
                                    </Link>
                                ) : (
                                    <span className="app-soft-card inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold opacity-70">
                                        <span className="text-xs">◀</span>
                                        第一课
                                    </span>
                                )}

                                {nextLesson ? (
                                    <Link
                                        href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${nextLesson.slug}`}
                                        className="app-card inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90"
                                    >
                                        下一课
                                        <span className="text-xs">▶</span>
                                    </Link>
                                ) : (
                                    <span className="app-soft-card inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold opacity-70">
                                        最后一课
                                        <span className="text-xs">▶</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 01 视频学习 + 02 学习引导 */}
                {isHangulIntroduction && (
                    <section className="app-card overflow-hidden rounded-3xl border p-5 shadow-sm sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--status-success-surface)] px-3 py-1.5 text-xs font-bold text-[var(--status-success)] shadow-sm ring-1 ring-[var(--border-subtle)]">
                                    <BookOpenCheck size={14} />
                                    章节目录
                                </span>
                                <h3 className="mt-3 text-xl font-bold tracking-tight text-[var(--foreground)]">
                                    韩语字母入门 · 5 个章节
                                </h3>
                                <p className="mt-1 max-w-[75ch] text-sm leading-6 text-[var(--foreground-muted)]">
                                    按照“认识结构 → 学习字母 → 组合拼读 → 收音复习”的顺序完成学习。
                                </p>
                            </div>
                            <p className="text-xs font-bold text-[var(--foreground-muted)]">
                                共 {hangulIntroductionChapters.reduce((total, chapter) => total + chapter.durationMinutes, 0)} 分钟
                            </p>
                        </div>

                        <ol className="mt-5 grid gap-3 lg:grid-cols-5">
                            {hangulIntroductionChapters.map((chapter, index) => (
                                <li
                                    key={chapter.slug}
                                    id={`chapter-${chapter.slug}`}
                                    className="group relative rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--primary)] hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--status-success-surface)] text-sm font-bold text-[var(--status-success)]">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--foreground-muted)]">
                                            <Clock size={12} />
                                            {chapter.durationMinutes} 分钟
                                        </span>
                                    </div>
                                    <h4 className="mt-4 font-bold text-[var(--foreground)]">{chapter.title}</h4>
                                    <p className="mt-1 text-xs font-bold text-[var(--status-success)]">{chapter.koreanTitle}</p>
                                    <p className="mt-3 text-xs leading-5 text-[var(--foreground-muted)]">{chapter.description}</p>
                                    <div className="mt-4 flex flex-wrap gap-1.5">
                                        {chapter.focus.map((item) => (
                                            <span key={item} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2 py-1 text-[10px] font-bold text-[var(--foreground-secondary)]">
                                                <Hash size={10} />
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                <div
                    className={
                        hasGuideInfo
                            ? "grid gap-5 xl:grid-cols-[minmax(0,640px)_minmax(480px,1fr)] xl:items-start"
                            : "max-w-[760px]"
                    }
                >
                    {/* 左侧：01 视频学习 */}
                    <section className="app-card rounded-3xl border p-5 shadow-sm">
                        <WorkspaceSectionTitle
                            index="1"
                            title="视频学习"
                            description="通过视频进入本课学习，系统会根据观看进度自动记录学习状态"
                        />

                        {hasLessonAccess ? <LessonVideoPlayer
                            courseId={course.id}
                            lessonId={lesson.id}
                            videoUrl={resolvedVideoUrl}
                            videoProvider={lesson.video_provider}
                            initialStatus={progress.status}
                            initialProgress={progress.progress_percent}
                            trackingDisabled={isPlatformAudit}
                        /> : <div className="app-empty-state rounded-2xl p-6 text-center"><LockKeyhole className="mx-auto" size={28} style={{ color: "var(--status-warning)" }}/><h3 className="mt-4 font-bold">当前课时仅限浏览介绍</h3><p className="app-muted-text mx-auto mt-2 max-w-md text-xs leading-5">一级会员及以上学生可以播放标记为“可试听”的课时；其他正式课程权限将在后续会员方案中配置。</p></div>}
                    </section>

                    {/* 右侧：02 学习引导 */}
                    {hasGuideInfo && (
                        <section className="app-card rounded-3xl border p-5 shadow-sm">
                            <WorkspaceSectionTitle
                                index="2"
                                title="学习引导"
                                description=""
                            />

                            <div className="grid gap-4 md:grid-cols-2">
                                {lesson.learning_objectives && (
                                    <LessonCollapsibleCard
                                        title="本课学习目标"
                                        icon={<BookOpenCheck size={17} />}
                                        defaultOpen
                                        tone="indigo"
                                    >
                                        <TextContent content={lesson.learning_objectives} />
                                    </LessonCollapsibleCard>
                                )}

                                {lesson.lesson_tasks && (
                                    <LessonCollapsibleCard
                                        title="本课任务"
                                        icon={<ListChecks size={17} />}
                                        defaultOpen
                                    >
                                        <TextContent content={lesson.lesson_tasks} />
                                    </LessonCollapsibleCard>
                                )}

                                {(resources.length > 0 ||
                                    lesson.attachment_label ||
                                    lesson.attachment_url) && (
                                        <LessonCollapsibleCard
                                            title="课程资料"
                                            icon={<Download size={17} />}
                                            defaultOpen={false}
                                        >
                                            <div className="space-y-3">
                                                {resources.length > 0 ? (
                                                    resources.map((resource) => (
                                                        <div
                                                            key={resource.id}
                                                            className="app-flat-row rounded-xl p-3"
                                                        >
                                                            <div className="mb-1 flex flex-wrap gap-2">
                                                                <span className="app-card rounded-full border px-2 py-0.5 text-xs font-medium">
                                                                    {resourceTypeLabelMap[
                                                                        resource.resource_type
                                                                    ] ?? "资料"}
                                                                </span>

                                                                {resource.is_required && (
                                                                    <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-xs font-medium text-red-600">
                                                                        必看
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <p className="text-sm font-semibold text-gray-900">
                                                                {resource.title}
                                                            </p>

                                                            {resource.description && (
                                                                <p className="mt-1 text-xs leading-5 text-gray-500">
                                                                    {resource.description}
                                                                </p>
                                                            )}

                                                           <div className="mt-2 flex flex-wrap gap-3">
                                                                {resource.resource_url && (
                                                                    
                                                                    <a  href={resource.resource_url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="inline-flex text-xs font-semibold text-gray-900 underline"
                                                                    >
                                                                        打开资料
                                                                    </a>
                                                                )}

                                                                {resource.resource_object_key && (
                                                                    
                                                                    <a   href={`/api/lesson-resources/${resource.id}/download`}
                                                                        className="inline-flex text-xs font-semibold text-gray-900 underline"
                                                                    >
                                                                        下载文件（{resource.original_file_name}）
                                                                    </a>
                                                                )}

                                                                {!resource.resource_url &&
                                                                    !resource.resource_object_key && (
                                                                        <p className="text-xs text-gray-400">
                                                                            文件暂未上传
                                                                        </p>
                                                                    )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="app-flat-row rounded-xl p-3">
                                                        <p className="text-sm font-semibold text-gray-900">
                                                            {lesson.attachment_label || "课程资料"}
                                                        </p>

                                                        {lesson.attachment_url ? (
                                                            <a
                                                                href={lesson.attachment_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="mt-2 inline-flex text-xs font-semibold text-gray-900 underline"
                                                            >
                                                                下载资料
                                                            </a>
                                                        ) : (
                                                            <p className="mt-2 text-xs text-gray-400">
                                                                文件暂未上传
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </LessonCollapsibleCard>
                                    )}

                                {lesson.teacher_note && (
                                    <LessonCollapsibleCard
                                        title="老师提示"
                                        icon={<CheckCircle2 size={17} />}
                                        defaultOpen={false}
                                        tone="yellow"
                                    >
                                        <TextContent content={lesson.teacher_note} />
                                    </LessonCollapsibleCard>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                {/* 03 核心学习 */}
                <section className="app-card rounded-3xl border p-5 shadow-sm">
                    <WorkspaceSectionTitle
                        index="3"
                        title="核心学习"
                        description=""
                    />

                    <div className="grid gap-4 xl:grid-cols-2">
                        <LessonCollapsibleCard
                            title="学习内容"
                            icon={<FileText size={17} />}
                            defaultOpen
                        >
                            <TextContent content={lesson.content_text || lesson.description} />
                        </LessonCollapsibleCard>

                        {lesson.key_points && (
                            <LessonCollapsibleCard
                                title="本课重点"
                                icon={<Lightbulb size={17} />}
                                defaultOpen
                                tone="yellow"
                            >
                                <TextContent content={lesson.key_points} />
                            </LessonCollapsibleCard>
                        )}

                        {lesson.case_study && (
                            <LessonCollapsibleCard
                                title="案例分析"
                                icon={<NotebookPen size={17} />}
                                defaultOpen={false}
                                tone="indigo"
                            >
                                <TextContent content={lesson.case_study} />
                            </LessonCollapsibleCard>
                        )}

                        {lesson.common_mistakes && (
                            <LessonCollapsibleCard
                                title="常见错误"
                                icon={<TriangleAlert size={17} />}
                                defaultOpen={false}
                                tone="red"
                            >
                                <TextContent content={lesson.common_mistakes} />
                            </LessonCollapsibleCard>
                        )}
                    </div>
                </section>

                {/* 4 学习完成 */}
                <section className="app-card rounded-3xl border p-5 shadow-sm">
                    <WorkspaceSectionTitle
                        index="4"
                        title="学习完成"
                        description=""
                    />

                    <div className="grid gap-4 lg:grid-cols-3">
                        {lesson.summary_text && (
                            <LessonCollapsibleCard
                                title="本课小结"
                                icon={<CheckCircle2 size={17} />}
                                defaultOpen
                                tone="green"
                            >
                                <TextContent content={lesson.summary_text} />
                            </LessonCollapsibleCard>
                        )}

                        {lesson.reflection_questions && (
                            <LessonCollapsibleCard
                                title="课后思考"
                                icon={<ListChecks size={17} />}
                                defaultOpen={false}
                            >
                                <TextContent content={lesson.reflection_questions} />
                            </LessonCollapsibleCard>
                        )}

                        {lesson.extra_note && (
                            <LessonCollapsibleCard
                                title="补充说明"
                                icon={<FileText size={17} />}
                                defaultOpen={false}
                            >
                                <TextContent content={lesson.extra_note} />
                            </LessonCollapsibleCard>
                        )}
                    </div>
                </section>

                {/* 底部：上一课 / 下一课 */}
                <section className="app-card rounded-3xl border p-5 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-2">
                        {previousLesson ? (
                            <Link
                                href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${previousLesson.slug}`}
                                className="app-card rounded-2xl border p-4 transition hover:opacity-90"
                            >
                                <p className="text-sm text-gray-500">上一课</p>
                                <p className="mt-1 font-bold text-gray-900">
                                    {previousLesson.title}
                                </p>
                            </Link>
                        ) : (
                            <div className="app-soft-card rounded-2xl border p-4">
                                <p className="text-sm text-gray-400">上一课</p>
                                <p className="mt-1 font-bold text-gray-400">
                                    当前已经是第一课
                                </p>
                            </div>
                        )}

                        {nextLesson ? (
                            <Link
                                href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${nextLesson.slug}`}
                                className="app-card rounded-2xl border p-4 text-right transition hover:opacity-90"
                            >
                                <p className="text-sm text-gray-500">下一课</p>
                                <p className="mt-1 font-bold text-gray-900">
                                    {nextLesson.title}
                                </p>
                            </Link>
                        ) : (
                            <div className="app-soft-card rounded-2xl border p-4 text-right">
                                <p className="text-sm text-gray-400">下一课</p>
                                <p className="mt-1 font-bold text-gray-400">
                                    当前已经是最后一课
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-5 flex justify-end">
                        <Link
                            href={courseDirectoryHref}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                            style={{ backgroundColor: "var(--primary)" }}
                        >
                            返回课程目录
                            <ArrowRight size={15} />
                        </Link>
                    </div>
                </section>
            </div>
        </LessonActivityBoundary>
    );
}
