export default function StudentPortalLoading() {
  return (
    <main
      className="min-h-screen bg-[#f3f5f2] px-4 pb-12 pt-28 sm:px-6 lg:px-8"
      aria-label="正在加载学生应用门户"
      aria-busy="true"
    >
      <div className="mx-auto w-full max-w-[1440px] animate-pulse space-y-6 motion-reduce:animate-none">
        <div className="grid items-end gap-5 px-1 py-4 lg:grid-cols-[minmax(17rem,0.65fr)_minmax(0,1.35fr)] lg:gap-8 lg:py-6">
          <div>
            <div className="h-10 w-56 rounded-xl bg-slate-200/80" />
            <div className="mt-3 h-5 w-44 rounded-lg bg-slate-200/60" />
          </div>
          <div className="h-16 rounded-[1.35rem] bg-white/90 ring-1 ring-slate-200/70" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(22rem,0.72fr)_minmax(0,1.28fr)]">
          <div className="h-[30rem] rounded-[1.75rem] bg-white/90 ring-1 ring-slate-200/70" />
          <div className="h-[30rem] rounded-[1.75rem] bg-white/90 ring-1 ring-slate-200/70" />
        </div>

        <div className="h-80 rounded-[1.75rem] bg-white/90 ring-1 ring-slate-200/70" />

        <section className="rounded-[1.75rem] bg-white/90 p-5 ring-1 ring-slate-200/70 sm:p-6">
          <div className="h-7 w-44 rounded-lg bg-slate-200/80" />
          <div className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-44 rounded-[1.35rem] bg-slate-100" />
            ))}
          </div>
        </section>
      </div>
      <p className="sr-only">正在读取应用、课程进度和学习能力数据。</p>
    </main>
  );
}
