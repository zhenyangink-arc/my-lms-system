type DashboardPageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function DashboardPageHeader({
  title,
  description,
  action,
}: DashboardPageHeaderProps) {
  return (
    <header className="px-4 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1
            className="text-2xl font-black tracking-tight"
            style={{ color: "var(--app-text)" }}
          >
            {title}
          </h1>

          {description && (
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--app-muted)" }}
            >
              {description}
            </p>
          )}
        </div>

        {action && <div className="shrink-0 self-start sm:self-auto">{action}</div>}
      </div>
    </header>
  );
}
