import Link from "next/link";
import { notFound } from "next/navigation";
import {
    ArrowLeft,
    ArrowRight,
    BookOpenCheck,
    CheckCircle2,
    Clock,
    Download,
    FileText,
    GraduationCap,
    ListChecks,
    Lightbulb,
    NotebookPen,
    TriangleAlert,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createR2SignedVideoUrl } from "@/lib/r2";
import { DashboardPageHeader } from "../../../../../DashboardPageHeader";
import { LessonSupportSheet } from "./LessonSupportSheet";
import { LessonCollapsibleCard } from "./LessonCollapsibleCard";
import { LessonProgressStatusCard } from "./LessonProgressStatusCard";
import { LessonVideoPlayer } from "./LessonVideoPlayer";

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

const progressStatusLabelMap: Record<LessonProgressStatus, string> = {
    not_started: "未完成",
    in_progress: "进行中",
    completed: "已完成",
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
        iconBox: "bg-indigo-50",
        iconText: "text-indigo-600",
        badge: "bg-indigo-50 text-indigo-600",
    },
    blue: {
        iconBox: "bg-blue-50",
        iconText: "text-blue-600",
        badge: "bg-blue-50 text-blue-600",
    },
    emerald: {
        iconBox: "bg-emerald-50",
        iconText: "text-emerald-600",
        badge: "bg-emerald-50 text-emerald-600",
    },
    purple: {
        iconBox: "bg-purple-50",
        iconText: "text-purple-600",
        badge: "bg-purple-50 text-purple-600",
    },
    orange: {
        iconBox: "bg-orange-50",
        iconText: "text-orange-600",
        badge: "bg-orange-50 text-orange-600",
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
        <div className="whitespace-pre-line text-sm leading-7 text-gray-700">
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
            <div>
                <div className="mb-1 flex items-center justify-center gap-2">
                    <span className="text-xs font-black tracking-widest text-gray-400">
                        {index}
                    </span>

                    <h3 className="text-lg font-black tracking-tight text-gray-900">
                        {title}
                    </h3>
                </div>

                <p className="text-sm text-gray-500">{description}</p>
            </div>
        </div>
    );
}

