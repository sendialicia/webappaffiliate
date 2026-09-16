import type { NextConfig } from "next";

const isSnapshot = process.env.NEXT_PUBLIC_SNAPSHOT === "1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Snapshot builds emit a plain static folder that needs no Node server, so the
  // mentor can open it with `npx serve out`. Normal dev and build are untouched.
  ...(isSnapshot ? { output: "export" as const, images: { unoptimized: true } } : {}),
};

export default nextConfig;
