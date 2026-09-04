import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  // Local dev only (does not affect the production build) - same reasoning as
  // admin/vite.config.ts: src/api.ts calls /api/..., proxy it to wherever the
  // FastAPI backend runs locally so `npm run dev` can reach it.
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
