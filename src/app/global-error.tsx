"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f9fafb",
          color: "#111827",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 520, textAlign: "center" }}>
          <p style={{ color: "#dc2626", fontWeight: 700 }}>系统暂时无法显示页面</p>
          <h1 style={{ margin: "12px 0", fontSize: 28 }}>请重新加载后再试</h1>
          <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
            如果问题持续出现，请稍后再试或联系平台管理员。
          </p>
          <button
            type="button"
            onClick={unstable_retry}
            style={{
              marginTop: 20,
              border: 0,
              borderRadius: 12,
              padding: "11px 20px",
              background: "#111827",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            重新加载
          </button>
        </main>
      </body>
    </html>
  );
}