export default async function LessonDetailPage({
    params,
}: {
    params: Promise<{
        categorySlug: string;
        subcategorySlug: string;
        courseSlug: string;
        lessonSlug: string;
    }>;
}) {
    const { categorySlug, subcategorySlug, courseSlug, lessonSlug } =
        await params;

    const supabase = await createClient();

    const { data: parentCategoryData } = await supabase
        .from("course_categories")
        .select("id, parent_id, slug, title, description, accent_color")
        .eq("slug", categorySlug)
        .is("parent_id", null)
        .eq("is_published", true)
        .maybeSingle();

    if (!parentCategoryData) {
        notFound();
    }

    const parentCategory = parentCategoryData as CourseCategory;

    const { data: subcategoryData } = await supabase
        .from("course_categories")
        .select("id, parent_id, slug, title, description, accent_color")
        .eq("slug", subcategorySlug)
        .eq("parent_id", parentCategory.id)
        .eq("is_published", true)
        .maybeSingle();

    if (!subcategoryData) {
        notFound();
    }

    const subcategory = subcategoryData as CourseCategory;

    const { data: courseData } = await supabase
        .from("courses")
        .select(
            "id, category_id, slug, title, description, level, support_teacher_name, support_teacher_status, ai_support_enabled, support_message"
        )
        .eq("slug", courseSlug)
        .eq("category_id", subcategory.id)
        .eq("is_published", true)
        .maybeSingle();

    if (!courseData) {
        notFound();
    }

    const course = courseData as Course;

    const { data: lessonData } = await supabase
        .from("lessons")
        .select(
            "id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, content_text, video_url, video_provider, video_object_key, video_mime_type, attachment_url, attachment_label, teacher_note, allow_questions, sort_order, learning_objectives, lesson_tasks, key_points, case_study, common_mistakes, summary_text, reflection_questions, extra_note"
        )
        .eq("slug", lessonSlug)
        .eq("course_id", course.id)
        .eq("is_published", true)
        .maybeSingle();

    if (!lessonData) {
        notFound();
    }

    const lesson = lessonData as Lesson;
    let resolvedVideoUrl = lesson.video_url;

    if (lesson.video_provider === "r2" && lesson.video_object_key) {
        resolvedVideoUrl = await createR2SignedVideoUrl(lesson.video_object_key);
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    let questions: LessonQuestion[] = [];

    if (user) {
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

    const { data: resourceData } = await supabase
        .from("lesson_resources")
        .select(
            "id, title, description, resource_type, resource_url, is_required, sort_order"
        )
        .eq("lesson_id", lesson.id)
        .eq("is_published", true)
        .order("sort_order", { ascending: true });

    const resources = (resourceData ?? []) as LessonResource[];

    const { data: navLessonData } = await supabase
        .from("lessons")
        .select("id, slug, title, sort_order")
        .eq("course_id", course.id)
        .eq("is_published", true)
        .order("sort_order", { ascending: true });

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

    if (user) {
        const { data: progressData } = await supabase
            .from("lesson_progress")
            .select("status, progress_percent")
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

    const supportTeacherStatus = resolveTeacherStatus(
        course.support_teacher_status
    );

    const defaultQuestionTarget: QuestionTarget =
        supportTeacherStatus === "online" || !course.ai_support_enabled
            ? "teacher"
            : "ai";

    const autoVideoProgressEnabled = Boolean(
        resolvedVideoUrl &&
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

    return (
        <>
            <DashboardPageHeader
                title={lesson.title}
                description={lesson.description || "学习当前课时内容。"}
            />

            <div className="space-y-6 p-6">
                {/* 返回路径 */}
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
                    >
                        <ArrowLeft size={16} />
                        返回{course.title}
                    </Link>

                    <span className="text-sm text-gray-300">/</span>

                    <Link
                        href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}`}
                        className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
                    >
                        {subcategory.title}
                    </Link>

                    <span className="text-sm text-gray-300">/</span>

                    <Link
                        href="/dashboard/courses"
                        className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
                    >
                        我的课程
                    </Link>
                </div>

                {/* 课时信息 */}
                <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
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

                                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                                        {lessonTypeLabel}
                                    </span>

                                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                                        <Clock size={13} />
                                        {lesson.duration_minutes} 分钟
                                    </span>

                                    {lesson.is_free_preview && (
                                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                                            可试看
                                        </span>
                                    )}
                                </div>

                                <h2 className="text-2xl font-black tracking-tight text-gray-900">
                                    {lesson.title}
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-gray-500">
                                    {lesson.description || "暂无课时简介"}
                                </p>
                            </div>
                        </div>

                        {/* 中间：学习状态 / 学习进度 */}
                        <div className="xl:-translate-x-10">
                            <LessonProgressStatusCard
                                lessonId={lesson.id}
                                initialStatus={progress.status}
                                initialProgress={progress.progress_percent}
                                autoProgressEnabled={autoVideoProgressEnabled}
                            />
                        </div>

                        {/* 右侧：学习支持 / 咨询 + 上一课 / 下一课 */}
                        <div className="flex flex-col items-center gap-3 xl:pt-1">
                            <LessonSupportSheet
                                courseId={course.id}
                                lessonId={lesson.id}
                                teacherName={course.support_teacher_name}
                                teacherStatus={supportTeacherStatus}
                                aiSupportEnabled={course.ai_support_enabled}
                                supportMessage={course.support_message}
                                allowQuestions={lesson.allow_questions}
                                defaultTarget={defaultQuestionTarget}
                                questions={questions}
                            />

                            <div className="flex items-center justify-center gap-2">
                                {previousLesson ? (
                                    <Link
                                        href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${previousLesson.slug}`}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                                    >
                                        <span className="text-xs">◀</span>
                                        上一课
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-400">
                                        <span className="text-xs">◀</span>
                                        第一课
                                    </span>
                                )}

                                {nextLesson ? (
                                    <Link
                                        href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${nextLesson.slug}`}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                                    >
                                        下一课
                                        <span className="text-xs">▶</span>
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-400">
                                        最后一课
                                        <span className="text-xs">▶</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 01 视频学习 + 02 学习引导 */}
                <div
                    className={
                        hasGuideInfo
                            ? "grid gap-5 xl:grid-cols-[minmax(0,640px)_minmax(480px,1fr)] xl:items-start"
                            : "max-w-[760px]"
                    }
                >
                    {/* 左侧：01 视频学习 */}
                    <section className="rounded-3xl border border-blue-100 bg-blue-50/40 p-6 shadow-sm">
                        <WorkspaceSectionTitle
                            index="1"
                            title="视频学习"
                            description="通过视频进入本课学习，系统会根据观看进度自动记录学习状态"
                        />

                        <LessonVideoPlayer
  courseId={course.id}
  lessonId={lesson.id}
  videoUrl={resolvedVideoUrl}
  videoProvider={lesson.video_provider}
  initialStatus={progress.status}
  initialProgress={progress.progress_percent}
/>
                    </section>

                    {/* 右侧：02 学习引导 */}
                    {hasGuideInfo && (
                        <section className="rounded-3xl border border-cyan-200 bg-cyan-50/60 p-6 shadow-sm">
                            <WorkspaceSectionTitle
                                index="2"
                                title="学习引导"
                                description="先确认本课目标、任务、资料和老师提示，再进入正式学习"
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
                                                            className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                                                        >
                                                            <div className="mb-1 flex flex-wrap gap-2">
                                                                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                                                                    {resourceTypeLabelMap[
                                                                        resource.resource_type
                                                                    ] ?? "资料"}
                                                                </span>

                                                                {resource.is_required && (
                                                                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
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

                                                            {resource.resource_url ? (
                                                                <a
                                                                    href={resource.resource_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="mt-2 inline-flex text-xs font-semibold text-gray-900 underline"
                                                                >
                                                                    打开资料
                                                                </a>
                                                            ) : (
                                                                <p className="mt-2 text-xs text-gray-400">
                                                                    文件暂未上传
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
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
                <section className="rounded-3xl border border-amber-100 bg-amber-50/40 p-6 shadow-sm">
                    <WorkspaceSectionTitle
                        index="3"
                        title="核心学习"
                        description="学习正文内容，结合重点、案例和常见错误完成理解"
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
                <section className="rounded-3xl border border-green-100 bg-green-50/40 p-6 shadow-sm">
                    <WorkspaceSectionTitle
                        index="4"
                        title="学习完成"
                        description="通过小结、思考和补充说明完成本课整理"
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
                <section className="rounded-3xl border border-white-100 bg-white p-6 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-2">
                        {previousLesson ? (
                            <Link
                                href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${previousLesson.slug}`}
                                className="rounded-2xl border border-gray-200 p-4 transition hover:bg-gray-50"
                            >
                                <p className="text-sm text-gray-500">上一课</p>
                                <p className="mt-1 font-bold text-gray-900">
                                    {previousLesson.title}
                                </p>
                            </Link>
                        ) : (
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-sm text-gray-400">上一课</p>
                                <p className="mt-1 font-bold text-gray-400">
                                    当前已经是第一课
                                </p>
                            </div>
                        )}

                        {nextLesson ? (
                            <Link
                                href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${nextLesson.slug}`}
                                className="rounded-2xl border border-gray-200 p-4 text-right transition hover:bg-gray-50"
                            >
                                <p className="text-sm text-gray-500">下一课</p>
                                <p className="mt-1 font-bold text-gray-900">
                                    {nextLesson.title}
                                </p>
                            </Link>
                        ) : (
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-right">
                                <p className="text-sm text-gray-400">下一课</p>
                                <p className="mt-1 font-bold text-gray-400">
                                    当前已经是最后一课
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-5 flex justify-end">
                        <Link
                            href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                        >
                            返回课程目录
                            <ArrowRight size={15} />
                        </Link>
                    </div>
                </section>
            </div>
        </>
    );
}