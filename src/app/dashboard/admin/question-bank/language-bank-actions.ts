"use server";

import { revalidatePath } from "next/cache";

import { requireStandardQuestionBankManager } from "@/lib/question-bank";

export type LanguageBankActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

type LanguageBank = "homework" | "exam";
type LanguageSkill = "listening" | "speaking" | "reading" | "writing";

function result(
  status: LanguageBankActionState["status"],
  message: string
): LanguageBankActionState {
  return { status, message };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isKoreanBankText(value: string) {
  return /[가-힣]/u.test(value) && !/[\u3400-\u4dbf\u4e00-\u9fff]/u.test(value);
}

function optionalKoreanBankText(value: string) {
  return !value || isKoreanBankText(value);
}

function cleanLines(value: FormDataEntryValue | null) {
  return [
    ...new Set(
      String(value ?? "")
        .split(/\r?\n/u)
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function parseOptionLetters(value: string) {
  return value
    .toUpperCase()
    .split(/[\s,，、>→-]+/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.charCodeAt(0) - 65);
}

function databaseMessage(message: string | undefined, fallback: string) {
  return message && message.length <= 240 ? message : fallback;
}

function refreshLanguageBank(bank: LanguageBank) {
  revalidatePath("/dashboard/admin/question-bank");
  revalidatePath("/dashboard/admin/assignments");
  revalidatePath(`/dashboard/admin/assignments/${bank}`);
}

export async function createLanguageBankMaterialAction(
  bank: LanguageBank,
  _previousState: LanguageBankActionState,
  formData: FormData
): Promise<LanguageBankActionState> {
  void _previousState;
  const { supabase, user } = await requireStandardQuestionBankManager();
  const languageSkill = String(formData.get("language_skill") ?? "");
  const difficulty = String(formData.get("difficulty") ?? "");
  const materialLength = String(formData.get("material_length") ?? "");
  const chapterTestId = String(formData.get("chapter_test_id") ?? "").trim();
  const titleKo = String(formData.get("title_ko") ?? "").trim();
  const contentKo = String(formData.get("content_ko") ?? "").trim();
  const audioPath = String(formData.get("audio_path") ?? "").trim();
  const transcriptKo = String(formData.get("transcript_ko") ?? "").trim();
  const durationValue = String(
    formData.get("audio_duration_seconds") ?? ""
  ).trim();
  const audioDurationSeconds = durationValue ? Number(durationValue) : null;
  const requestedStatus = String(formData.get("status") ?? "draft");
  const ebookSectionStep = String(
    formData.get("ebook_section_step") ?? ""
  ).trim();
  const ebookPageReference = String(
    formData.get("ebook_page_reference") ?? ""
  ).trim();

  if (languageSkill !== "listening" && languageSkill !== "reading") {
    return result("error", "材料能力只能选择听力或阅读。");
  }
  if (!isUuid(chapterTestId)) {
    return result("error", "请选择对应章节。");
  }
  if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
    return result("error", "请选择有效难度。");
  }
  if (!["short", "medium", "long"].includes(materialLength)) {
    return result("error", "请选择有效材料长度。");
  }
  if (!["draft", "review", "published"].includes(requestedStatus)) {
    return result("error", "请选择有效状态。");
  }
  if (!/^STEP 0[1-8]$/u.test(ebookSectionStep)) {
    return result("error", "请选择对应的电子书目录。");
  }
  if (ebookPageReference.length > 80) {
    return result("error", "电子书页码说明不能超过 80 个字。");
  }
  if (!isKoreanBankText(titleKo)) {
    return result("error", "材料名称必须使用韩语，不能出现中文。");
  }
  if (languageSkill === "listening") {
    if (!audioPath) return result("error", "听力材料必须填写音频路径。");
    if (!isKoreanBankText(transcriptKo)) {
      return result("error", "听力原文必须使用韩语，不能出现中文。");
    }
    if (
      audioDurationSeconds === null ||
      !Number.isInteger(audioDurationSeconds) ||
      audioDurationSeconds < 1
    ) {
      return result("error", "请填写有效的音频秒数。");
    }
  } else if (!isKoreanBankText(contentKo)) {
    return result("error", "阅读文章必须使用韩语，不能出现中文。");
  }

  const materialTable = `${bank}_bank_materials`;
  const secretTable = `${bank}_bank_material_secrets`;
  const { data: material, error: materialError } = await supabase
    .from(materialTable)
    .insert({
      chapter_test_id: chapterTestId,
      language_skill: languageSkill,
      difficulty,
      material_length: materialLength,
      title_ko: titleKo,
      content_ko: languageSkill === "reading" ? contentKo : "",
      audio_path: languageSkill === "listening" ? audioPath : null,
      audio_duration_seconds:
        languageSkill === "listening" ? audioDurationSeconds : null,
      status: languageSkill === "listening" ? "draft" : requestedStatus,
      ebook_section_step: ebookSectionStep,
      ebook_page_reference: ebookPageReference,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (materialError || !material) {
    return result(
      "error",
      databaseMessage(materialError?.message, "材料保存失败，请稍后重试。")
    );
  }

  if (languageSkill === "listening") {
    const { error: secretError } = await supabase.from(secretTable).insert({
      material_id: material.id,
      transcript_ko: transcriptKo,
    });
    if (secretError) {
      await supabase.from(materialTable).delete().eq("id", material.id);
      return result(
        "error",
        databaseMessage(secretError.message, "听力原文保存失败，请稍后重试。")
      );
    }

    if (requestedStatus !== "draft") {
      const { error: statusError } = await supabase
        .from(materialTable)
        .update({ status: requestedStatus, updated_by: user.id })
        .eq("id", material.id);
      if (statusError) {
        await supabase.from(materialTable).delete().eq("id", material.id);
        return result(
          "error",
          databaseMessage(statusError.message, "材料状态保存失败。")
        );
      }
    }
  }

  refreshLanguageBank(bank);
  return result("success", "韩语材料已经保存。听力原文仅管理人员可读。");
}

export async function createLanguageBankQuestionAction(
  bank: LanguageBank,
  _previousState: LanguageBankActionState,
  formData: FormData
): Promise<LanguageBankActionState> {
  void _previousState;
  const { supabase, user } = await requireStandardQuestionBankManager();
  const languageSkill = String(
    formData.get("language_skill") ?? ""
  ) as LanguageSkill;
  const questionType = String(formData.get("question_type") ?? "");
  const assessmentCategory = String(
    formData.get("assessment_category") ?? ""
  ).trim();
  const difficulty = String(formData.get("difficulty") ?? "");
  const chapterTestId = String(formData.get("chapter_test_id") ?? "").trim();
  const materialId = String(formData.get("material_id") ?? "").trim();
  const promptKo = String(formData.get("prompt_ko") ?? "").trim();
  const options = cleanLines(formData.get("options_text"));
  const acceptedAnswers = cleanLines(formData.get("accepted_answers_text"));
  const answerLetters = String(formData.get("answer_letters") ?? "").trim();
  const explanationKo = String(
    formData.get("explanation_ko") ?? ""
  ).trim();
  const sampleAnswerKo = String(
    formData.get("sample_answer_ko") ?? ""
  ).trim();
  const rubricKo = String(formData.get("rubric_ko") ?? "").trim();
  const minCharactersValue = String(
    formData.get("min_response_characters") ?? ""
  ).trim();
  const maxCharactersValue = String(
    formData.get("max_response_characters") ?? ""
  ).trim();
  const preparationValue = String(
    formData.get("preparation_seconds") ?? ""
  ).trim();
  const minRecordingValue = String(
    formData.get("min_recording_seconds") ?? ""
  ).trim();
  const maxRecordingValue = String(
    formData.get("max_recording_seconds") ?? ""
  ).trim();
  const defaultPoints = Number(formData.get("default_points") ?? 1);
  const requestedStatus = String(formData.get("status") ?? "draft");
  const minCharacters = minCharactersValue ? Number(minCharactersValue) : null;
  const maxCharacters = maxCharactersValue ? Number(maxCharactersValue) : null;
  const preparationSeconds = preparationValue ? Number(preparationValue) : null;
  const minRecordingSeconds = minRecordingValue
    ? Number(minRecordingValue)
    : null;
  const maxRecordingSeconds = maxRecordingValue
    ? Number(maxRecordingValue)
    : null;
  const ebookSectionStep = String(
    formData.get("ebook_section_step") ?? ""
  ).trim();
  const ebookPageReference = String(
    formData.get("ebook_page_reference") ?? ""
  ).trim();

  if (!isUuid(chapterTestId)) return result("error", "请选择对应章节。");
  if (!isKoreanBankText(promptKo)) {
    return result("error", "题干必须使用韩语，不能出现中文。");
  }
  if (!assessmentCategory || assessmentCategory.length > 80) {
    return result("error", "请选择考查类别。");
  }
  if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
    return result("error", "请选择有效难度。");
  }
  if (!["draft", "review", "published"].includes(requestedStatus)) {
    return result("error", "请选择有效状态。");
  }
  if (!/^STEP 0[1-8]$/u.test(ebookSectionStep)) {
    return result("error", "请选择对应的电子书目录。");
  }
  if (ebookPageReference.length > 80) {
    return result("error", "电子书页码说明不能超过 80 个字。");
  }
  if (!Number.isFinite(defaultPoints) || defaultPoints <= 0) {
    return result("error", "默认分值必须大于零。");
  }

  const allowedTypes: Record<LanguageSkill, string[]> = {
    listening: ["single_choice"],
    speaking: ["audio_response"],
    reading: ["single_choice", "multiple_choice", "fill_blank", "ordering"],
    writing: ["long_text"],
  };
  if (!allowedTypes[languageSkill]?.includes(questionType)) {
    return result("error", "能力与作答题型不匹配。");
  }

  const requiresMaterial = languageSkill === "listening" || languageSkill === "reading";
  if (requiresMaterial && !isUuid(materialId)) {
    return result("error", "听力和阅读题必须选择对应材料。");
  }
  if (requiresMaterial) {
    const { data: material } = await supabase
      .from(`${bank}_bank_materials`)
      .select("id,language_skill,chapter_test_id")
      .eq("id", materialId)
      .maybeSingle();
    if (
      !material ||
      material.language_skill !== languageSkill ||
      material.chapter_test_id !== chapterTestId
    ) {
      return result("error", "所选材料与能力或章节不匹配。");
    }
  }

  const fourOptionTypes = ["single_choice", "multiple_choice", "ordering"];
  if (fourOptionTypes.includes(questionType)) {
    if (
      options.length !== 4 ||
      !options.every(isKoreanBankText)
    ) {
      return result("error", "本题必须填写四个不同的韩语选项（A～D）。");
    }
  }

  let answerKey: Record<string, unknown> = {};
  const optionIndexes = parseOptionLetters(answerLetters);
  if (questionType === "single_choice") {
    if (optionIndexes.length !== 1 || optionIndexes[0] < 0 || optionIndexes[0] > 3) {
      return result("error", "单选题答案必须是A、B、C或D。");
    }
    answerKey = { indexes: optionIndexes };
  } else if (questionType === "multiple_choice") {
    const uniqueIndexes = [...new Set(optionIndexes)];
    if (
      uniqueIndexes.length < 2 ||
      uniqueIndexes.some((index) => index < 0 || index > 3)
    ) {
      return result("error", "多选题答案至少包含两个不同的A～D选项。");
    }
    answerKey = { indexes: uniqueIndexes };
  } else if (questionType === "ordering") {
    if (
      optionIndexes.length !== 4 ||
      new Set(optionIndexes).size !== 4 ||
      optionIndexes.some((index) => index < 0 || index > 3)
    ) {
      return result("error", "排序答案必须完整使用A、B、C、D各一次。");
    }
    answerKey = { order: optionIndexes };
  } else if (questionType === "fill_blank") {
    if (
      acceptedAnswers.length < 1 ||
      !acceptedAnswers.every(isKoreanBankText)
    ) {
      return result("error", "填空题至少需要一个韩语可接受答案。");
    }
    answerKey = { accepted: acceptedAnswers };
  }

  if (
    !optionalKoreanBankText(explanationKo) ||
    !optionalKoreanBankText(sampleAnswerKo) ||
    !optionalKoreanBankText(rubricKo)
  ) {
    return result("error", "解析、参考答案和评分标准必须使用韩语。");
  }

  if (
    questionType === "long_text" &&
    (!Number.isInteger(minCharacters) ||
      !Number.isInteger(maxCharacters) ||
      Number(minCharacters) < 1 ||
      Number(maxCharacters) < Number(minCharacters))
  ) {
    return result("error", "写作题必须设置有效的最低和最高字数。");
  }
  if (
    questionType === "audio_response" &&
    (!Number.isInteger(minRecordingSeconds) ||
      !Number.isInteger(maxRecordingSeconds) ||
      Number(minRecordingSeconds) < 1 ||
      Number(maxRecordingSeconds) < Number(minRecordingSeconds))
  ) {
    return result("error", "口语题必须设置有效的录音时长。");
  }

  const questionTable = `${bank}_bank_questions`;
  const keyTable = `${bank}_bank_question_keys`;
  const { data: question, error: questionError } = await supabase
    .from(questionTable)
    .insert({
      chapter_test_id: chapterTestId,
      material_id: requiresMaterial ? materialId : null,
      language_skill: languageSkill,
      assessment_category: assessmentCategory,
      question_type: questionType,
      difficulty,
      prompt_ko: promptKo,
      options_ko: fourOptionTypes.includes(questionType) ? options : [],
      min_response_characters: questionType === "long_text" ? minCharacters : null,
      max_response_characters: questionType === "long_text" ? maxCharacters : null,
      preparation_seconds:
        questionType === "audio_response" ? preparationSeconds ?? 0 : null,
      min_recording_seconds:
        questionType === "audio_response" ? minRecordingSeconds : null,
      max_recording_seconds:
        questionType === "audio_response" ? maxRecordingSeconds : null,
      default_points: defaultPoints,
      status: "draft",
      ebook_section_step: ebookSectionStep,
      ebook_page_reference: ebookPageReference,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (questionError || !question) {
    return result(
      "error",
      databaseMessage(questionError?.message, "题目保存失败，请稍后重试。")
    );
  }

  const { error: keyError } = await supabase.from(keyTable).insert({
    question_id: question.id,
    answer_key: answerKey,
    explanation_ko: explanationKo,
    sample_answer_ko: sampleAnswerKo,
    rubric_ko: rubricKo,
  });
  if (keyError) {
    await supabase.from(questionTable).delete().eq("id", question.id);
    return result(
      "error",
      databaseMessage(keyError.message, "答案密钥保存失败，请稍后重试。")
    );
  }

  if (requestedStatus !== "draft") {
    const { error: statusError } = await supabase
      .from(questionTable)
      .update({ status: requestedStatus, updated_by: user.id })
      .eq("id", question.id);
    if (statusError) {
      await supabase.from(questionTable).delete().eq("id", question.id);
      return result(
        "error",
        databaseMessage(statusError.message, "题目状态保存失败。")
      );
    }
  }

  refreshLanguageBank(bank);
  return result("success", "韩语题目与受保护答案已经保存。");
}
