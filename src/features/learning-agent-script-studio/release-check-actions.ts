"use server";

import { z } from "zod";
import { requirePlatformOwner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkR2ObjectExists, createR2SignedObjectUrl } from "@/lib/r2";
import { activeTeacherVideoBindings, normalizeTeachingVideo, teachingScriptSegments, teachingVideoIssues } from "@/lib/teaching-video";
import { getTeachingScriptStudioData } from "./service";
import { evaluateStudentChapterAccess } from "@/lib/chapter-release-access";
import { canUseStudentFeature, normalizeMembershipTier } from "@/lib/student-permissions";

export type ReleaseCheck = { label: string; state: "ready" | "blocked" | "unknown"; detail: string };
export type ReleaseReport = { checkedAt: string; checks: ReleaseCheck[] };
export type StudentChoice = { studentId: string; tenantId: string; label: string };
const uuid = z.string().uuid();

export async function searchReleaseCheckStudents(query: string): Promise<{ options: StudentChoice[]; message: string }> {
  await requirePlatformOwner();
  const term = query.trim().replace(/[%_\\]/g, "").slice(0, 50);
  if (term.length < 2) return { options: [], message: "请输入至少两个字查找学生。" };
  const db = createAdminClient();
  const profiles = await db.from("profiles").select("id,full_name,login_id").ilike("full_name", `%${term}%`).limit(20);
  if (profiles.error) return { options: [], message: "学生列表读取失败，请重试。" };
  const ids = (profiles.data ?? []).map(row => row.id);
  if (!ids.length) return { options: [], message: "未找到匹配的学生。" };
  const members = await db.from("tenant_memberships").select("user_id,tenant_id").in("user_id", ids).eq("role", "student");
  if (members.error) return { options: [], message: "机构关系读取失败，请重试。" };
  const tenantIds = [...new Set((members.data ?? []).map(row => row.tenant_id))];
  const tenants = tenantIds.length ? await db.from("tenants").select("id,name").in("id", tenantIds) : { data: [], error: null };
  if (tenants.error) return { options: [], message: "机构信息读取失败，请重试。" };
  return { options: (members.data ?? []).map(member => {
    const profile = profiles.data?.find(row => row.id === member.user_id);
    return { studentId: member.user_id, tenantId: member.tenant_id, label: `${profile?.full_name ?? "学生"}（${profile?.login_id ?? "未设置登录名"}） · ${tenants.data?.find(row => row.id === member.tenant_id)?.name ?? "机构"}` };
  }), message: ids.length === 20 ? "最多展示 20 人，请输入完整姓名缩小范围。" : "" };
}

