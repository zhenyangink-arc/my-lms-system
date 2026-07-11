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
    <header className="border-b border-gray-200 bg-gray-50 px-6 py-5">
      <div className="flex w-full items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            {title}
          </h1>

          {description && (
            <p className="mt-1 text-sm text-gray-500">
              {description}
            </p>
          )}
        </div>

        {action && <div className="hidden md:block">{action}</div>}
      </div>
    </header>
  );
}