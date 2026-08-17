import type { ReactNode } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ManagementPageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

type ManagementPageProps = ManagementPageHeaderProps & {
  children: ReactNode;
};

export function ManagementPageHeader({
  title,
  description,
  eyebrow = "管理工作台",
  icon: Icon,
  action,
  meta,
  className,
}: ManagementPageHeaderProps) {
  return (
    <header
      className={cn("management-page-hero", className)}
      data-has-icon={Icon ? "true" : "false"}
    >
      <div className="management-page-heading">
        {Icon && (
          <span className="management-page-icon" aria-hidden="true">
            <Icon size={20} strokeWidth={1.8} />
          </span>
        )}
        <div className="min-w-0">
          <p className="management-page-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description && <p className="management-page-lead">{description}</p>}
        </div>
      </div>

      {(meta || action) && (
        <div className="management-page-tools">
          {meta && <div className="management-page-meta">{meta}</div>}
          {action && <div className="management-page-actions">{action}</div>}
        </div>
      )}
    </header>
  );
}

export function ManagementPage({
  children,
  title,
  description,
  eyebrow = "管理工作台",
  icon: Icon,
  action,
  meta,
  className,
}: ManagementPageProps) {
  return (
    <div className={cn("management-page management-page-shell", className)}>
      <ManagementPageHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        icon={Icon}
        action={action}
        meta={meta}
      />

      <div className="management-page-body">{children}</div>
    </div>
  );
}

export type ManagementMetric = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
};

export function ManagementMetricStrip({
  items,
  label,
}: {
  items: ManagementMetric[];
  label: string;
}) {
  return (
    <section className="management-metric-strip" aria-label={label}>
      <dl>
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
            {item.detail && <p>{item.detail}</p>}
          </div>
        ))}
      </dl>
    </section>
  );
}

const noticeIcons = {
  info: Info,
  warning: CircleAlert,
  danger: CircleAlert,
  success: CheckCircle2,
} satisfies Record<string, LucideIcon>;

export function ManagementNotice({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof noticeIcons;
  className?: string;
}) {
  const Icon = noticeIcons[tone];

  return (
    <div
      className={cn("management-notice", className)}
      data-tone={tone}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
