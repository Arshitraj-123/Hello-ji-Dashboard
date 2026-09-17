import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
    ...(command === "build"
      ? [
          nitro({
            defaultPreset: "node-server",
            routeRules: {
              "/api/**": {
                proxy: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/**`,
              },
              "/uploads/**": {
                proxy: `${process.env.BACKEND_URL || "http://localhost:5000"}/uploads/**`,
              },
            },
          }),
        ]
      : []),
  ],
}));
