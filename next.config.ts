import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera .next/standalone: un servidor mínimo para la imagen de Docker.
  // Vercel lo ignora y despliega como siempre.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // La raíz lleva al copiloto; si no hay sesión, el proxy manda al login.
  async redirects() {
    return [{ source: "/", destination: "/copiloto", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
