"use client";

import { useState } from "react";
import { CheckCircle2, UploadCloud, XCircle } from "lucide-react";

import {
  confirmCourseResourceUploadAction,
  createCourseResourceUploadUrlAction,
} from "./catalog-actions";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const resourceTypeOptions = [
  { value: "link", label: "链接" },
  { value: "file", label: "文件" },
  { value: "template", label: "模板" },
  { value: "checklist", label: "清单" },
  { value: "reference", label: "参考资料" },
];

type ExistingResource = {
  resource_type: string;
  resource_url: string | null;
  original_file_name: string | null;
};

export function LessonResourceSourceField({
  lessonId,
  resource,
}: {
  lessonId: string;
  resource?: ExistingResource;
}) {
  const [resourceType, setResourceType] = useState(resource?.resource_type ?? "link");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [objectKey, setObjectKey] = useState("");
  const [fileName, setFileName] = useState("");

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setUploadError(null);
    setObjectKey("");
    setFileName("");
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError("文件超过 10 兆，请选择更小的文件。");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const signed = await createCourseResourceUploadUrlAction({
        lessonId,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
      const response = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error("上传失败，请重试。");
      await confirmCourseResourceUploadAction({
        lessonId,
        objectKey: signed.objectKey,
        fileSize: file.size,
      });
      setObjectKey(signed.objectKey);
      setFileName(file.name);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败，请重试。");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <label className="course-editor-field block text-[11px] font-medium">
        资料类型
        <select
          name="resource_type"
          value={resourceType}
          onChange={(event) => {
            setResourceType(event.target.value);
            setUploadError(null);
            setObjectKey("");
            setFileName("");
          }}
          className="app-input mt-1.5 w-full rounded-[7px] border px-3 py-2.5 text-[12px] outline-none"
        >
          {resourceTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      {resourceType === "link" ? (
        <label className="course-editor-field block text-[11px] font-medium sm:col-span-2">
          资料链接
          <input
            name="resource_url"
            type="url"
            required
            defaultValue={resource?.resource_url ?? ""}
            placeholder="https://..."
            className="app-input mt-1.5 w-full rounded-[7px] border px-3 py-2.5 text-[12px] outline-none"
          />
        </label>
      ) : (
        <div className="course-editor-file-field sm:col-span-2">
          <p className="text-[11px] font-medium">
            {resource?.original_file_name
              ? `当前文件：${resource.original_file_name}（选择新文件后替换）`
              : "上传文件（不超过 10 兆）"}
          </p>
          <input
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="app-input mt-1.5 w-full rounded-[7px] border px-3 py-2 text-[12px] outline-none"
          />
          <input type="hidden" name="resource_object_key" value={objectKey} />
          <input type="hidden" name="original_file_name" value={fileName} />
          {uploading && (
            <p className="app-muted-text mt-2 flex items-center gap-1.5 text-[11px]">
              <UploadCloud size={13} />正在上传…
            </p>
          )}
          {fileName && !uploading && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--app-success)" }}>
              <CheckCircle2 size={13} />已上传：{fileName}
            </p>
          )}
          {uploadError && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-600">
              <XCircle size={13} />{uploadError}
            </p>
          )}
        </div>
      )}
    </>
  );
}
