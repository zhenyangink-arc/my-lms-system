export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">控制台加载中…</span>
      <div
        aria-hidden="true"
        className="mx-auto w-full max-w-[1500px] animate-pulse space-y-4 p-4 sm:p-6 motion-reduce:animate-none"
      >
        <div className="h-7 w-52 rounded-lg" style={{ backgroundColor: "var(--surface-soft)" }} />
        <div className="grid overflow-hidden rounded-2xl border md:grid-cols-3" style={{ borderColor: "var(--border)" }}>
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 border-b last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }} />
          ))}
        </div>
        <div className="h-72 rounded-2xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }} />
      </div>
    </div>
  );
}
