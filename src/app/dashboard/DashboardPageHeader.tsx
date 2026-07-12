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
    <header
      className="border-b px-6 py-5"
      style={{
        backgroundColor: "var(--app-bg)",
        borderColor: "var(--app-border)",
        color: "var(--app-text)",
      }}
    >
      <div className="flex w-full items-center justify-between gap-4">
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

        {action && <div className="hidden md:block">{action}</div>}
      </div>
    </header>
  );
}