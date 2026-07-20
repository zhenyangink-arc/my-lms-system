export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-5 p-5">
      <div className="app-soft-card h-24 rounded-3xl" />
      <div className="grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="app-soft-card h-36 rounded-3xl" />
        ))}
      </div>
      <div className="app-soft-card h-72 rounded-3xl" />
    </div>
  );
}
