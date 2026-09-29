"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { createTeachingContentAction } from "../api/create-teaching-content";

export type AuthoringLessonOption = { id: string; title: string; updatedAt: string };

export function CreateTeachingContentForm({ lessons }: { lessons: AuthoringLessonOption[] }) {
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [state, action, pending] = useActionState(createTeachingContentAction, { message: "" });
  const pathname = usePathname();
  const selected = lessons.find(lesson => lesson.id === lessonId);
  const fieldClass = "grid gap-2 text-sm";
  if (!lessons.length) return null;
  return (
    <section className="space-y-4 rounded-md border p-4" aria-label="创建教学内容">
      <CardTitleWithHint headingLevel={2} title="创建教学内容" description="为还没有教材的课时创建预备章节（第0章）与课前导航模块。新内容保持草稿；不会生成正文或自动发布。已有教材不会被覆盖。" />
      {state.chapterId ? (
        <div className="space-y-3">
          <p role="status" className="text-sm">{state.message}</p>
          <Link className={buttonVariants()} href={`${pathname.split("/dashboard")[0]}/dashboard/admin/apps/${state.appSlug}/teaching-scripts?chapter=${encodeURIComponent(state.chapterId)}`}>进入教学脚本</Link>
        </div>
      ) : (
        <form action={action} className="grid max-w-2xl gap-4" aria-busy={pending}>
          <label className={fieldClass}>课时
            <select name="lesson_id" value={lessonId} onChange={event => setLessonId(event.target.value)} disabled={pending} required className="h-11 w-full rounded-md border bg-background px-3">
              {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
          </label>
          <input type="hidden" name="updated_at" value={selected?.updatedAt ?? ""} />
          <label className={fieldClass}>预备章节名称<Input name="chapter_title" maxLength={120} required disabled={pending} /></label>
          <label className={fieldClass}>学习目标（选填，每行一条）<textarea name="objectives" maxLength={2406} rows={3} disabled={pending} className="w-full rounded-md border bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring" /></label>
          {state.message && <p role="alert" className="text-sm">{state.message}</p>}
          <Button type="submit" disabled={pending || !selected} className="min-h-11 justify-self-start">{pending ? "正在创建…" : "创建教学内容草稿"}</Button>
        </form>
      )}
    </section>
  );
}
