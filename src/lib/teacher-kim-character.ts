export const TEACHER_KIM_POSES = [
  "greeting",
  "explaining",
  "encouraging",
  "pointing-left",
  "repeat-after-me",
  "listening",
  "gentle-correction",
] as const;

export type TeacherKimPose = (typeof TEACHER_KIM_POSES)[number];

export const TEACHER_KIM_POSE_LABELS: Record<TeacherKimPose, string> = {
  greeting: "问候",
  explaining: "讲解",
  encouraging: "鼓励",
  "pointing-left": "指向学习内容",
  "repeat-after-me": "示范跟读",
  listening: "倾听学生",
  "gentle-correction": "温和纠错",
};

export function isTeacherKimPose(value: unknown): value is TeacherKimPose {
  return typeof value === "string" && TEACHER_KIM_POSES.includes(value as TeacherKimPose);
}
