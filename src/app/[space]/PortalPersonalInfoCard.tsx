import {
  BookOpenText,
  Calendar,
  GraduationCap,
  MapPin,
  PencilLine,
  UserRound,
} from "lucide-react";

import { PortalProfileTrigger } from "./PortalProfileTrigger";

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-700">
        {label}：<span className="font-black text-slate-950">{value}</span>
      </span>
    </div>
  );
}

export function PortalPersonalInfoCard({
  studentName,
  targetUniversity,
  targetProgram,
  targetLoadFailed = false,
  addressCity,
  joinedAtLabel,
  embedded = false,
}: {
  studentName: string;
  targetUniversity: string | null;
  targetProgram: string | null;
  targetLoadFailed?: boolean;
  addressCity: string | null;
  joinedAtLabel: string;
  embedded?: boolean;
}) {
  return (
    <article
      className={
        embedded
          ? "flex h-full min-w-0 flex-col p-5 sm:p-6"
          : "flex h-full flex-col rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_16px_48px_-32px_rgba(15,23,42,0.4)]"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-950">个人资料</h3>
        <PortalProfileTrigger
          mode="edit"
          aria-label="编辑个人资料"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <PencilLine size={15} aria-hidden="true" />
        </PortalProfileTrigger>
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-center gap-2.5">
        <InfoRow icon={UserRound} label="昵称" value={studentName} />
        <InfoRow
          icon={GraduationCap}
          label="目标学校"
          value={targetLoadFailed ? "暂时无法读取" : targetUniversity ?? "尚未设置"}
        />
        <InfoRow
          icon={BookOpenText}
          label="目标专业"
          value={targetLoadFailed ? "暂时无法读取" : targetProgram ?? "尚未设置"}
        />
        {addressCity ? (
          <InfoRow icon={MapPin} label="所在城市" value={addressCity} />
        ) : null}
        <InfoRow icon={Calendar} label="加入时间" value={joinedAtLabel} />
      </div>
    </article>
  );
}
