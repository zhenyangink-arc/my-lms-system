import { DashboardTitleWithHint } from "./DashboardTitleWithHint";

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
        <div className="flex min-h-10 min-w-0 items-center justify-start text-left">{description ? <DashboardTitleWithHint title={title} description={description} /> : <h1 className="text-left text-2xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>{title}</h1>}</div>

        {action && <div className="shrink-0 self-start sm:self-auto">{action}</div>}
      </div>
    </header>
  );
}
