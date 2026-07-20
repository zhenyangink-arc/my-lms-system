"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";

import { addUniversityTargetFromFormAction } from "../actions";

const stages = [
  ["language", "语学堂"],
  ["bachelor_fresh", "本科新入"],
  ["bachelor_transfer", "本科插班"],
  ["master", "硕士"],
  ["doctor", "博士"],
] as const;

type AdmissionStage = (typeof stages)[number][0];

export type UniversityTargetOption = {
  id: string;
  name_zh: string;
  province: string;
  city: string;
  admission_stages: string[];
  application_deadlines: Partial<Record<AdmissionStage, string>>;
};

function formatDeadline(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function UniversityTargetForm({
  universities,
}: {
  universities: UniversityTargetOption[];
}) {
  const [universityId, setUniversityId] = useState("");
  const [admissionTrack, setAdmissionTrack] = useState<AdmissionStage>("language");
  const selectedUniversity = useMemo(
    () => universities.find((university) => university.id === universityId) ?? null,
    [universities, universityId]
  );
  const availableStages = selectedUniversity
    ? stages.filter(([value]) => selectedUniversity.admission_stages.includes(value))
    : stages;
  const deadline = selectedUniversity?.application_deadlines?.[admissionTrack] ?? null;

  function handleUniversityChange(nextUniversityId: string) {
    setUniversityId(nextUniversityId);
    const nextUniversity = universities.find(
      (university) => university.id === nextUniversityId
    );
    if (!nextUniversity?.admission_stages.includes(admissionTrack)) {
      const firstAvailableStage = stages.find(([value]) =>
        nextUniversity?.admission_stages.includes(value)
      )?.[0];
      if (firstAvailableStage) setAdmissionTrack(firstAvailableStage);
    }
  }

  return (
    <form
      action={addUniversityTargetFromFormAction}
      className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6 xl:items-end"
    >
      <label className="text-xs font-black xl:col-span-2">
        选择大学
        <select
          name="universityId"
          required
          value={universityId}
          onChange={(event) => handleUniversityChange(event.target.value)}
          className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none"
        >
          <option value="" disabled>请选择学校库中的大学</option>
          {universities.map((university) => (
            <option key={university.id} value={university.id}>
              {university.name_zh} · {university.province}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-black">
        申请阶段
        <select
          name="admissionTrack"
          value={admissionTrack}
          onChange={(event) => setAdmissionTrack(event.target.value as AdmissionStage)}
          className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none"
        >
          {availableStages.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <label className="text-xs font-black">
        申请专业
        <input
          name="programName"
          maxLength={120}
          placeholder="可以稍后补充"
          className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none"
        />
      </label>

      <div className="text-xs font-black">
        截止日期
        <div className="app-input mt-2 flex min-h-12 items-center gap-2 rounded-xl border px-3 py-3 text-sm">
          <CalendarDays size={15} className="shrink-0 app-muted-text" />
          <span>{!selectedUniversity ? "选择学校后显示" : deadline ? formatDeadline(deadline) : "暂未公布"}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <label className="min-w-20 flex-1 text-xs font-black">
          优先级
          <select
            name="priority"
            defaultValue="3"
            className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none"
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>{value} 级</option>
            ))}
          </select>
        </label>
        <button
          disabled={universities.length === 0 || availableStages.length === 0}
          type="submit"
          className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-black text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          <Plus size={14} /> 添加
        </button>
      </div>
    </form>
  );
}
