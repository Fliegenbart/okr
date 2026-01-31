declare module "next-pwa" {
  import type { NextConfig } from "next";

  type NextPwaOptions = Record<string, unknown>;

  export default function nextPwa(
    options: NextPwaOptions
  ): (nextConfig: NextConfig) => NextConfig;
}

