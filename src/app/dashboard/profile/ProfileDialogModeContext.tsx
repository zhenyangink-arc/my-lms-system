"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ProfileDialogMode = "summary" | "edit";

const ProfileDialogModeContext = createContext<ProfileDialogMode>("summary");

export function ProfileDialogModeProvider({
  mode,
  children,
}: {
  mode: ProfileDialogMode;
  children: ReactNode;
}) {
  return (
    <ProfileDialogModeContext.Provider value={mode}>
      {children}
    </ProfileDialogModeContext.Provider>
  );
}

export function useProfileDialogMode() {
  return useContext(ProfileDialogModeContext);
}
