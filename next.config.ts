import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 申请材料最大 15MB，为 multipart 边界和其他表单字段预留额外空间。
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
