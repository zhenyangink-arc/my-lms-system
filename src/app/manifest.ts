import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PUFFY 学习中心",
    short_name: "PUFFY",
    description: "PUFFY 学生学习中心",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#f4f9fc",
    theme_color: "#5b96f2",
    orientation: "any",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
