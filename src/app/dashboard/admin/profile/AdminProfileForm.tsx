"use client";

import { useActionState, useState } from "react";
import { Camera, KeyRound, Loader2, UserRound } from "lucide-react";

import {
  updateAdminPasswordAction,
  updateAdminProfileAction,
} from "./actions";
import { initialAdminProfileState, type AdminProfileState } from "./profile-state";

function ResultMessage({ state }: { state: AdminProfileState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role="status"
      className={`rounded-md px-3 py-2 text-xs font-medium ${
        state.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export function AdminProfileForm({
  displayName,
  avatarUrl,
  gender,
  birthDate,
  hiredAt,
}: {
  displayName: string;
  avatarUrl: string | null;
  gender: string | null;
  birthDate: string | null;
  hiredAt: string | null;
}) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateAdminProfileAction,
    initialAdminProfileState
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updateAdminPasswordAction,
    initialAdminProfileState
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="app-card overflow-hidden rounded-xl border">
        <div className="flex items-center gap-2 border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
          <UserRound size={15} className="app-muted-text" />
          <h2 className="text-sm font-semibold">基本资料</h2>
        </div>
        <form action={profileAction} className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-xl font-semibold"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--surface-soft)",
                ...(photoPreview || avatarUrl
                  ? {
                      backgroundImage: `url(${photoPreview || avatarUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      color: "transparent",
                    }
                  : {}),
              }}
            >
              {displayName.trim().slice(0, 1) || "?"}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-black/[0.035]" style={{ borderColor: "var(--border)" }}>
              <Camera size={14} className="app-muted-text" />
              更换头像
              <input
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setPhotoPreview(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">真实姓名</span>
            <input
              name="fullName"
              required
              minLength={2}
              maxLength={50}
              defaultValue={displayName}
              className="app-input h-10 w-full rounded-md border px-3 text-sm"
            />
            {profileState.fieldErrors?.fullName && (
              <span className="mt-1 block text-xs text-rose-600">{profileState.fieldErrors.fullName}</span>
            )}
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">性别</span>
              <select name="gender" defaultValue={gender ?? ""} className="app-input h-10 w-full rounded-md border px-3 text-sm">
                <option value="">不透露</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
              {profileState.fieldErrors?.gender && (
                <span className="mt-1 block text-xs text-rose-600">{profileState.fieldErrors.gender}</span>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">出生日期</span>
              <input
                name="birthDate"
                type="date"
                defaultValue={birthDate ?? ""}
                className="app-input h-10 w-full rounded-md border px-3 text-sm"
              />
              {profileState.fieldErrors?.birthDate && (
                <span className="mt-1 block text-xs text-rose-600">{profileState.fieldErrors.birthDate}</span>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">入职时间</span>
              <input
                name="hiredAt"
                type="date"
                defaultValue={hiredAt ?? ""}
                className="app-input h-10 w-full rounded-md border px-3 text-sm"
              />
              {profileState.fieldErrors?.hiredAt && (
                <span className="mt-1 block text-xs text-rose-600">{profileState.fieldErrors.hiredAt}</span>
              )}
            </label>
          </div>

          <ResultMessage state={profileState} />
          <button
            type="submit"
            disabled={profilePending}
            className="h-9 w-full rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {profilePending ? "保存中…" : "保存个人信息"}
          </button>
        </form>
      </section>

      <section className="app-card overflow-hidden rounded-xl border">
        <div className="flex items-center gap-2 border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
          <KeyRound size={15} className="app-muted-text" />
          <h2 className="text-sm font-semibold">修改登录密码</h2>
        </div>
        <form action={passwordAction} className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">新密码</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="8—72 位"
              className="app-input h-10 w-full rounded-md border px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">确认新密码</span>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="再次输入新密码"
              className="app-input h-10 w-full rounded-md border px-3 text-sm"
            />
          </label>

          <ResultMessage state={passwordState} />
          <button
            type="submit"
            disabled={passwordPending}
            className="h-9 w-full rounded-md border px-4 text-xs font-semibold transition hover:bg-black/[0.035] disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            {passwordPending ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={13} />更新中…</span>
            ) : (
              "更新密码"
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
