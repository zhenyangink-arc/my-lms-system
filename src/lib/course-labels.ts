export const courseLevelLabelMap: Record<string, string> = {
  basic: "基础",
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级",
};

export const lessonTypeLabelMap: Record<string, string> = {
  text: "文字课",
  video: "视频课",
  quiz: "测验",
  document: "资料",
};

export const progressStatusLabelMap: Record<string, string> = {
  not_started: "未完成",
  in_progress: "进行中",
  completed: "已完成",
};

export function getCourseLevelLabel(level: string | null | undefined) {
  if (!level) {
    return null;
  }

  return courseLevelLabelMap[level] ?? level;
}

export function getLessonTypeLabel(type: string | null | undefined) {
  if (!type) {
    return "课时";
  }

  return lessonTypeLabelMap[type] ?? type;
}

export function getProgressStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "未完成";
  }

  return progressStatusLabelMap[status] ?? status;
}