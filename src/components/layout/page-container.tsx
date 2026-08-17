import type { ReactNode } from "react";

import { ManagementPageHeader } from "@/components/layout/management-page";
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
      <div className="h-10 w-full bg-muted" />
      <div className="h-72 w-full bg-muted" />
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
        className="flex min-h-48 flex-1 items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground md:px-6"
      >
        {accessFallback ?? "你没有访问此页面的权限。"}
      </div>
    );
  }

  const hasHeader = Boolean(pageTitle || pageHeaderAction);

  return (
    <div className={cn("page-container management-page-shell flex w-full flex-1 flex-col", className)}>
      {hasHeader && (
        <ManagementPageHeader
          title={pageTitle ?? "管理工作台"}
          description={pageDescription}
          action={pageHeaderAction}
        />
      )}
      <div className={cn("page-container-content management-page-body min-w-0 flex-1", contentClassName)}>
        {isLoading ? (loadingFallback ?? <PageSkeleton />) : children}
      </div>
    </div>
  );
}