export async function inspectChapterRelease(input: { appId: string; chapterId: string; student?: { studentId: string; tenantId: string } }): Promise<ReleaseReport> {
  await requirePlatformOwner();
  const checkedAt = new Date().toISOString();
  const checks: ReleaseCheck[] = [];
  const add = (label: string, ready: boolean, detail: string) => checks.push({ label, state: ready ? "ready" : "blocked", detail });
  if (!uuid.safeParse(input.appId).success || !uuid.safeParse(input.chapterId).success || (input.student && (!uuid.safeParse(input.student.studentId).success || !uuid.safeParse(input.student.tenantId).success))) {
    return { checkedAt, checks: [{ label: "发布检查", state: "unknown", detail: "章节或学生参数无效，请重新选择。" }] };
  }
  try {
    const db = createAdminClient();
    const data = await getTeachingScriptStudioData(input.appId);
    const modules = data.modules.filter(module => module.chapterId === input.chapterId);
    if (!modules.length) return { checkedAt, checks: [{ label: "教材版本", state: "blocked", detail: "当前章节不是工作台支持的教材版本，或没有可编排模块。" }] };
    const first = modules[0];
    add("教材发布", first.textbookStatus === "published" && first.chapterStatus === "published" && first.textbookVersion.status === "published", `教材版本 ${first.textbookVersion.number}，教材、版本和章节均需发布。`);
    const published = modules.map(module => module.versions.find(version => version.status === "published"));
    add("正式脚本", published.every(version => Boolean(version?.nodes.length)), `${published.filter(version => version?.nodes.length).length}/${modules.length} 个模块有正式脚本。`);
    const reviewed = published.filter(version => version?.sourceReviewStatus === "reviewed").length;
    checks.push({ label: "教材与脚本复核", state: published.some(version => version?.sourceReviewStatus === "unknown") ? "unknown" : reviewed === modules.length ? "ready" : "blocked", detail: `${reviewed}/${modules.length} 个模块的正式脚本与教材均已复核。` });
    checks.push({ label: "教材练习引用", state: first.practiceStatus === "linked" ? "ready" : first.practiceStatus === "unknown" ? "unknown" : "blocked", detail: ({ linked: "内容已关联且与复核快照一致。", unknown: "暂时无法读取引用状态。", review: "教材已变化，练习引用待复核。", unlinked: "尚未关联本章教材。", disabled: "引用已停用。", unavailable: "教材来源不可用。" })[first.practiceStatus] });
    const mediaKeys = new Set<string>();
    let videoNodes = 0;
    let configurationIssues = 0;
    for (const version of published) for (const node of version?.nodes ?? []) {
      if (normalizeTeachingVideo(node.configuration.teacherVideo).mode !== "video") continue;
      videoNodes++;
      const task = node.configuration.studentTask as { kind?: string } | undefined;
      const question = node.configuration.interaction as { kind?: string } | undefined;
      const lines = teachingScriptSegments(node.script, node.configuration);
      configurationIssues += teachingVideoIssues({ video: node.configuration.teacherVideo, lines, hasTask: Boolean(task?.kind && task.kind !== "none"), hasQuestion: Boolean(node.referenceActivityId || (question?.kind && question.kind !== "none")) }).length;
      for (const binding of activeTeacherVideoBindings(node.configuration, lines.length, node.referenceActivityId)) mediaKeys.add(binding.objectKey);
    }
    if (!videoNodes) checks.push({ label: "教师视频", state: "blocked", detail: "正式脚本没有视频小节；当前可能仍使用语音课堂。" });
    else {
      add("视频配置", configurationIssues === 0, `${videoNodes} 个视频小节，${configurationIssues} 项台词或绑定问题。`);
      if (mediaKeys.size > 200) checks.push({ label: "视频文件", state: "unknown", detail: "本章视频超过单次检查上限，请分模块在视频选择器中核验。" });
      else {
        const keys = [...mediaKeys];
        let readable = 0;
        const failures: string[] = [];
        for (let start = 0; start < keys.length; start += 4) {
          await Promise.all(keys.slice(start, start + 4).map(async key => {
            try {
              const head = await checkR2ObjectExists(key);
              if (!head.exists || !head.size || (head.contentType && !["video/mp4", "application/octet-stream"].includes(head.contentType.split(";")[0]))) throw new Error("invalid file");
              const response = await fetch(await createR2SignedObjectUrl(key), { headers: { Range: "bytes=0-31" }, signal: AbortSignal.timeout(12000), cache: "no-store" });
              if (!response.ok || !response.body) throw new Error("unreadable");
              const reader = response.body.getReader();
              const { value } = await reader.read();
              await reader.cancel();
              if (!value || !new TextDecoder().decode(value.slice(0, 32)).includes("ftyp")) throw new Error("not MP4");
              readable++;
            } catch { failures.push(key.split("/").at(-1) ?? key); }
          }));
        }
        add("视频文件读取", readable === keys.length && keys.length > 0, `${readable}/${keys.length} 个文件可读取且有 MP4 文件头。${failures.length ? `失败：${failures.join("、")}` : "浏览器解码和画面效果请通过脚本预览试看。"}`);
      }
    }

    if (!input.student) checks.push({ label: "学生访问", state: "unknown", detail: "请选择具体学生检查账号、应用授权和章节开放条件。不会登录该学生账号。" });
    else {
      const { studentId, tenantId } = input.student;
      const results = await Promise.all([
        db.from("profiles").select("id,status").eq("id", studentId).maybeSingle(),
        db.from("tenant_memberships").select("role,status,membership_tier").eq("user_id", studentId).eq("tenant_id", tenantId).maybeSingle(),
        db.from("tenants").select("status,slug").eq("id", tenantId).maybeSingle(),
        db.from("tenant_student_apps").select("is_enabled,status").eq("tenant_id", tenantId).eq("app_id", input.appId).maybeSingle(),
        db.from("student_app_enrollments").select("status,starts_at,ends_at").eq("tenant_id", tenantId).eq("student_id", studentId).eq("app_id", input.appId).maybeSingle(),
        db.from("digital_textbooks").select("lesson_id").eq("id", first.textbookId).eq("student_app_id", input.appId).single(),
        db.from("digital_textbook_chapters").select("chapter_test_id").eq("id", input.chapterId).single(),
        db.from("courses").select("id,category_id,is_published,sort_order,unlock_mode,prerequisite_course_id,available_from,is_manually_locked").eq("student_app_id", input.appId).order("sort_order"),
      ]);
      if (results.some(result => result.error)) throw new Error("student access data incomplete");
      const [profile, membership, tenant, tenantApp, enrollment, book, chapter, coursesResult] = results;
      const now = new Date(checkedAt);
      const accountReady = Boolean(profile.data && (profile.data.status ?? "active") === "active" && membership.data?.role === "student" && membership.data.status === "active" && tenant.data?.status === "active");
      add("学生账号与机构", accountReady, accountReady ? "学生账号、机构成员关系和机构状态有效。" : "账号、学生成员关系或机构未处于有效状态。");
      const enrollmentReady = Boolean(tenantApp.data?.is_enabled && tenantApp.data.status === "active" && enrollment.data?.status === "active" && Date.parse(enrollment.data.starts_at) <= now.getTime() && (!enrollment.data.ends_at || Date.parse(enrollment.data.ends_at) > now.getTime()));
      add("学生应用授权", enrollmentReady, enrollmentReady ? "机构已启用应用，学生授权在有效期内。" : "机构应用未启用，或学生授权未生效、已到期。");
      add("完整课程权限", canUseStudentFeature("student", normalizeMembershipTier(membership.data?.membership_tier), "korean_course"), "根据该学生在所选机构的会员档位检查完整韩语课程权限。");
      const courses = coursesResult.data ?? [];
      const courseIds = courses.map(course => course.id);
      const lessonsResult = await db.from("lessons").select("id,course_id,is_published,sort_order,unlock_mode,prerequisite_lesson_id,prerequisite_chapter_id,available_from,is_manually_locked").in("course_id", courseIds).order("sort_order");
      if (lessonsResult.error) throw new Error("lessons incomplete");
      const lessons = lessonsResult.data ?? [];
      const lesson = lessons.find(item => item.id === book.data?.lesson_id);
      const course = courses.find(item => item.id === lesson?.course_id);
      if (!lesson || !course) add("课程结构", false, "教材尚未关联到当前应用的有效课时与课程。");
      else {
        const [chaptersResult, progressResult, attemptsResult] = await Promise.all([
          db.from("course_chapters").select("id,lesson_id,slug,chapter_test_id,is_published,sort_order,unlock_mode,prerequisite_chapter_id,available_from,is_manually_locked").in("lesson_id", lessons.map(item => item.id)).order("sort_order"),
          db.from("lesson_progress").select("lesson_id,status").eq("user_id", studentId).eq("tenant_id", tenantId).in("lesson_id", lessons.map(item => item.id)),
          db.from("chapter_test_attempts").select("test_slug").eq("student_id", studentId).eq("tenant_id", tenantId).eq("passed", true),
        ]);
        if (chaptersResult.error || progressResult.error || attemptsResult.error) throw new Error("progress incomplete");
        const chapters = chaptersResult.data ?? [];
        const matches = chapter.data?.chapter_test_id ? chapters.filter(item => item.lesson_id === lesson.id && item.chapter_test_id === chapter.data.chapter_test_id) : [];
        add("课程结构发布", course.is_published && lesson.is_published && matches.length === 1 && matches[0].is_published, matches.length !== 1 ? "教材与课程结构尚未通过章节测试建立唯一对应，无法判断章节开放。" : "课程、课时和对应章节都需要上架。");
        const access = evaluateStudentChapterAccess({ courses, lessons, chapters,
          lessonId: lesson.id, chapterTestId: chapter.data?.chapter_test_id ?? null,
          completedLessonIds: new Set((progressResult.data ?? []).filter(item => item.status === "completed").map(item => item.lesson_id)),
          passedChapterSlugs: new Set((attemptsResult.data ?? []).map(item => item.test_slug)), now });
        add("学生学习顺序", access.courseOpen && access.lessonOpen && access.chapterOpen,
          `课程${access.courseOpen ? "已解锁" : "未解锁"}；课时${access.lessonOpen ? "已解锁" : "未解锁"}；章节${access.chapterOpen ? "已解锁" : "未解锁或无法匹配"}。`);
      }
    }
  } catch {
    checks.push({ label: "检查完整性", state: "unknown", detail: "部分数据或服务未能完整读取，请稍后重新检查；不能据此认定本章已就绪。" });
  }
  return { checkedAt, checks };
}
