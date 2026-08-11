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
    <header className="dashboard-page-header px-4 pt-6 sm:px-6 lg:px-8">
      <div className="dashboard-page-header-inner mx-auto flex w-full max-w-[1500px] flex-col items-start justify-between gap-4 text-left sm:flex-row sm:items-center">
        <div className="min-w-0 text-left">
          <h1 className="dashboard-page-title text-left font-semibold tracking-tight" style={{ color: "var(--app-text)" }}>{title}</h1>
          {description && (
            <p className="dashboard-page-description app-muted-text mt-1.5 max-w-3xl">
              {description}
            </p>
          )}
        </div>

        {action && <div className="shrink-0 self-start sm:self-auto">{action}</div>}
      </div>
    </header>
  );
}
