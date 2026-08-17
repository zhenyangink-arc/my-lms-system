export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">页面加载中…</span>
      <div
        aria-hidden="true"
        className="mx-auto min-h-[65vh] max-w-7xl animate-pulse px-4 py-12 motion-reduce:animate-none"
      >
        <div className="h-10 w-64 rounded-xl bg-[var(--muted)]" />
        <div className="mt-4 h-5 w-full max-w-xl rounded-lg bg-[var(--muted)]" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-48 rounded-3xl bg-[var(--muted)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
