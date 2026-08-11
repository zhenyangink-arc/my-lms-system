import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  isLoading?: boolean;
  access?: boolean;
  accessFallback?: ReactNode;
  loadingFallback?: ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  pageHeaderAction?: ReactNode;
}

function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="页面加载中"
      className="flex flex-1 animate-pulse flex-col gap-3"
    >
      <div className="h-10 w-full bg-[var(--app-soft-bg)]" />
      <div className="h-72 w-full bg-[var(--app-soft-bg)]" />
    </div>
  );
}

export default function PageContainer({
  children,
  className,
  contentClassName,
  isLoading = false,
  access = true,
  accessFallback,
  loadingFallback,
  pageTitle,
  pageDescription,
  pageHeaderAction,
}: PageContainerProps) {
  if (!access) {
    return (
      <div
        role="status"
        className="flex min-h-48 flex-1 items-center justify-center px-4 py-8 text-center text-sm text-[var(--app-muted)] md:px-6"
      >
        {accessFallback ?? "你没有访问此页面的权限。"}
      </div>
    );
  }

  const hasHeader = Boolean(pageTitle || pageHeaderAction);

  return (
    <div className={cn("flex w-full flex-1 flex-col px-4 pb-5 md:px-6", className)}>
      {hasHeader && (
        <div className="mb-4 flex items-start justify-between gap-4">
          {pageTitle ? (
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">
                {pageTitle}
              </h1>
              {pageDescription && (
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                  {pageDescription}
                </p>
              )}
            </div>
          ) : (
            <span aria-hidden="true" />
          )}
          {pageHeaderAction && <div className="shrink-0">{pageHeaderAction}</div>}
        </div>
      )}
      <div className={cn("min-w-0 flex-1", contentClassName)}>
        {isLoading ? (loadingFallback ?? <PageSkeleton />) : children}
      </div>
    </div>
  );
}
