import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Render's small instances from spawning a worker per reported host CPU.
  experimental: { cpus: 2 },
  // Excel workbook parsing is server-only; keep the hardened ExcelJS package
  // external to Turbopack so optional S3-only imports are not bundled.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
