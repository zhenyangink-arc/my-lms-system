"use client";

import type { FormEvent, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

import {
  MEMBERSHIP_TIER_LABELS,
  canUseStudentFeature,
  getFeatureDeniedMessage,
  type MembershipTier,
  type StudentFeature,
} from "@/lib/student-permissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function featureFromPath(pathname: string): StudentFeature {
  if (pathname.startsWith("/dashboard/documents")) return "application_documents";
  if (pathname.startsWith("/dashboard/visa")) return "visa_tasks";
  if (pathname.startsWith("/dashboard/universities")) return "university_target";
  if (pathname.startsWith("/dashboard/announcements") || pathname.startsWith("/dashboard/help") || pathname.startsWith("/dashboard/profile") || pathname.startsWith("/dashboard/settings")) {
    return "message_services";
  }
  return "restricted_operation";
}

export function DashboardPermissionGate({
  children,
  userRole,
  membershipTier,
}: {
  children: ReactNode;
  userRole: string;
  membershipTier: MembershipTier;
}) {
  const pathname = usePathname();
  const [deniedFeature, setDeniedFeature] = useState<StudentFeature | null>(null);

  function denyWhenNeeded(feature: StudentFeature) {
    if (canUseStudentFeature(userRole, membershipTier, feature)) return false;
    setDeniedFeature(feature);
    return true;
  }

  function handleSubmitCapture(event: FormEvent<HTMLDivElement>) {
    const form = event.target as HTMLFormElement;
    if (form.method.toLowerCase() === "get") return;
    const feature = (form.dataset.permission as StudentFeature | undefined) ?? featureFromPath(pathname);
    if (denyWhenNeeded(feature)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const operation = target.closest<HTMLElement>("[data-student-operation]");
    if (!operation) return;
    const feature = (operation.dataset.permission as StudentFeature | undefined) ?? featureFromPath(pathname);
    if (denyWhenNeeded(feature)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <>
      <div onSubmitCapture={handleSubmitCapture} onClickCapture={handleClickCapture}>
        {children}
      </div>

      <Dialog open={deniedFeature !== null} onOpenChange={(open) => !open && setDeniedFeature(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
              <LockKeyhole size={22} />
            </div>
            <DialogTitle>当前操作暂无权限</DialogTitle>
            <DialogDescription className="leading-6">
              {deniedFeature ? getFeatureDeniedMessage(deniedFeature) : "当前操作暂未开放。"}
            </DialogDescription>
          </DialogHeader>
          <div className="app-soft-card flex items-center gap-3 rounded-2xl border p-4 text-sm">
            <Sparkles size={17} style={{ color: "var(--app-secondary)" }} />
            <div><p className="font-black">当前档位：{MEMBERSHIP_TIER_LABELS[membershipTier]}</p><p className="app-muted-text mt-1 text-xs">页面浏览不受影响，开放后的操作会自动生效。</p></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
