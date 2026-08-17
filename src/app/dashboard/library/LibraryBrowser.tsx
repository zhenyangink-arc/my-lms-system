"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Archive,
  Download,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Heart,
  Link2,
  Presentation,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialLibraryActionState } from "./action-state";
import { toggleLibraryFavoriteAction } from "./actions";
import {
  LIBRARY_CATEGORY_LABELS,
  LIBRARY_RESOURCE_TYPE_LABELS,
  formatFileSize,
  type LibraryCategory,
  type LibraryResourceType,
} from "./config";

type Resource = {
  id: string;
  title: string;
  description: string;
  category: LibraryCategory;
  resource_type: LibraryResourceType;
  original_file_name: string | null;
  file_size: number | null;
  is_featured: boolean;
  download_count: number;
};

const icons = {
  document: FileText,
  image: FileImage,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: FolderArchive,
  link: Link2,
};

function Favorite({ id, active }: { id: string; active: boolean }) {
  const action = toggleLibraryFavoriteAction.bind(null, id);
  const [state, formAction, pending] = useActionState(
    action,
    initialLibraryActionState,
  );

  return (
    <form action={formAction}>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending}
        title={state.message || undefined}
        aria-label={active ? "取消收藏" : "加入收藏"}
        aria-pressed={active}
        className="app-soft-card h-9 w-9 rounded-xl border"
        style={{
          color: active ? "var(--status-danger)" : "var(--foreground-muted)",
        }}
      >
        <Heart size={15} fill={active ? "currentColor" : "none"} />
      </Button>
    </form>
  );
}

export function LibraryBrowser({
  resources,
  favorites,
}: {
  resources: Resource[];
  favorites: string[];
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | LibraryCategory>("all");
  const [onlyFav, setOnlyFav] = useState(false);
  const fav = useMemo(() => new Set(favorites), [favorites]);
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return resources.filter(
      (x) =>
        (category === "all" || x.category === category) &&
        (!onlyFav || fav.has(x.id)) &&
        (!k ||
          `${x.title} ${x.description} ${x.original_file_name ?? ""}`
            .toLowerCase()
            .includes(k)),
    );
  }, [resources, q, category, onlyFav, fav]);

  return (
    <section className="app-card rounded-3xl border p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold">全部资料</h2>
          <p className="app-muted-text mt-1 text-xs">
            共 {resources.length} 项已发布资源
          </p>
        </div>
        <label className="app-input flex items-center gap-2 rounded-xl border px-3 py-2.5 lg:w-[340px]">
          <span className="sr-only">搜索学习资料</span>
          <Search size={15} aria-hidden="true" />
          <Input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="搜索标题、说明或文件名"
            className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCategory("all")}
          aria-pressed={category === "all"}
          className="rounded-full px-3 py-1.5 text-xs font-bold"
          style={{
            color:
              category === "all"
                ? "var(--primary-foreground)"
                : "var(--foreground-muted)",
            backgroundColor:
              category === "all" ? "var(--primary)" : "var(--surface-soft)",
          }}
        >
          全部
        </Button>
        {Object.entries(LIBRARY_CATEGORY_LABELS).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            onClick={() => setCategory(value as LibraryCategory)}
            aria-pressed={category === value}
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              color:
                category === value
                  ? "var(--primary-foreground)"
                  : "var(--foreground-muted)",
              backgroundColor:
                category === value
                  ? "var(--primary)"
                  : "var(--surface-soft)",
            }}
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOnlyFav((value) => !value)}
          aria-pressed={onlyFav}
          className="rounded-full px-3 py-1.5 text-xs font-bold"
          style={{
            color: onlyFav
              ? "var(--status-danger)"
              : "var(--foreground-muted)",
            backgroundColor: onlyFav
              ? "var(--status-danger-surface)"
              : "var(--surface-soft)",
          }}
        >
          <Heart size={12} fill={onlyFav ? "currentColor" : "none"} />
          我的收藏
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {list.map((resource) => {
          const Icon = icons[resource.resource_type];
          return (
            <article
              key={resource.id}
              className="app-soft-card flex h-full flex-col rounded-2xl border p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    color: "var(--primary)",
                    backgroundColor: "var(--accent)",
                  }}
                >
                  <Icon size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: "var(--support)" }}
                    >
                      {LIBRARY_CATEGORY_LABELS[resource.category]}
                    </span>
                    <span className="app-muted-text text-[10px]">
                      {LIBRARY_RESOURCE_TYPE_LABELS[resource.resource_type]}
                    </span>
                    {resource.is_featured && (
                      <Sparkles
                        size={11}
                        style={{ color: "var(--status-warning)" }}
                      />
                    )}
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold leading-6">
                    {resource.title}
                  </h3>
                </div>
                <Favorite id={resource.id} active={fav.has(resource.id)} />
              </div>
              <p className="app-muted-text mt-3 line-clamp-3 text-xs leading-5">
                {resource.description || "打开资料查看完整内容。"}
              </p>
              <div
                className="app-muted-text mt-auto flex items-center justify-between gap-2 border-t pt-4 text-[10px]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span className="min-w-0 truncate">
                  {resource.original_file_name || "外部链接"}
                  {resource.file_size
                    ? ` · ${formatFileSize(resource.file_size)}`
                    : ""}
                </span>
                <span className="shrink-0">
                  {resource.download_count} 次获取
                </span>
              </div>
              <a
                href={`/api/library/${resource.id}/download`}
                target={resource.resource_type === "link" ? "_blank" : undefined}
                rel={resource.resource_type === "link" ? "noreferrer" : undefined}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-[var(--primary-foreground)]"
              >
                {resource.resource_type === "link" ? (
                  <ExternalLink size={13} />
                ) : (
                  <Download size={13} />
                )}{" "}
                {resource.resource_type === "link" ? "打开链接" : "下载资料"}
              </a>
            </article>
          );
        })}
        {list.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed p-8 text-center">
            <Archive className="mx-auto opacity-30" size={30} />
            <p className="mt-3 font-bold">没有找到相关资料</p>
            <p className="app-muted-text mt-1 text-xs">
              更换关键词、分类或收藏筛选后重试。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
