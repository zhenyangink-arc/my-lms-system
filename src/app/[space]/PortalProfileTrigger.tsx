"use client";

import type { ButtonHTMLAttributes } from "react";

export const PORTAL_PROFILE_OPEN_EVENT = "uply:portal-profile-open";

export type PortalProfileOpenMode = "summary" | "edit";

export function PortalProfileTrigger({
  children,
  mode = "summary",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick"> & {
  mode?: PortalProfileOpenMode;
}) {
  return (
    <button
      {...props}
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(PORTAL_PROFILE_OPEN_EVENT, { detail: { mode } }),
        )
      }
    >
      {children}
    </button>
  );
}
