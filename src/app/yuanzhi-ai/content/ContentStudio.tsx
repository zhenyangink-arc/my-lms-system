"use client";

import NextImage from "next/image";
import {
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  ImageIcon,
  LayoutList,
  ScanText,
  Upload,
  Wand2,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";

type StudioMode = "image" | "article";
type WorkState = "idle" | "processing" | "done" | "error";

type ImageInput = {
  file: File;
  url: string;
};

type TextDetection = {
  rawValue?: string;
};

type TextDetectorLike = {
  detect(source: ImageBitmap): Promise<TextDetection[]>;
};

type TextDetectorConstructor = new () => TextDetectorLike;

const ARTICLE_SAMPLE = `韩国留学不仅需要选择学校，还需要同时准备语言能力、申请材料和签证计划。很多学生在开始阶段只关注学校排名，却忽略了专业匹配度和未来发展方向。

在准备过程中，可以先明确目标专业，再根据自己的成绩、韩语水平和预算建立学校清单。韩语学习也不应该和申请分开进行，因为面试、课堂交流和日常生活都会用到真实表达能力。

最后，把申请节点、材料截止日期和语言考试时间放在同一份计划中，每周检查进度，能够显著减少遗漏和临时赶工。`;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} 千字节`;
  return `${(bytes / 1024 / 1024).toFixed(1)} 兆`;
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function organizeArticle(text: string, style: "summary" | "study" | "polished") {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const sentences = splitSentences(normalized);
  const titleSource = paragraphs[0] ?? "整理后的文章";
  const title = titleSource.length <= 28 ? titleSource : `${titleSource.slice(0, 26)}…`;
  const summary = sentences.slice(0, Math.min(3, sentences.length)).join("");
  const keyPoints = sentences.slice(0, Math.min(5, sentences.length));

  if (style === "summary") {
    return `# ${title}\n\n## 内容摘要\n${summary}\n\n## 核心重点\n${keyPoints
      .map((point, index) => `${index + 1}. ${point}`)
      .join("\n")}`;
  }

  if (style === "study") {
    return `# ${title}\n\n## 一句话概括\n${sentences[0] ?? normalized}\n\n## 学习重点\n${keyPoints
      .map((point) => `- ${point}`)
      .join("\n")}\n\n## 原文结构\n${paragraphs
      .map((paragraph, index) => `### 第 ${index + 1} 部分\n${paragraph}`)
      .join("\n\n")}`;
  }

  return `# ${title}\n\n${paragraphs
    .map((paragraph, index) => `## ${index === 0 ? "开篇" : index === paragraphs.length - 1 ? "结语" : `正文 ${index}`}\n${paragraph}`)
    .join("\n\n")}`;
}

export function ContentStudio() {
  const [mode, setMode] = useState<StudioMode>("image");
  const [workState, setWorkState] = useState<WorkState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageInput, setImageInput] = useState<ImageInput | null>(null);
  const [imageTask, setImageTask] = useState("extract-text");
  const [imageResult, setImageResult] = useState("");
  const [articleText, setArticleText] = useState("");
  const [articleStyle, setArticleStyle] = useState<"summary" | "study" | "polished">("study");
  const [articleResult, setArticleResult] = useState("");

  const isBusy = workState === "processing";
  const currentResult = mode === "image" ? imageResult : articleResult;

  const stateLabel = useMemo(() => {
    if (workState === "processing") return "处理中";
    if (workState === "done") return "已完成";
    if (workState === "error") return "需要重试";
    return "等待任务";
  }, [workState]);

  useEffect(() => {
    return () => {
      if (imageInput) URL.revokeObjectURL(imageInput.url);
    };
  }, [imageInput]);

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageInput({ file, url: URL.createObjectURL(file) });
    setImageResult("");
    setWorkState("idle");
    setErrorMessage(null);
  }

  async function recognizeImage() {
    if (!imageInput) return;
    setWorkState("processing");
    setErrorMessage(null);

    try {
      const bitmap = await createImageBitmap(imageInput.file);
      const orientation = bitmap.width > bitmap.height ? "横向" : bitmap.width < bitmap.height ? "纵向" : "正方形";
      let detectedText = "";
      const TextDetector = (
        window as typeof window & { TextDetector?: TextDetectorConstructor }
      ).TextDetector;
      if (TextDetector && imageTask === "extract-text") {
        const detections = await new TextDetector().detect(bitmap);
        detectedText = detections
          .map((item) => item.rawValue?.trim())
          .filter(Boolean)
          .join("\n");
      }

      const taskName =
        imageTask === "extract-text"
          ? "提取图片文字"
          : imageTask === "study-material"
            ? "解析学习资料"
            : imageTask === "table"
              ? "识别表格"
              : "通用图像识别";
      setImageResult(
        `# 图像识别结果\n\n## 文件信息\n- 文件：${imageInput.file.name}\n- 尺寸：${bitmap.width} × ${bitmap.height} 像素\n- 方向：${orientation}\n- 大小：${formatFileSize(imageInput.file.size)}\n- 任务：${taskName}\n\n## 识别内容\n${
          detectedText ||
          "图片已成功读取。当前浏览器没有可用的本地文字检测能力；接入视觉模型接口后，这里将返回图片描述、文字、表格或学习资料结构。"
        }`
      );
      bitmap.close();
      setWorkState("done");
    } catch {
      setWorkState("error");
      setErrorMessage("图片读取失败，请换一张清晰的常见格式图片。");
    }
  }

  function organizeCurrentArticle() {
    if (!articleText.trim()) return;
    setWorkState("processing");
    setErrorMessage(null);
    const result = organizeArticle(articleText, articleStyle);
    setArticleResult(result);
    setWorkState("done");
  }

  function downloadResult() {
    if (!currentResult) return;
    const url = URL.createObjectURL(new Blob([currentResult], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = mode === "image" ? "元智图片识别结果.txt" : "元智文章整理结果.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[2.25rem] border border-white/90 bg-white/88 shadow-[0_28px_80px_rgba(49,95,124,0.13)] backdrop-blur">
      <header className="flex flex-col justify-between gap-4 border-b border-[#e4eef3] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="inline-flex rounded-2xl bg-[#f2f4f8] p-1.5">
          {([
            ["image", ImageIcon, "图像识别"],
            ["article", FileText, "自动整理文章"],
          ] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setWorkState("idle");
                setErrorMessage(null);
              }}
              disabled={isBusy}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                mode === value ? "bg-white text-[#715fa2] shadow-sm" : "text-[#7891a0] hover:text-[#526b7a]"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-black text-[#718896]">
          <span className={`h-2.5 w-2.5 rounded-full ${workState === "done" ? "bg-[#4ca574]" : workState === "error" ? "bg-[#df745d]" : "bg-[#8a77b9]"}`} />
          {stateLabel}
        </span>
      </header>

      {mode === "image" ? (
        <div className="grid min-h-[650px] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-[#e4eef3] p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="text-xs font-black tracking-[0.12em] text-[#806daf]">上传图片</p>
            <h2 className="mt-2 text-2xl font-black text-[#28516a]">上传一张需要理解的图片</h2>
            <p className="mt-3 text-sm leading-7 text-[#78909f]">适合截图、课堂资料、表格、海报和包含中韩文字的图片。</p>

            <label className="mt-7 block cursor-pointer overflow-hidden rounded-[1.75rem] border-2 border-dashed border-[#d9d0eb] bg-[#faf8fd] p-3 transition hover:border-[#b4a3d6]">
              {imageInput ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-white">
                  <NextImage src={imageInput.url} alt="待识别图片预览" fill unoptimized className="object-contain" />
                </div>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#7d69ad] shadow-sm">
                    <Upload size={27} />
                  </span>
                  <p className="mt-4 text-sm font-black text-[#526b7b]">点击选择图片</p>
                  <p className="mt-2 text-xs text-[#91a1aa]">支持常见图片格式，建议不超过 10 兆</p>
                </div>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="sr-only" />
            </label>

            {imageInput && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#f7f9fa] px-4 py-2.5 text-[11px] font-bold text-[#78909d]">
                <span className="truncate">{imageInput.file.name}</span>
                <span className="shrink-0">{formatFileSize(imageInput.file.size)}</span>
              </div>
            )}

            <div className="mt-6">
              <p className="text-xs font-black text-[#597688]">希望元智AI做什么？</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["extract-text", "提取文字"],
                  ["general", "理解图片"],
                  ["table", "识别表格"],
                  ["study-material", "解析学习资料"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setImageTask(value)}
                    className={`rounded-xl border px-3 py-3 text-xs font-black transition ${
                      imageTask === value ? "border-[#9d8bc6] bg-[#f3eefb] text-[#6e5a9e]" : "border-[#dfe8ec] bg-white text-[#718795]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void recognizeImage()}
              disabled={!imageInput || isBusy}
              className="mt-7 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#836eb5] to-[#6e5a9f] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(116,94,170,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ScanText size={18} /> {isBusy ? "正在读取图片…" : "开始识别"}
            </button>
          </div>

          <ResultPanel result={imageResult} emptyText="识别结果会显示在这里，包括图片信息、提取文字和结构化内容。" onDownload={downloadResult} />
        </div>
      ) : (
        <div className="grid min-h-[650px] lg:grid-cols-2">
          <div className="border-b border-[#e4eef3] p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.12em] text-[#4d9470]">文章内容</p>
                <h2 className="mt-2 text-2xl font-black text-[#28516a]">粘贴需要整理的文章</h2>
              </div>
              <button
                type="button"
                onClick={() => setArticleText(ARTICLE_SAMPLE)}
                className="rounded-xl border border-[#dce8ed] bg-white px-3 py-2 text-[11px] font-black text-[#58798c]"
              >
                填入示例
              </button>
            </div>
            <textarea
              value={articleText}
              onChange={(event) => setArticleText(event.target.value.slice(0, 12_000))}
              placeholder="把课程资料、申请说明、会议记录或零散文章粘贴到这里…"
              className="mt-6 min-h-[350px] w-full resize-none rounded-[1.75rem] border border-[#dce8ed] bg-[#fbfdfe] p-5 text-sm leading-8 text-[#355a70] outline-none transition focus:border-[#8bc3a5] focus:bg-white focus:ring-4 focus:ring-[#e7f5ed]"
            />
            <p className="mt-2 text-right text-[11px] font-bold text-[#91a3ad]">{articleText.length}/12000</p>

            <p className="mt-5 text-xs font-black text-[#597688]">选择整理方式</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {([
                ["summary", "摘要与重点"],
                ["study", "学习笔记"],
                ["polished", "文章重排"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setArticleStyle(value)}
                  className={`rounded-xl border px-3 py-3 text-xs font-black transition ${
                    articleStyle === value ? "border-[#78b493] bg-[#edf8f1] text-[#438461]" : "border-[#dfe8ec] bg-white text-[#718795]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={organizeCurrentArticle}
              disabled={!articleText.trim() || isBusy}
              className="mt-7 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4e9b70] to-[#3d8860] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(65,143,98,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Wand2 size={18} /> 自动整理文章
            </button>
          </div>

          <ResultPanel result={articleResult} emptyText="整理后的标题、摘要、重点和文章结构会显示在这里。" onDownload={downloadResult} />
        </div>
      )}

      {errorMessage && (
        <div className="border-t border-[#f1ddd7] bg-[#fff7f3] px-5 py-3 text-center text-xs font-bold text-[#c75f4c]" role="alert">
          {errorMessage}
        </div>
      )}
    </section>
  );
}

function ResultPanel({ result, emptyText, onDownload }: { result: string; emptyText: string; onDownload: () => void }) {
  return (
    <div className="flex flex-col bg-[#fbfdfe] p-5 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.12em] text-[#7182a2]">整理结果</p>
          <h2 className="mt-2 text-2xl font-black text-[#28516a]">结构化结果</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(result)}
            disabled={!result}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dbe7ec] bg-white text-[#657f8f] disabled:opacity-35"
            title="复制结果"
          >
            <Clipboard size={14} />
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={!result}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dbe7ec] bg-white text-[#657f8f] disabled:opacity-35"
            title="下载结果"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {result ? (
        <div className="mt-6 flex-1 whitespace-pre-wrap rounded-[1.75rem] border border-[#dde8ed] bg-white p-5 text-sm leading-8 text-[#3f6175] shadow-sm">
          {result}
        </div>
      ) : (
        <div className="mt-6 flex min-h-[430px] flex-1 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[#d8e3e8] bg-white/70 p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f1edf8] text-[#806cad]">
            <LayoutList size={26} />
          </span>
          <p className="mt-5 max-w-sm text-sm font-black leading-7 text-[#6b8291]">{emptyText}</p>
          <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#91a2ac]">
            <CheckCircle2 size={14} className="text-[#5ca079]" /> 支持复制和导出结果
          </span>
        </div>
      )}
    </div>
  );
}
