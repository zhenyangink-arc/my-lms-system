"use client";

import Link from "next/link";
import { BookOpen, SearchX } from "lucide-react";

import { usePortalCourseSearch } from "./PortalCourseSearch";

export type PortalCourseCard = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  href: string;
  completedLessons: number;
  lessonCount: number;
  progressPercent: number;
};

export function PortalCourseGrid({ courses }: { courses: PortalCourseCard[] }) {
  const { query } = usePortalCourseSearch();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredCourses = normalizedQuery
    ? courses.filter((course) =>
        `${course.title}\n${course.description ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    : courses;

  if (filteredCourses.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
        <SearchX className="mx-auto text-slate-400" size={32} />
        <h2 className="mt-4 text-lg font-semibold">未找到课程</h2>
        <p className="mt-2 text-sm text-slate-500">
          没有匹配“{query.trim()}”的课程，请尝试其他关键词。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 grid grid-cols-4 gap-6" aria-label="课程列表">
      {filteredCourses.map((course) => (
        <Link
          key={course.id}
          href={course.href}
          className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
        >
          <div
            className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 bg-cover bg-center"
            style={
              course.coverUrl
                ? { backgroundImage: `url(${JSON.stringify(course.coverUrl)})` }
                : undefined
            }
          >
            {!course.coverUrl && (
              <BookOpen className="text-slate-400" size={36} />
            )}
          </div>

          <div className="p-5">
            <h2 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 group-hover:text-blue-700">
              {course.title}
            </h2>
            <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
              {course.description || "暂无课程简介"}
            </p>

            <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
              <span>
                已完成 {course.completedLessons} / {course.lessonCount} 个课时
              </span>
              <span className="font-semibold text-slate-700">
                {course.progressPercent}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}
