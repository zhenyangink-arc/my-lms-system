/**
 * 创建数学试卷的服务端流程（不依赖框架，便于单元测试）：
 * 校验输入 → 找到数学课时 → 确保试卷容器 → 调用 create_math_paper → 可选发布。
 * 权限由调用方（动作）先做，数据库函数最终再校验一次；这里不信任客户端传来的任何内容。
 */
import { parseDraftPaper, validatePaperDraft } from "./paper-model.ts";

export type MathPaperActionResult = { status: "success" | "error"; message: string };

export type MathLesson = { id: string; title: string; courseSlug: string };

export type MathPaperStore = {
  /** 已发布的数学应用课时；不存在、未发布或不属于数学应用返回 null。 */
  findLesson(lessonId: string): Promise<MathLesson | null>;
  /** 该课时已发布的试卷容器（章节测试）。 */
  findContainer(lessonId: string): Promise<string | null>;
  createContainer(input: {
    lessonId: string;
    slug: string;
    courseKey: string;
    title: string;
  }): Promise<{ id: string } | { conflict: true } | { error: string | undefined }>;
  createPaper(input: {
    title: string;
    description: string;
    paperType: "homework" | "exam";
    containerId: string;
    durationMinutes: number | null;
    passingScore: number | null;
    allowResubmission: boolean;
    questions: unknown[];
  }): Promise<{ id: string } | { error: string | undefined }>;
  /** 整体替换草稿试卷（名称、说明、用时、及格线与全部题目）；仅限数学草稿，数据库函数最终校验。 */
  replacePaper(input: {
    paperId: string;
    title: string;
    description: string;
    durationMinutes: number | null;
    passingScore: number | null;
    allowResubmission: boolean;
    questions: unknown[];
  }): Promise<{ error: string | undefined }>;
  publish(paperId: string): Promise<{ error: string | undefined }>;
};

export type CreateMathPaperInput = {
  /** 有值表示整体替换这份草稿（编辑），没有值表示新建。 */
  paperId?: unknown;
  paperType: unknown;
  lessonId: unknown;
  allowResubmission: boolean;
  intent: unknown;
  draftJson: unknown;
  canRelease: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DRAFT_JSON_LENGTH = 400_000;

function fail(message: string): MathPaperActionResult {
  return { status: "error", message };
}

/** 数据库返回的中文提示可以直接给老师看；其他错误一律用兜底文案，避免泄露内部信息。 */
export function friendlyDatabaseError(message: string | undefined, fallback: string, maxLength = 240) {
  if (message && message.length <= maxLength && /[㐀-鿿]/u.test(message)) return message;
  return fallback;
}

export async function createMathPaper(
  store: MathPaperStore,
  randomSeed: () => number,
  input: CreateMathPaperInput,
): Promise<MathPaperActionResult> {
  if (input.paperType !== "homework" && input.paperType !== "exam") return fail("试卷类型不正确。");
  const paperType = input.paperType;
  const editing = input.paperId !== undefined && input.paperId !== null && input.paperId !== "";
  if (editing && (typeof input.paperId !== "string" || !UUID.test(input.paperId))) return fail("试卷编号不正确。");
  if (!editing && (typeof input.lessonId !== "string" || !UUID.test(input.lessonId))) {
    return fail("请选择有效的数学课时。");
  }
  const publish = input.intent === "publish";
  if (publish && !input.canRelease) return fail("草稿可以保存，但只有平台负责人可以发布给机构。");

  if (typeof input.draftJson !== "string" || input.draftJson.length > MAX_DRAFT_JSON_LENGTH) {
    return fail("试卷内容读取失败，请刷新页面后重试。");
  }
  let rawDraft: unknown;
  try {
    rawDraft = JSON.parse(input.draftJson);
  } catch {
    return fail("试卷内容读取失败，请刷新页面后重试。");
  }
  const parsed = parseDraftPaper(rawDraft);
  if (!parsed.ok) return fail("试卷内容格式不正确，请刷新页面后重试。");

  // 判题种子由服务端生成，每题一个；不接受客户端传入。
  const seeds = parsed.value.questions.map(() => randomSeed());
  const validation = validatePaperDraft(parsed.value, (index) => seeds[index]);
  if (!validation.ok) return fail(validation.errors.join("；"));

  if (editing) {
    const paperId = input.paperId as string;
    const replaced = await store.replacePaper({
      paperId,
      title: validation.title,
      description: validation.description,
      durationMinutes: validation.durationMinutes,
      passingScore: validation.passingScore,
      allowResubmission: input.allowResubmission,
      questions: validation.questions,
    });
    if (replaced.error) return fail(friendlyDatabaseError(replaced.error, "数学试卷草稿保存失败，请稍后重试。"));
    if (publish) {
      const published = await store.publish(paperId);
      if (published.error) {
        return fail(`草稿已更新，但发布失败：${friendlyDatabaseError(published.error, "请在试卷目录中查看发布质检结果后重试。")}`);
      }
      return { status: "success", message: "数学试卷已经更新并发布，机构端现在可以选择整卷。" };
    }
    return { status: "success", message: "数学试卷草稿已经更新。" };
  }

  const lesson = await store.findLesson(input.lessonId as string);
  if (!lesson) return fail("所选课时不存在、尚未发布或不属于数学应用。");

  let containerId = await store.findContainer(lesson.id);
  if (!containerId) {
    const created = await store.createContainer({
      lessonId: lesson.id,
      slug: `math-paper-${lesson.id}`,
      courseKey: lesson.courseSlug,
      title: lesson.title,
    });
    if ("id" in created) containerId = created.id;
    else if ("conflict" in created) containerId = await store.findContainer(lesson.id); // 并发创建：改读已有的
    else return fail(friendlyDatabaseError(created.error, "试卷容器创建失败，请稍后重试。"));
    if (!containerId) return fail("试卷容器创建失败，请稍后重试。");
  }

  const paper = await store.createPaper({
    title: validation.title,
    description: validation.description,
    paperType,
    containerId,
    durationMinutes: validation.durationMinutes,
    passingScore: validation.passingScore,
    allowResubmission: input.allowResubmission,
    questions: validation.questions,
  });
  if ("error" in paper) return fail(friendlyDatabaseError(paper.error, "数学试卷保存失败，请稍后重试。"));

  if (publish) {
    const published = await store.publish(paper.id);
    if (published.error) {
      return fail(
        `草稿已保存，但发布失败：${friendlyDatabaseError(published.error, "请在试卷目录中查看发布质检结果后重试。")}`,
      );
    }
    return { status: "success", message: "数学试卷已经发布，机构端现在可以选择整卷。" };
  }
  return { status: "success", message: "数学试卷草稿已经保存。" };
}
