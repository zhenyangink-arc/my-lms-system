"use client";

import { useFormStatus } from "react-dom";
import { Lock, Unlock } from "lucide-react";

import { toggleTargetDocumentsLockAction } from "./actions";

function ToggleButton({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-60"
      style={{ backgroundColor: locked ? "var(--app-secondary)" : "var(--app-warm)" }}
    >
      {locked ? <Unlock size={13} /> : <Lock size={13} />}
      {pending ? "处理中…" : locked ? "解锁学生端" : "锁定学生端"}
    </button>
  );
}

export function TargetLockButton({
  studentId,
  targetId,
  locked,
}: {
  studentId: string;
  targetId: string;
  locked: boolean;
}) {
  return (
    <form action={toggleTargetDocumentsLockAction.bind(null, studentId, targetId, !locked)}>
      <ToggleButton locked={locked} />
    </form>
  );
}
