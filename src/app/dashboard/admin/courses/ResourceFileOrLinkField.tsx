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

/*
  资料“类型 + 内容来源”字段

  逻辑：
  1. resource_type === "link" 时，显示外部链接输入框（name="resource_url"）
  2. 其他类型时，显示文件上传控件：
     - 选择文件后先做前端大小校验（10MB）
     - 调用 createResourceUploadUrlAction 拿到签名上传地址和随机 object key
     - 浏览器直接把文件 PUT 到 R2，不经过 Next.js 服务器中转
     - 上传成功后，把 object key 和原始文件名写进隐藏字段，
       跟随外层“新增资料”表单一起提交

  注意：
  这个组件目前只用在“新增资料”。
  编辑已有资料时暂时还不支持重新上传文件，这是先缩小范围，后续再补。
*/
export function ResourceFileOrLinkField({ lessonId }: { lessonId: string }) {
  const [resourceType, setResourceType] = useState("link");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedObjectKey, setUploadedObjectKey] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setUploadError(null);
    setUploadedObjectKey(null);
    setUploadedFileName(null);

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

      setUploadedObjectKey(objectKey);
      setUploadedFileName(file.name);
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
          onChange={(event) => {
            setResourceType(event.target.value);
            setUploadError(null);
            setUploadedObjectKey(null);
            setUploadedFileName(null);
          }}
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
            placeholder="https://..."
            className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
          />
        </label>
      ) : (
        <div className="block md:col-span-2">
          <span className="text-xs font-bold app-muted-text">
            上传文件（不超过 10MB）
          </span>

          <input
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
          />

          <input type="hidden" name="resource_object_key" value={uploadedObjectKey ?? ""} />
          <input type="hidden" name="original_file_name" value={uploadedFileName ?? ""} />

          {uploading && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs app-muted-text">
              <UploadCloud size={14} />
              正在上传…
            </p>
          )}

          {uploadedFileName && !uploading && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircle2 size={14} />
              已上传：{uploadedFileName}
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