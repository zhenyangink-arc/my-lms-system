"use client";

import { useState } from "react";
import { CheckCircle2, UploadCloud, XCircle } from "lucide-react";

import { createResourceUploadUrlAction } from "./actions";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

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

/*
  编辑已有资料时的"类型 + 内容来源"字段

  跟新增资料用的 ResourceFileOrLinkField 的区别：
  1. 这个组件带着"已有资料"的初始值（链接或已上传的文件名）
  2. 如果资料类型是文件类，且管理员不重新选择文件，
     就保持原来的文件不变（隐藏字段留空，服务器那边会自动沿用旧值）
  3. 只有管理员主动选择了新文件并上传成功，隐藏字段才会带上新的 object key，
     服务器收到后才会替换文件，并把 R2 里的旧文件删掉
*/
export function EditResourceFileOrLinkField({
  lessonId,
  resource,
}: {
  lessonId: string;
  resource: ExistingResource;
}) {
  const [resourceType, setResourceType] = useState(resource.resource_type);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newObjectKey, setNewObjectKey] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setUploadError(null);

    if (!file) {
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError("文件超过 10MB 限制，请选择更小的文件。");
      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const { uploadUrl, objectKey } = await createResourceUploadUrlAction(
        lessonId,
        file.name,
        file.type
      );

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("上传失败，请重试。");
      }

      setNewObjectKey(objectKey);
      setNewFileName(file.name);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "上传失败，请重试。"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <label className="block">
        <span className="text-xs font-bold app-muted-text">资料类型</span>

        <select
          name="resource_type"
          value={resourceType}
          onChange={(event) => setResourceType(event.target.value)}
          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
        >
          {resourceTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {resourceType === "link" ? (
        <label className="block md:col-span-2">
          <span className="text-xs font-bold app-muted-text">资料 URL</span>

          <input
            name="resource_url"
            defaultValue={resource.resource_url ?? ""}
            placeholder="https://..."
            className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
          />
        </label>
      ) : (
        <div className="block md:col-span-2">
          <span className="text-xs font-bold app-muted-text">
            {resource.original_file_name
              ? `当前文件：${resource.original_file_name}（如需替换，重新选择文件即可）`
              : "上传文件（不超过 10MB）"}
          </span>

          <input
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
          />

          {/*
            这两个隐藏字段，只在管理员真的重新上传了新文件时才有值。
            没重新上传时留空，服务器那边会自动保留数据库里原来的文件，不会误清空。
          */}
          <input type="hidden" name="resource_object_key" value={newObjectKey ?? ""} />
          <input type="hidden" name="original_file_name" value={newFileName ?? ""} />

          {uploading && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs app-muted-text">
              <UploadCloud size={14} />
              正在上传新文件…
            </p>
          )}

          {newFileName && !uploading && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircle2 size={14} />
              已上传新文件：{newFileName}（保存后将替换旧文件）
            </p>
          )}

          {uploadError && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
              <XCircle size={14} />
              {uploadError}
            </p>
          )}
        </div>
      )}
    </>
  );
}