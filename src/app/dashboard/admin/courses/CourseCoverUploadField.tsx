"use client";

import { useEffect, useId, useState } from "react";
import { Check, ImagePlus, LoaderCircle } from "lucide-react";

import {
  confirmCourseCoverUploadAction,
  createCourseCoverUploadUrlAction,
} from "./catalog-actions";

type CoverEntityKind = "category" | "course" | "lesson" | "chapter";

export function CourseCoverUploadField({
  kind,
  entityId,
  currentObjectKey,
  alt,
}: {
  kind: CoverEntityKind;
  entityId: string;
  currentObjectKey: string | null;
  alt: string;
}) {
  const inputId = useId();
  const [objectKey, setObjectKey] = useState(currentObjectKey ?? "");
  const [previewUrl, setPreviewUrl] = useState(
    currentObjectKey ? `/api/course-assets/${kind}/${entityId}` : "",
  );
  const [status, setStatus] = useState<"idle" | "uploading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setStatus("uploading");
    setMessage("正在上传配图…");

    try {
      const { uploadUrl, objectKey: nextObjectKey } =
        await createCourseCoverUploadUrlAction({
          kind,
          entityId,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        });
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("R2 上传失败，请稍后重试。");
      await confirmCourseCoverUploadAction({
        kind,
        entityId,
        objectKey: nextObjectKey,
        fileSize: file.size,
      });

      setObjectKey(nextObjectKey);
      setPreviewUrl(URL.createObjectURL(file));
      setStatus("ready");
      setMessage("已上传，点击下方保存后生效");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "上传失败，请稍后重试。");
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="cover_object_key" value={objectKey} />
      <div
        className="relative flex aspect-[16/8] items-center justify-center overflow-hidden rounded-[7px] border"
        style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="app-muted-text flex flex-col items-center gap-2 text-[12px]">
            <ImagePlus size={18} strokeWidth={1.5} />
            暂无配图
          </div>
        )}
        <label
          htmlFor={inputId}
          className="absolute inset-x-2 bottom-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-[6px] border px-3 py-2 text-[12px] font-medium backdrop-blur"
          style={{
            color: "var(--app-text)",
            borderColor: "var(--app-border)",
            backgroundColor: "color-mix(in srgb, var(--app-card-bg) 88%, transparent)",
          }}
        >
          {status === "uploading" ? (
            <LoaderCircle className="animate-spin" size={13} />
          ) : status === "ready" ? (
            <Check size={13} />
          ) : (
            <ImagePlus size={13} />
          )}
          {objectKey ? "更换配图" : "上传配图"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={status === "uploading"}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </div>
      <p
        className="text-[11px] leading-5"
        style={{ color: status === "error" ? "var(--app-warm)" : "var(--app-muted)" }}
      >
        {message || "支持 JPG、PNG、WebP，最大 5MB；建议使用 16:9 横图。"}
      </p>
    </div>
  );
}
