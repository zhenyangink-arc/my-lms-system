"use client";

import { useMemo, useState } from "react";

export function StudentPicker({
  students,
  emptyMessage = "当前没有可分配的已开通学生。",
}: {
  students: { id: string; name: string; loginId: string | null }[];
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(keyword) ||
        (student.loginId ?? "").toLowerCase().includes(keyword),
    );
  }, [students, query]);

  function toggle(studentId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  }

  if (!students.length) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索学生姓名或账号"
        className="mb-2 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
      {selectedIds.size ? (
        <p className="mb-2 text-xs text-slate-500">已选择 {selectedIds.size} 名学生，搜索不会取消已选中的学生。</p>
      ) : null}
      <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length ? (
          filtered.map((student) => (
            <label key={student.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                name="student_ids"
                value={student.id}
                checked={selectedIds.has(student.id)}
                onChange={(event) => toggle(student.id, event.target.checked)}
              />
              <span>
                {student.name}
                {student.loginId ? <small className="ml-1 text-slate-400">{student.loginId}</small> : null}
              </span>
            </label>
          ))
        ) : (
          <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-3">没有匹配的学生。</p>
        )}
      </div>
    </div>
  );
}
