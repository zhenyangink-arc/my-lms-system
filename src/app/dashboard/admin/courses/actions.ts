"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import { requireAdmin } from "@/lib/admin";
import { createR2SignedUploadUrl } from "@/lib/r2";

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getNullableString(formData: FormData, name: string) {
  const value = getString(formData, name);

  return value.length > 0 ? value : null;
}

function getNumber(formData: FormData, name: string, fallback = 0) {
  const value = Number(formData.get(name));

  if (Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

function getCheckbox(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function updateCourseAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const courseId = getString(formData, "course_id");

  const title = getString(formData, "title");
  const description = getNullableString(formData, "description");
  const level = getNullableString(formData, "level");
  const isPublished = getCheckbox(formData, "is_published");

  if (!courseId || !title) {
    return;
  }

  await supabase
    .from("courses")
    .update({
      title,
      description,
      level,
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
}

export async function createLessonAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const courseId = getString(formData, "course_id");

  const slug = getString(formData, "slug");
  const title = getString(formData, "title");
  const description = getNullableString(formData, "description");
  const durationMinutes = getNumber(formData, "duration_minutes", 10);
  const sortOrder = getNumber(formData, "sort_order", 1);

  if (!courseId || !slug || !title) {
    return;
  }

  await supabase.from("lessons").insert({
    course_id: courseId,
    slug,
    title,
    description,
    lesson_type: "video",
    duration_minutes: durationMinutes,
    is_free_preview: false,
    is_published: true,
    sort_order: sortOrder,
    video_provider: "r2",
    video_mime_type: "video/mp4",
  });

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
}

export async function updateLessonAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const courseId = getString(formData, "course_id");
  const lessonId = getString(formData, "lesson_id");

  const slug = getString(formData, "slug");
  const title = getString(formData, "title");
  const description = getNullableString(formData, "description");
  const lessonType = getString(formData, "lesson_type") || "video";
  const durationMinutes = getNumber(formData, "duration_minutes", 10);
  const sortOrder = getNumber(formData, "sort_order", 1);
  const isFreePreview = getCheckbox(formData, "is_free_preview");
  const isPublished = getCheckbox(formData, "is_published");

  const videoProvider = getNullableString(formData, "video_provider");
  const videoObjectKey = getNullableString(formData, "video_object_key");


  // 课时内容字段
  // 这些字段对应学生端课时学习页面中的学习目标、任务、正文、重点、案例、小结等内容
  const learningObjectives = getNullableString(
    formData,
    "learning_objectives"
  );
  const lessonTasks = getNullableString(formData, "lesson_tasks");
  const teacherNote = getNullableString(formData, "teacher_note");

  const contentText = getNullableString(formData, "content_text");
  const keyPoints = getNullableString(formData, "key_points");
  const caseStudy = getNullableString(formData, "case_study");
  const commonMistakes = getNullableString(formData, "common_mistakes");

  const summaryText = getNullableString(formData, "summary_text");
  const reflectionQuestions = getNullableString(
    formData,
    "reflection_questions"
  );
  const extraNote = getNullableString(formData, "extra_note");

  if (!courseId || !lessonId || !slug || !title) {
    return;
  }

  await supabase
    .from("lessons")
    .update({
      slug,
      title,
      description,
      lesson_type: lessonType,
      duration_minutes: durationMinutes,
      sort_order: sortOrder,
      is_free_preview: isFreePreview,
      is_published: isPublished,
      video_provider: videoProvider,
      video_object_key: videoObjectKey,
      video_mime_type: "video/mp4",
      // 学习引导区
      learning_objectives: learningObjectives,
      lesson_tasks: lessonTasks,
      teacher_note: teacherNote,

      // 核心学习区
      content_text: contentText,
      key_points: keyPoints,
      case_study: caseStudy,
      common_mistakes: commonMistakes,

      // 学习完成区
      summary_text: summaryText,
      reflection_questions: reflectionQuestions,
      extra_note: extraNote,

      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
}

export async function hideLessonAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const courseId = getString(formData, "course_id");
  const lessonId = getString(formData, "lesson_id");

  if (!courseId || !lessonId) {
    return;
  }

  await supabase
    .from("lessons")
    .update({
      is_published: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
}


/*
  生成资料文件的上传签名 URL

  使用场景：
  管理员在“新增资料”表单里选好文件后，浏览器调用这个 action，
  拿到一个一次性的上传地址和随机 object key，然后直接把文件 PUT 到 R2。

  安全考虑：
  1. 必须先过 requireAdmin()，防止非管理员拿到签名 URL
  2. objectKey 由服务器随机生成，不使用用户上传的原始文件名，
     避免撞名覆盖、避免文件名里的特殊字符造成路径问题
  3. objectKey 里带上 lessonId，方便以后按课时批量清理文件
*/
export async function createResourceUploadUrlAction(
  lessonId: string,
  originalFileName: string,
  contentType: string
) {
  await requireAdmin();

  if (!lessonId) {
    throw new Error("Missing lesson_id");
  }

  const extMatch = originalFileName.match(/\.[^.]+$/);
  const extension = extMatch ? extMatch[0] : "";

  const objectKey = `lesson-resources/${lessonId}/${randomUUID()}${extension}`;

  const uploadUrl = await createR2SignedUploadUrl(
    objectKey,
    contentType || "application/octet-stream"
  );

  return { uploadUrl, objectKey };
}




/*
  创建课时资料

  使用场景：
  管理员在某个课时下面点击“新增资料”。

  数据写入表：
  lesson_resources

  说明：
  1. lesson_id 表示资料属于哪个课时
  2. course_id 不写入 lesson_resources，只用于 revalidatePath 刷新当前管理页面
  3. title 和 description 必填
  4. resource_url 暂时支持外部链接，以后可以扩展成 R2 文件地址
  5. is_published 默认 true，表示学生端可见
*/
export async function createLessonResourceAction(formData: FormData) {
  const supabase = await createClient();

  /*
    course_id 来自隐藏字段：

    <input type="hidden" name="course_id" value={course.id} />

    作用：
    新增资料成功后，用它刷新当前管理页面：
    /dashboard/admin/courses/[courseId]
  */
  const courseId = String(formData.get("course_id") ?? "").trim();

  /*
    lesson_id 来自隐藏字段：

    <input type="hidden" name="lesson_id" value={lesson.id} />

    作用：
    告诉数据库这条资料属于哪一个课时。
  */
  const lessonId = String(formData.get("lesson_id") ?? "").trim();

  /*
    资料基本字段

    注意：
    String(...).trim() 的作用是：
    1. 防止 null 报错
    2. 去掉用户输入前后的空格
  */
  const title = String(formData.get("resource_title") ?? "").trim();

  const description = String(
    formData.get("resource_description") ?? ""
  ).trim();

    const resourceUrl = String(formData.get("resource_url") ?? "").trim();

  const resourceObjectKey = String(
    formData.get("resource_object_key") ?? ""
  ).trim();

  const originalFileName = String(
    formData.get("original_file_name") ?? ""
  ).trim();

  const resourceTypeValue = String(
    formData.get("resource_type") ?? "link"
  ).trim();

  const sortOrderValue = Number(formData.get("resource_sort_order") ?? 0);

  /*
    限制资料类型，防止用户提交乱七八糟的值。

    即使前端 select 里只有这些选项，
    后端也要再检查一次，这是安全兜底。
  */
  const allowedResourceTypes = [
    "file",
    "link",
    "template",
    "checklist",
    "reference",
  ];

  const resourceType = allowedResourceTypes.includes(resourceTypeValue)
    ? resourceTypeValue
    : "link";

  /*
    必要参数检查

    courseId 和 lessonId 缺失属于系统级错误，
    说明页面表单结构不完整，所以可以 throw。
  */
  if (!courseId) {
    throw new Error("Missing course_id");
  }

  if (!lessonId) {
    throw new Error("Missing lesson_id");
  }

   if (!title || !description) {
    revalidatePath(`/dashboard/admin/courses/${courseId}`);
    return;
  }

  /*
    资料类型不是"链接"时，必须已经上传成功（有 resource_object_key）。

    为什么不用浏览器 required？
    因为 object key 是隐藏字段，隐藏的 input 浏览器不会做 required 校验，
    所以这里改成后端兜底：没传文件就不新增，静默返回。
  */
  if (resourceType !== "link" && !resourceObjectKey) {
    revalidatePath(`/dashboard/admin/courses/${courseId}`);
    return;
  }

  /*
    插入 lesson_resources 表

    is_required:
    - checkbox 勾选时，formData.get("resource_is_required") === "on"
    - 不勾选时，formData.get(...) 是 null

    is_published:
    - 新增资料默认 true
    - 学生端只读取 is_published = true 的资料
  */
   const { error } = await supabase.from("lesson_resources").insert({
    lesson_id: lessonId,
    title,
    description,
    resource_type: resourceType,
    resource_url: resourceType === "link" ? resourceUrl || null : null,
    resource_object_key: resourceType !== "link" ? resourceObjectKey || null : null,
    original_file_name: resourceType !== "link" ? originalFileName || null : null,
    is_required: formData.get("resource_is_required") === "on",
    is_published: true,
    sort_order: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
  });

  if (error) {
    throw new Error(error.message);
  }

  /*
    刷新当前管理页面，让新增资料马上显示出来。
  */
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

/*
  更新课时资料

  使用场景：
  管理员修改某一条已有资料后，点击“保存资料”。

  为什么第一个参数是 resourceId？
  因为 page.tsx 里会这样调用：

  updateLessonResourceAction.bind(null, resource.id)

  这样每一条资料都能准确知道自己要更新哪条记录。
*/
export async function updateLessonResourceAction(
  resourceId: string,
  formData: FormData
) {
  const supabase = await createClient();

  /*
    course_id 仍然从 formData 里读取。

    作用：
    更新完成后刷新当前课程管理页。
  */
  const courseId = String(formData.get("course_id") ?? "").trim();

  const title = String(formData.get("resource_title") ?? "").trim();

  const description = String(
    formData.get("resource_description") ?? ""
  ).trim();

  const resourceUrl = String(formData.get("resource_url") ?? "").trim();

  const resourceTypeValue = String(
    formData.get("resource_type") ?? "link"
  ).trim();

  const sortOrderValue = Number(formData.get("resource_sort_order") ?? 0);

  const allowedResourceTypes = [
    "file",
    "link",
    "template",
    "checklist",
    "reference",
  ];

  const resourceType = allowedResourceTypes.includes(resourceTypeValue)
    ? resourceTypeValue
    : "link";

  if (!courseId) {
    throw new Error("Missing course_id");
  }

  if (!resourceId) {
    throw new Error("Missing resource_id");
  }

  /*
    标题或说明为空时，不更新，也不让页面崩溃。

    前端编辑表单里有 required。
    这里是后端兜底。
  */
  if (!title || !description) {
    revalidatePath(`/dashboard/admin/courses/${courseId}`);
    return;
  }

  /*
    更新当前资料记录。

    注意：
    这里不会改 lesson_id。
    因为一条资料创建后，通常不应该随便移动到别的课时。
  */
  const { error } = await supabase
    .from("lesson_resources")
    .update({
      title,
      description,
      resource_type: resourceType,
      resource_url: resourceUrl || null,
      is_required: formData.get("resource_is_required") === "on",
      sort_order: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
    })
    .eq("id", resourceId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

/*
  隐藏课时资料

  使用场景：
  管理员点击“隐藏资料”。

  注意：
  这里不是 delete 删除，而是软隐藏。

  软隐藏逻辑：
  is_published = false

  好处：
  1. 数据库记录还在
  2. 学生端不会显示
  3. 后面可以继续做“恢复资料”
*/
export async function hideLessonResourceAction(
  resourceId: string,
  formData: FormData
) {
  const supabase = await createClient();

  /*
    resourceId 来自 page.tsx 里的：

    hideLessonResourceAction.bind(null, resource.id)

    所以这里不用再从 formData.get("resource_id") 读取。
  */

  /*
    course_id 来自当前隐藏资料 form 里的 hidden input：

    <input type="hidden" name="course_id" value={course.id} />

    用它刷新当前管理页面。
  */
  const courseId = String(formData.get("course_id") ?? "").trim();

  if (!courseId) {
    throw new Error("Missing course_id");
  }

  if (!resourceId) {
    throw new Error("Missing resource_id");
  }

  const { error } = await supabase
    .from("lesson_resources")
    .update({
      is_published: false,
    })
    .eq("id", resourceId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}
/*
  恢复课时资料

  使用场景：
  管理员在单独课时编辑页的“已隐藏资料”区域点击“恢复资料”。

  注意：
  这里不是重新新增资料，而是把原来隐藏的资料重新发布。

  数据库变化：
  lesson_resources.is_published: false -> true
*/
export async function restoreLessonResourceAction(
  resourceId: string,
  formData: FormData
) {
  const supabase = await createClient();

  /*
    resourceId 来自页面里的：

    restoreLessonResourceAction.bind(null, resource.id)

    所以这里不用再从 formData 里读取 resource_id。
  */

  /*
    course_id 来自隐藏 input：

    <input type="hidden" name="course_id" value={course.id} />

    作用：恢复成功后刷新当前课程管理相关页面。
  */
  const courseId = String(formData.get("course_id") ?? "").trim();

  if (!courseId) {
    throw new Error("Missing course_id");
  }

  if (!resourceId) {
    throw new Error("Missing resource_id");
  }

  const { error } = await supabase
    .from("lesson_resources")
    .update({
      is_published: true,
    })
    .eq("id", resourceId);

  if (error) {
    throw new Error(error.message);
  }

  /*
    刷新课程管理页。

    说明：
    这个 action 现在是在：
    /dashboard/admin/courses/[courseId]/lessons/[lessonId]

    但 Next.js 的 revalidatePath 可以刷新课程下相关缓存。
    你当前页面提交后也会重新渲染，所以恢复后的资料会从“已隐藏资料”移动到“已发布资料”。
  */
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

/*
  软删除课时资料（移入回收站）

  使用场景：
  管理员在“已隐藏资料”区域点击“删除资料（进回收站）”。

  注意：
  这里不是真正的物理删除，只是把 is_deleted 标记为 true。

  安全限制：
  1. 只能对已经是“隐藏”状态的资料操作（is_published = false）
     发布中的资料不能直接跳过隐藏这一步进回收站
  2. 必须填写删除原因（delete_reason）

  数据库变化：
  lesson_resources.is_deleted: false -> true
  同时记录 deleted_at / deleted_by / delete_reason
*/
export async function moveLessonResourceToRecycleBinAction(
  resourceId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const courseId = String(formData.get("course_id") ?? "").trim();
  const lessonId = String(formData.get("lesson_id") ?? "").trim();
  const reason = String(formData.get("delete_reason") ?? "").trim();

  if (!courseId) {
    throw new Error("Missing course_id");
  }

  if (!lessonId) {
    throw new Error("Missing lesson_id");
  }

  if (!resourceId) {
    throw new Error("Missing resource_id");
  }

  if (!reason) {
    throw new Error("Missing delete_reason");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("lesson_resources")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
      delete_reason: reason,
    })
    .eq("id", resourceId)
    .eq("is_published", false);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

/*
  从回收站恢复课时资料

  使用场景：
  管理员在“回收站”区域点击“恢复资料”。

  注意：
  恢复后回到“已隐藏资料”状态，不是直接重新发布。
  管理员需要再手动点一次“恢复资料”（is_published: true）才会对学生可见。

  数据库变化：
  lesson_resources.is_deleted: true -> false
  同时清空 deleted_at / deleted_by / delete_reason
*/
export async function restoreLessonResourceFromRecycleBinAction(
  resourceId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const courseId = String(formData.get("course_id") ?? "").trim();
  const lessonId = String(formData.get("lesson_id") ?? "").trim();

  if (!courseId) {
    throw new Error("Missing course_id");
  }

  if (!lessonId) {
    throw new Error("Missing lesson_id");
  }

  if (!resourceId) {
    throw new Error("Missing resource_id");
  }

  const { error } = await supabase
    .from("lesson_resources")
    .update({
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
    })
    .eq("id", resourceId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

/*
  彻底删除课时资料（不可恢复）

  使用场景：
  老板在“回收站”区域的“危险操作”里选择一条资料，输入 delete 后彻底删除。

  安全设计：
  1. 只能删除已经在回收站里的资料（is_deleted = true）
  2. 必须输入 delete
  3. 显式检查当前账号是否为老板（调用数据库里的 is_owner_account() 函数）
     不只依赖 RLS 静默拒绝，而是直接报错，避免 admin 以为删除成功但其实没删掉
  4. 当前阶段只删除数据库记录，以后接入 R2 后还要同时删 R2 文件
*/
export async function permanentlyDeleteLessonResourceAction(
  formData: FormData
) {
  const supabase = await createClient();

  const courseId = String(formData.get("course_id") ?? "").trim();
  const lessonId = String(formData.get("lesson_id") ?? "").trim();
  const resourceId = String(formData.get("resource_id") ?? "").trim();

  const deleteConfirmText = String(formData.get("delete_confirm") ?? "")
    .trim()
    .toLowerCase();

  if (!courseId) {
    throw new Error("Missing course_id");
  }

  if (!lessonId) {
    throw new Error("Missing lesson_id");
  }

  if (!resourceId) {
    throw new Error("Missing resource_id");
  }

  if (deleteConfirmText !== "delete") {
    revalidatePath(`/dashboard/admin/courses/${courseId}/lessons/${lessonId}`);
    return;
  }

  const { data: isOwner, error: ownerCheckError } = await supabase.rpc(
    "is_owner_account"
  );

  if (ownerCheckError) {
    throw new Error(ownerCheckError.message);
  }

  if (!isOwner) {
    throw new Error("只有老板账号可以彻底删除资料");
  }

  const { error } = await supabase
    .from("lesson_resources")
    .delete()
    .eq("id", resourceId)
    .eq("is_deleted", true);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}