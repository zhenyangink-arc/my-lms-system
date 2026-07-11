export function QuestionSection() {
  return (
    <section id="question-section" className="bg-gray-50 py-16">
      {/* 这里的 site-container 替换成了统一的 Tailwind 容器类名 */}
      <div id="question-container" className="container mx-auto max-w-7xl px-4">
        <div
          id="question-card"
          className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-sm transition-shadow hover:shadow-md"
        >
          <h3 className="mb-4 text-3xl font-bold text-gray-900">
            有疑问？在线提问
          </h3>

          <p className="mb-10 text-center text-gray-600">
            Puffy-Proxima 智能助手随时为你解答关于学习、项目或技术的任何问题。
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr,auto]">
            <input
              type="text"
              // 我帮你把占位符稍微细化了一下，让它看起来更像真实的业务场景
              placeholder="例如：东国大学本硕博连读的申请条件是什么..."
              className="w-full rounded-2xl border border-gray-200 px-8 py-5 text-left outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />

            <button className="whitespace-nowrap rounded-2xl bg-indigo-600 px-10 py-5 text-lg font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 active:scale-95">
              开始询问
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}