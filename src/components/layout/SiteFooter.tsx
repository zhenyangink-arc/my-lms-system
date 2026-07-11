export function SiteFooter() {
  // 获取当前的真实年份
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
      {/* 替换了原来的 site-container，保持全局统一的响应式宽度 */}
      <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-500">
        &copy; {currentYear} Puffy-Proxima Company. All rights reserved.
      </div>
    </footer>
  );
}