"use client";

import {
  Bot,
  CheckCircle2,
  MessageCircle,
  UserRound,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { LessonQuestionForm } from "./LessonQuestionForm";

/**
 * 老师状态类型
 */
type TeacherStatus = "online" | "busy" | "away" | "offline";

/**
 * 提问目标类型
 */
type QuestionTarget = "teacher" | "ai" | "both";

/**
 * 学生提问记录类型
 */
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

type LessonSupportSheetProps = {
  courseId: string;
  lessonId: string;
  teacherName: string | null;
  teacherStatus: TeacherStatus;
  aiSupportEnabled: boolean;
  supportMessage: string | null;
  allowQuestions: boolean;
  defaultTarget: QuestionTarget;
  questions: LessonQuestion[];
};

/**
 * 老师在线状态显示配置
 */
const teacherStatusMap = {
  online: {
    label: "在线",
    dot: "bg-green-500",
    text: "text-green-600",
    bg: "bg-green-50",
    message: "老师当前在线，可以直接向老师提问。",
  },
  busy: {
    label: "忙碌",
    dot: "bg-yellow-500",
    text: "text-yellow-600",
    bg: "bg-yellow-50",
    message: "老师当前忙碌，建议先向 AI 助教提问，也可以留言给老师。",
  },
  away: {
    label: "暂离",
    dot: "bg-orange-500",
    text: "text-orange-600",
    bg: "bg-orange-50",
    message: "老师当前暂离，建议先向 AI 助教提问。",
  },
  offline: {
    label: "离线",
    dot: "bg-gray-400",
    text: "text-gray-600",
    bg: "bg-gray-50",
    message: "老师当前不在线，你可以先向 AI 助教提问，也可以留言给老师。",
  },
};

const questionTargetLabelMap: Record<string, string> = {
  teacher: "老师",
  ai: "AI 助教",
  both: "AI + 老师",
};

const questionStatusLabelMap: Record<string, string> = {
  pending: "等待回复",
  ai_answered: "AI 已回复",
  teacher_answered: "老师已回复",
  closed: "已关闭",
};

export function LessonSupportSheet({
  courseId,
  lessonId,
  teacherName,
  teacherStatus,
  aiSupportEnabled,
  supportMessage,
  allowQuestions,
  defaultTarget,
  questions,
}: LessonSupportSheetProps) {
  const status = teacherStatusMap[teacherStatus] ?? teacherStatusMap.offline;

  return (
    <Sheet>
      {/* 不用 asChild，避免 button 嵌套问题 */}
      <SheetTrigger className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800">
        <MessageCircle size={16} />
        学习支持 / 咨询
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>学习支持</SheetTitle>
          <SheetDescription>
            遇到不懂的问题，可以向老师或 AI 助教提问。
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* 负责老师区域 */}
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-gray-900">负责老师</h3>

            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
                  <UserRound size={22} className="text-gray-700" />
                </div>

                <div>
                  <p className="text-sm text-gray-500">老师</p>
                  <p className="font-bold text-gray-900">
                    {teacherName || "暂未指定"}
                  </p>
                </div>
              </div>

              <div className={`mt-4 rounded-xl px-4 py-3 ${status.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
                  <span className={`text-sm font-semibold ${status.text}`}>
                    {status.label}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {supportMessage || status.message}
                </p>
              </div>

              {aiSupportEnabled && (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-indigo-50 px-4 py-3">
                  <Bot size={18} className="mt-0.5 shrink-0 text-indigo-600" />
                  <p className="text-sm leading-6 text-indigo-700">
                    AI 助教第一版先保存问题记录，后续会接入自动回答功能。
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 咨询问题表单 */}
          {allowQuestions && (
            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <MessageCircle size={18} className="text-gray-700" />
                <h3 className="font-bold text-gray-900">咨询问题</h3>
              </div>

              <LessonQuestionForm
                courseId={courseId}
                lessonId={lessonId}
                teacherName={teacherName}
                defaultTarget={defaultTarget}
                aiSupportEnabled={aiSupportEnabled}
              />
            </section>
          )}

          {/* 我的提问记录 */}
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-gray-900">我的提问记录</h3>

            {questions.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-gray-500">
                你还没有在这个课时提交问题。
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600">
                        {questionTargetLabelMap[question.question_target] ??
                          "提问"}
                      </span>

                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600">
                        {questionStatusLabelMap[question.status] ??
                          question.status}
                      </span>
                    </div>

                    <p className="font-semibold text-gray-900">
                      {question.title}
                    </p>

                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500">
                      {question.message}
                    </p>

                    {question.ai_answer && (
                      <p className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm leading-6 text-indigo-700">
                        AI：{question.ai_answer}
                      </p>
                    )}

                    {question.teacher_answer && (
                      <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm leading-6 text-green-700">
                        老师：{question.teacher_answer}
                      </p>
                    )}

                    {question.status === "pending" && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <CheckCircle2 size={13} />
                        已提交，等待处理
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}