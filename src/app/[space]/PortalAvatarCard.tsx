import { Camera } from "lucide-react";

import { PortalProfileTrigger } from "./PortalProfileTrigger";

export function PortalAvatarCard({
  studentName,
  avatarUrl,
  embedded = false,
}: {
  studentName: string;
  avatarUrl: string | null;
  embedded?: boolean;
}) {
  const initial = Array.from(studentName.trim())[0]?.toUpperCase() || "U";

  return (
    <article
      className={
        embedded
          ? "flex h-full flex-col items-center border-b border-slate-200/70 p-5 text-center sm:border-b-0 sm:border-r sm:p-6"
          : "flex h-full flex-col items-center rounded-3xl border border-slate-200 bg-white/85 p-5 text-center shadow-[0_16px_48px_-32px_rgba(15,23,42,0.4)]"
      }
    >
      <h3 className="self-start text-sm font-black text-slate-950">我的形象</h3>

      <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-3">
        <span
          className="flex size-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-emerald-200 via-teal-100 to-sky-100 bg-cover bg-center text-3xl font-black text-slate-900 shadow-[0_12px_30px_-16px_rgba(15,23,42,0.45)] ring-1 ring-emerald-200"
          style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}
        >
          {!avatarUrl ? initial : null}
        </span>

        <PortalProfileTrigger
          mode="edit"
          aria-label="更换个人形象"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-4 text-xs font-bold text-slate-600 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <Camera size={13} aria-hidden="true" />
          更换形象
        </PortalProfileTrigger>
      </div>
    </article>
  );
}
